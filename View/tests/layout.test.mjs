import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutGraph } from '../src/layout.js';

function crossingCount(positions, links) {
  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let count = 0;
  for (let i = 0; i < links.length; i++) {
    for (let j = i + 1; j < links.length; j++) {
      const first = links[i], second = links[j];
      if ([first.source, first.target].some((id) => id === second.source || id === second.target)) continue;
      const a = positions.get(first.source), b = positions.get(first.target);
      const c = positions.get(second.source), d = positions.get(second.target);
      if (orient(a, b, c) * orient(a, b, d) < -1e-7 && orient(c, d, a) * orient(c, d, b) < -1e-7) count++;
    }
  }
  return count;
}

test('the Git/GitHub triangle stays clear of Docker and the other Tools spokes', () => {
  const names = ['Stack', 'Tools', 'Docker', 'Container', 'Docker Image', 'Git', 'Github', 'Linux', 'PostHog', 'Upstash', 'Redis', 'QStash', 'Vercel'];
  const notes = names.map((id) => ({ id }));
  const pairs = [['Stack', 'Tools'], ['Tools', 'Docker'], ['Docker', 'Container'], ['Docker', 'Docker Image'], ['Container', 'Docker Image'], ['Tools', 'Git'], ['Tools', 'Github'], ['Git', 'Github'], ['Tools', 'Linux'], ['Tools', 'PostHog'], ['Tools', 'Upstash'], ['Upstash', 'Redis'], ['Upstash', 'QStash'], ['Tools', 'Vercel']];
  const links = pairs.map(([source, target]) => ({ source, target }));
  assert.equal(crossingCount(layoutGraph(notes, links), links), 0);
});

test('cycles and isolated components receive distinct, finite positions without adding connections', () => {
  const notes = ['Stack', 'Concepts', 'DevOps', 'CI e CD', 'Pipeline', 'DAGs', 'Isolated', 'Other', 'New'].map((id) => ({ id }));
  const pairs = [['Stack', 'Concepts'], ['Concepts', 'DevOps'], ['DevOps', 'CI e CD'], ['CI e CD', 'DAGs'], ['DAGs', 'Pipeline'], ['Pipeline', 'DevOps'], ['Isolated', 'Other']];
  const links = pairs.map(([source, target]) => ({ source, target }));
  const before = structuredClone({ notes, links });
  const positions = layoutGraph(notes, links);
  assert.equal(positions.size, notes.length);
  assert.equal(new Set([...positions.values()].map(({ x, y }) => `${x},${y}`)).size, notes.length);
  assert.ok([...positions.values()].every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  assert.equal(crossingCount(positions, links), 0);
  assert.deepEqual({ notes, links }, before);
  assert.deepEqual(layoutGraph(notes, links), positions);
});

test('an empty graph and a graph without a Stack note remain supported', () => {
  assert.equal(layoutGraph([], []).size, 0);
  const positions = layoutGraph([{ id: 'First' }, { id: 'Second' }], [{ source: 'First', target: 'Second' }]);
  assert.deepEqual(positions.get('First'), { x: 0, y: 0, depth: 0 });
  assert.equal(positions.get('Second').depth, 1);
});
