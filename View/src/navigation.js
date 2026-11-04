// Keep only the latest input before the next paint. Flush and cancel also
// discard stale work when navigation or a new gesture interrupts a frame.
export function createFrameTask(callback, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame) {
  let frame = null, latest;
  function flush() {
    if (frame === null) return;
    cancelFrame(frame);
    frame = null;
    callback(latest);
  }
  return {
    schedule(value) {
      latest = value;
      if (frame === null) frame = requestFrame(flush);
    },
    flush,
    cancel() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
    },
  };
}

export function zoomAtCenter(transform, factor, dimensions, extent) {
  const k = Math.max(extent[0], Math.min(extent[1], transform.k * factor));
  const ratio = k / transform.k;
  return {
    k,
    x: dimensions.width / 2 - (dimensions.width / 2 - transform.x) * ratio,
    y: dimensions.height / 2 - (dimensions.height / 2 - transform.y) * ratio,
  };
}
