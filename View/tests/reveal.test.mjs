import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRevealTimeline } from '../src/reveal.js';

test('Stack appears first; branches follow their parents and reversed edges draw outward', () => {
  const stack = { id: 'Stack', depth: 0, x: 0, y: 0 };
  const tools = { id: 'Tools', depth: 1, x: -120, y: 0 };
  const git = { id: 'Git', depth: 2, x: -240, y: -30 };
  const github = { id: 'Github', depth: 2, x: -240, y: 30 };
  const nodes = [github, git, tools, stack];
  const links = [{ source: tools, target: stack }, { source: git, target: tools }, { source: git, target: github }];
  const { delays, edges } = buildRevealTimeline(nodes, links);
  assert.equal(delays.get('Stack'), 0);
  assert.ok(delays.get('Tools') > delays.get('Stack'));
  assert.ok(delays.get('Git') > delays.get('Tools'));
  assert.equal(edges[0].reverse, true);
  assert.ok(edges[0].delay > delays.get('Stack'));
  assert.ok(edges[0].delay < delays.get('Tools'));
  assert.equal(edges[0].delay + edges[0].duration, delays.get('Tools'));
  assert.equal(edges[1].delay + edges[1].duration, delays.get('Git'));
  assert.ok(edges[2].delay > Math.max(delays.get('Git'), delays.get('Github')));
});

test('branches expand together in every direction and wires finish before their notes open', () => {
  const stack = { id: 'Stack', depth: 0 };
  const branches = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([x, y], index) => ({ id: `branch-${index}`, depth: 1, x, y }));
  const leaves = branches.map((branch) => ({ ...branch, id: `${branch.id}-leaf`, depth: 2 }));
  const links = branches.map((target) => ({ source: stack, target }));
  links.push(...leaves.map((target, index) => ({ source: branches[index], target })));
  const { delays, edges } = buildRevealTimeline([stack, ...branches, ...leaves], links);
  assert.equal(new Set(branches.map((node) => delays.get(node.id))).size, 1);
  assert.equal(new Set(leaves.map((node) => delays.get(node.id))).size, 1);
  links.forEach((link, index) => {
    assert.equal(edges[index].delay + edges[index].duration, delays.get(link.target.id));
    assert.ok(edges[index].delay > delays.get(link.source.id));
  });
});

test('large branches and deep graphs finish quickly without modifying input or using timers', () => {
  const nodes = Array.from({ length: 200 }, (_, index) => ({ id: `${index}`, depth: index, x: index, y: index % 2 }));
  const before = structuredClone(nodes);
  const first = buildRevealTimeline(nodes, []);
  assert.ok(Math.max(...first.delays.values()) + 420 < 6100);
  assert.deepEqual(nodes, before);
  assert.deepEqual(buildRevealTimeline(nodes, []), first);
  assert.equal(buildRevealTimeline([], []).delays.size, 0);
});

test('the extra 1.5 seconds are distributed across the outward waves', () => {
  for (const depth of [1, 2, 5, 20]) {
    const nodes = Array.from({ length: depth + 1 }, (_, index) => ({ id: `${index}`, depth: index }));
    const { delays } = buildRevealTimeline(nodes, []);
    const originalDuration = Math.min(760, 4000 / depth) * depth + 420;
    assert.ok(Math.abs(delays.get(`${depth}`) + 420 - originalDuration - 1500) < .001);
  }
});
