const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const endpointId = (endpoint) => typeof endpoint === 'string' ? endpoint : endpoint.id;

export function stackDistances(notes, links) {
  const distances = new Map(notes.map((note) => [note.id, Infinity]));
  const neighbors = new Map(notes.map((note) => [note.id, []]));
  for (const link of links) {
    const source = endpointId(link.source), target = endpointId(link.target);
    if (!neighbors.has(source) || !neighbors.has(target)) continue;
    neighbors.get(source).push(target);
    neighbors.get(target).push(source);
  }
  const root = notes.find((note) => note.id === 'Stack') || notes.find((note) => note.category === 'Main') || notes[0];
  if (!root) return distances;
  distances.set(root.id, 0);
  const queue = [root.id];
  for (const id of queue) {
    for (const neighbor of neighbors.get(id)) {
      if (distances.get(neighbor) !== Infinity) continue;
      distances.set(neighbor, distances.get(id) + 1);
      queue.push(neighbor);
    }
  }
  return distances;
}

export function compareStackDistance(a, b) {
  const first = a.stackDistance ?? Infinity, second = b.stackDistance ?? Infinity;
  return (first === second ? 0 : first - second) || a.title.localeCompare(b.title, 'pt-BR');
}

export function labelOpacity(distance, relativeZoom) {
  const depth = Number.isFinite(distance) ? distance : 8;
  const fullAt = .6 + Math.min(depth, 8) * .045;
  const progress = clamp((relativeZoom - (fullAt - .2)) / .2, 0, 1);
  // At 100% every title is present; distance only softens its emphasis.
  const distanceFade = clamp((depth - 1) * .06, 0, .35);
  const emphasis = 1 - distanceFade * (1 - clamp((relativeZoom - 1) / .6, 0, 1));
  return progress * progress * (3 - 2 * progress) * emphasis;
}

export function screenRadius(node, relativeZoom = 1) {
  const base = node.category === 'Main' ? 8 : node.category === 'Class' ? 5.5 : 4;
  return base * clamp(Math.pow(Math.max(.01, relativeZoom), .18), .7, 1.45);
}

export function noteZoomTarget(point, transform, dimensions, fittedScale, maxScale) {
  const k = Math.min(maxScale, Math.max(transform.k * 1.8, fittedScale * 2.2));
  return { k, x: dimensions.width / 2 - point.x * k, y: dimensions.height / 2 - point.y * k };
}
