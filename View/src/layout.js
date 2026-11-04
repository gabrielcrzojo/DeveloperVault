const branchOrder = ['Tools', 'Frontend', 'Concepts', 'Documentation', 'DataBase', 'Backend', 'AI'];
const endpointId = (endpoint) => typeof endpoint === 'string' ? endpoint : endpoint.id;

// Keep each subtree inside its angular sector. A force simulation can pull
// neighboring branches through each other, especially around short cycles.
export function layoutGraph(notes, links) {
  if (!notes.length) return new Map();
  const nodes = notes.map((note) => ({ id: note.id, category: note.category, neighbors: new Set(), children: [] }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const link of links) {
    const source = byId.get(endpointId(link.source));
    const target = byId.get(endpointId(link.target));
    if (!source || !target || source === target) continue;
    source.neighbors.add(target.id);
    target.neighbors.add(source.id);
  }
  const root = byId.get('Stack') || nodes.find((node) => node.category === 'Main') || nodes[0];
  const visited = new Set();
  function visitComponent(start, depth) {
    start.depth = depth;
    visited.add(start.id);
    const queue = [start];
    for (const node of queue) {
      const neighbors = [...node.neighbors].sort((a, b) => {
        const ai = branchOrder.indexOf(a), bi = branchOrder.indexOf(b);
        return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi) || a.localeCompare(b, 'pt-BR');
      });
      for (const id of neighbors) {
        if (visited.has(id)) continue;
        const child = byId.get(id);
        child.depth = node.depth + 1;
        node.children.push(child);
        visited.add(id);
        queue.push(child);
      }
    }
  }
  visitComponent(root, 0);
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    root.children.push(node);
    visitComponent(node, 1);
  }
  function weigh(node) {
    node.weight = node.children.length ? node.children.reduce((sum, child) => sum + weigh(child), 0) : 1;
    return node.weight;
  }
  weigh(root);
  const positions = new Map();
  function place(node, start, end) {
    const angle = (start + end) / 2;
    positions.set(node.id, {
      x: Math.cos(angle) * node.depth * 120 * 2.1,
      y: Math.sin(angle) * node.depth * 120,
      depth: node.depth,
    });
    let current = start;
    for (const child of node.children) {
      const width = (end - start) * child.weight / node.weight;
      place(child, current, current + width);
      current += width;
    }
  }
  place(root, -Math.PI * .95, Math.PI * 1.05);
  return positions;
}
