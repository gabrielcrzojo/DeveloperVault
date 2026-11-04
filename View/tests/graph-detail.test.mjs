import test from 'node:test';
import assert from 'node:assert/strict';
import { stackDistances, compareStackDistance, labelOpacity, screenRadius, noteZoomTarget } from '../src/graph-detail.js';

test('relevance follows the shortest undirected path to Stack, including cycles and isolated notes', () => {
  const notes = ['Remote', 'Stack', 'Branch', 'Leaf', 'Isolated'].map((id) => ({ id }));
  const links = [['Remote', 'Leaf'], ['Leaf', 'Branch'], ['Branch', 'Stack'], ['Leaf', 'Stack']]
    .map(([source, target]) => ({ source, target }));
  assert.deepEqual(stackDistances(notes, links), new Map([
    ['Remote', 2], ['Stack', 0], ['Branch', 1], ['Leaf', 1], ['Isolated', Infinity],
  ]));
  assert.equal(stackDistances([], []).size, 0);
});

test('note order prioritizes distance before title, with disconnected notes last', () => {
  const notes = [
    { title: 'Agent', stackDistance: 3 }, { title: 'Tools', stackDistance: 1 },
    { title: 'Stack', stackDistance: 0 }, { title: 'AI', stackDistance: 1 },
    { title: 'Isolated', stackDistance: Infinity },
  ];
  assert.deepEqual(notes.sort(compareStackDistance).map((note) => note.title), ['Stack', 'AI', 'Tools', 'Agent', 'Isolated']);
});

test('zoom gradually hides distant labels first and leaves only dots at long range', () => {
  for (const distance of [0, 1, 2, 3, 5, Infinity]) {
    assert.equal(labelOpacity(distance, .35), 0);
    assert.equal(labelOpacity(distance, 3), 1);
    const samples = [.5, .7, .9, 1.1, 1.4, 2].map((zoom) => labelOpacity(distance, zoom));
    assert.ok(samples.every((opacity, index) => opacity >= 0 && opacity <= 1 && (!index || opacity >= samples[index - 1])));
  }
  assert.equal(labelOpacity(1, 1), 1);
  assert.ok(labelOpacity(3, 1) > 0 && labelOpacity(3, 1) < 1);
  assert.ok(labelOpacity(5, 1) >= .7 && labelOpacity(5, 1) < labelOpacity(3, 1));
  for (const distance of [0, 1, 2, 3, 5, 20, Infinity]) {
    assert.ok(labelOpacity(distance, 1) >= .65);
  }
  for (const zoom of [.5, 1, 1.5]) {
    assert.ok([0, 1, 2, 3, 4, 5].every((depth) => labelOpacity(depth, zoom) >= labelOpacity(depth + 1, zoom)));
  }
});

test('dots grow gently with zoom and retain a bounded hierarchy of sizes', () => {
  for (const category of ['Main', 'Class', 'Note']) {
    const node = { category }, base = screenRadius(node, 1);
    assert.ok(screenRadius(node, 5) > base);
    assert.ok(screenRadius(node, 5) < base * 1.4);
    assert.equal(screenRadius(node, 1000), base * 1.45);
    assert.equal(screenRadius(node, .001), base * .7);
  }
  assert.ok(screenRadius({ category: 'Main' }, 1) > screenRadius({ category: 'Class' }, 1));
  assert.ok(screenRadius({ category: 'Class' }, 1) > screenRadius({ category: 'Note' }, 1));
});

test('opening a note centers its current position and respects the zoom limit without moving the saved view', () => {
  const point = { x: -420, y: 210 }, original = { k: .8, x: 150, y: 300 };
  const target = noteZoomTarget(point, original, { width: 1200, height: 800 }, .8, 5);
  assert.ok(target.k > original.k);
  assert.equal(point.x * target.k + target.x, 600);
  assert.equal(point.y * target.k + target.y, 400);
  assert.deepEqual(original, { k: .8, x: 150, y: 300 });
  assert.equal(noteZoomTarget(point, { k: 4.9 }, { width: 400, height: 700 }, .8, 5).k, 5);
});
