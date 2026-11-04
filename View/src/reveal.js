export function buildRevealTimeline(nodes, links) {
  // All branches at the same distance from Stack advance together. The wire
  // arrives first, then its destination opens; there is no clockwise stagger.
  const maxDepth = Math.max(1, ...nodes.map((node) => node.depth || 0));
  // Spread the extra 1.5 seconds across the waves, preserving simultaneous branches.
  const step = Math.min(760, 4000 / maxDepth) + 1500 / maxDepth;
  const delays = new Map(nodes.map((node) => [node.id, (node.depth || 0) * step]));
  const departure = Math.min(180, step * .24);
  const edges = links.map(({ source, target }) => {
    const sourceDelay = delays.get(source.id), targetDelay = delays.get(target.id);
    const earlier = Math.min(sourceDelay, targetDelay), later = Math.max(sourceDelay, targetDelay);
    return {
      delay: source.depth === target.depth ? later + 220 : earlier + departure,
      duration: source.depth === target.depth ? Math.min(420, step * .55) : Math.max(1, later - earlier - departure),
      reverse: sourceDelay > targetDelay,
    };
  });
  return { delays, edges };
}
