import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameTask, zoomAtCenter } from '../src/navigation.js';

function frames() {
  let next = 0;
  const pending = new Map();
  return {
    request: (callback) => { pending.set(++next, callback); return next; },
    cancel: (id) => pending.delete(id),
    paint: () => { for (const [id, callback] of [...pending]) { pending.delete(id); callback(); } },
    pending,
  };
}

test('rapid input produces one paint with the latest value, without losing the following frame', () => {
  const clock = frames(), received = [];
  const task = createFrameTask((value) => received.push(value), clock.request, clock.cancel);
  for (let i = 0; i < 120; i++) task.schedule(i);
  assert.equal(clock.pending.size, 1);
  clock.paint();
  assert.deepEqual(received, [119]);
  task.schedule('next');
  clock.paint();
  assert.deepEqual(received, [119, 'next']);
});

test('flush commits the latest view once and cancellation prevents stale navigation work', () => {
  const clock = frames(), received = [];
  const task = createFrameTask((value) => received.push(value), clock.request, clock.cancel);
  task.schedule('zoom');
  task.flush();
  clock.paint();
  assert.deepEqual(received, ['zoom']);
  task.schedule('old filter');
  task.cancel();
  clock.paint();
  assert.deepEqual(received, ['zoom']);
  task.schedule('new filter');
  clock.paint();
  assert.deepEqual(received, ['zoom', 'new filter']);
});

test('zoom preserves the point at the viewport center and stays within its limits', () => {
  const original = { x: -80, y: 25, k: .8 }, size = { width: 1000, height: 700 };
  const point = { x: (500 - original.x) / original.k, y: (350 - original.y) / original.k };
  for (const factor of [.01, .5, 1.3, 100]) {
    const target = zoomAtCenter(original, factor, size, [.15, 5]);
    assert.ok(Math.abs(point.x * target.k + target.x - 500) < 1e-9);
    assert.ok(Math.abs(point.y * target.k + target.y - 350) < 1e-9);
    assert.ok(target.k >= .15 && target.k <= 5);
  }
  assert.deepEqual(original, { x: -80, y: 25, k: .8 });
});
