import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';

const $ = (selector) => document.querySelector(selector);
const fold = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
const routeUrl = (id) => `#${new URLSearchParams({ note: id })}`;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
let data, nodes, links, byId, categoryById, nodeSelection, edgeSelection, zoomBehavior;
let activeCategory = null, visibleIds = new Set(), currentNote, hovered, graphFocus;
let animationFrame, layoutBounds, fittedScale = 1, hasFitted = false;
let lastFrame = 0, dimensions = { width: 0, height: 0 };

async function start() {
  const response = await fetch('./vault.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Não foi possível carregar as notas (${response.status}).`);
  data = await response.json();
  nodes = data.notes.map((note, index) => ({ ...note, phase: index * 2.39996 }));
  links = data.links.map((link) => ({ ...link }));
  byId = new Map(nodes.map((node) => [node.id, node]));
  categoryById = new Map(data.categories.map((category) => [category.id, category]));
  for (const node of nodes) node.neighbors = new Set();
  for (const link of links) {
    byId.get(link.source).neighbors.add(link.target);
    byId.get(link.target).neighbors.add(link.source);
  }
  $('#total-badge').textContent = nodes.length;
  buildFilters();
  positionNodes();
  buildGraph();
  bindControls();
  filterNotes();
  route();
  $('#announcement').textContent = `${nodes.length} notas disponíveis.`;
}

function matchesCategory(node, category) {
  if (!category) return true;
  return category === 'Note' ? node.category === 'Note' : node.tags.includes(category);
}

function buildFilters() {
  for (const category of [{ id: 'all', label: 'Todas as notas', color: '#a2abb9' }, ...data.categories]) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'category-row';
    label.style.setProperty('--category', category.color);
    label.dataset.category = category.id;
    label.setAttribute('aria-pressed', String(category.id === 'all'));
    label.addEventListener('click', () => {
      activeCategory = category.id === 'all' ? null : category.id;
      filterNotes();
    });
    const dot = document.createElement('span');
    dot.className = 'category-dot';
    const text = document.createElement('span');
    text.textContent = category.label;
    const count = document.createElement('span');
    count.className = 'category-count';
    count.textContent = nodes.filter((node) => matchesCategory(node, category.id === 'all' ? null : category.id)).length;
    label.append(dot, text, count);
    $('#category-filters').append(label);
  }
}

function positionNodes() {
  if (!nodes.length) return;
  const root = byId.get('Stack') || nodes.find((node) => node.category === 'Main') || nodes[0];
  const visited = new Set([root.id]);
  const queue = [root];
  root.depth = 0;
  for (const node of nodes) node.children = [];
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    const priority = ['Tools', 'Frontend', 'Concepts', 'Documentation', 'DataBase', 'Backend', 'AI'];
    const neighbors = [...node.neighbors].sort((a, b) => {
      const ai = priority.indexOf(a), bi = priority.indexOf(b);
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
  for (const node of nodes) {
    if (!visited.has(node.id)) { node.depth = 1; root.children.push(node); }
  }
  const weight = (node) => { node.weight = node.children.length ? node.children.reduce((sum, child) => sum + weight(child), 0) : 1; return node.weight; };
  weight(root);
  function layout(node, start, end) {
    const angle = (start + end) / 2;
    node.x = Math.cos(angle) * node.depth * 120;
    node.y = Math.sin(angle) * node.depth * 120;
    node.anchorX = node.x;
    node.anchorY = node.y;
    let current = start;
    for (const child of node.children) {
      const width = (end - start) * child.weight / node.weight;
      layout(child, current, current + width);
      current += width;
    }
  }
  layout(root, -Math.PI * .95, Math.PI * 1.05);
  root.fx = 0;
  root.fy = 0;
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id((node) => node.id).distance(85).strength(.65))
    .force('charge', forceManyBody().strength(-220))
    .force('collision', forceCollide((node) => Math.max(22, node.title.length * 2.4)).iterations(3))
    .force('x', forceX((node) => node.anchorX).strength(.085))
    .force('y', forceY((node) => node.anchorY).strength(.085))
    .stop();
  simulation.tick(280);
  for (const node of nodes) { node.x *= 2.1; node.baseX = node.x; node.baseY = node.y; }
  layoutBounds = {
    minX: Math.min(...nodes.map((node) => node.x - 45)), maxX: Math.max(...nodes.map((node) => node.x + 45)),
    minY: Math.min(...nodes.map((node) => node.y - 22)), maxY: Math.max(...nodes.map((node) => node.y + 30)),
  };
}

function buildGraph() {
  const svg = select('#graph');
  zoomBehavior = zoom().scaleExtent([.15, 5]).on('zoom', (event) => {
    select('#graph-world').attr('transform', event.transform);
    $('#zoom-level').textContent = `${Math.round(event.transform.k / fittedScale * 100)}%`;
    const scale = event.transform.k;
    if (nodeSelection) {
      placeLabels(scale);
      nodeSelection.select('.core').attr('r', (node) => radius(node) / scale).style('stroke-width', `${3 / scale}px`);
      nodeSelection.select('.halo').attr('r', (node) => (radius(node) + 10) / scale);
    }
    $('#hover-card').hidden = true;
  });
  svg.call(zoomBehavior).on('dblclick.zoom', null);
  edgeSelection = select('#edges').selectAll('line').data(links).join('line').attr('class', 'edge');
  nodeSelection = select('#nodes').selectAll('g').data(nodes).join('g')
    .attr('class', (node) => `node${node.neighbors.size > 3 ? ' is-hub' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (node) => `${node.title}, ${categoryById.get(node.category).label}. Abrir nota.`)
    .style('--node-color', (node) => categoryById.get(node.category).color);
  nodeSelection.append('circle').attr('class', 'halo').attr('r', (node) => node.category === 'Main' ? 24 : 17);
  nodeSelection.append('circle').attr('class', 'core').attr('r', radius);
  nodeSelection.append('text').attr('text-anchor', 'middle').attr('y', (node) => radius(node) + 17).text((node) => node.title);
  nodeSelection
    .on('pointerenter', (event, node) => highlight(node))
    .on('pointerleave', () => highlight(null))
    .on('focus', (event, node) => highlight(node))
    .on('blur', () => highlight(null))
    .on('click', (event, node) => { if (!event.defaultPrevented) openNote(node.id, event.currentTarget); })
    .on('keydown', (event, node) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNote(node.id, event.currentTarget); }
    })
    .call(drag().container($('#graph-world')).on('start', () => { $('#hover-card').hidden = true; })
      .on('drag', (event, node) => { node.baseX = event.x; node.baseY = event.y; draw(performance.now()); }));
  new ResizeObserver(([entry]) => {
    const next = entry.contentRect;
    if (!next.width || !next.height) return;
    const sizeChanged = next.width !== dimensions.width || next.height !== dimensions.height;
    dimensions = { width: next.width, height: next.height };
    if (!hasFitted || (sizeChanged && !currentNote)) fitGraph();
  }).observe($('#graph-stage'));
  draw(performance.now());
  syncMotionButton();
  animate();
}

function radius(node) { return node.category === 'Main' ? 8 : node.category === 'Class' ? 5.5 : 4; }
function placeLabels(scale) {
  const placed = [];
  const points = nodes.map((node) => ({ node, x: node.baseX * scale, y: node.baseY * scale, radius: radius(node) + 3 }));
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (const node of [...nodes].sort((a, b) => b.neighbors.size - a.neighbors.size)) {
    const x = node.baseX * scale, y = node.baseY * scale, width = node.title.length * 5.7;
    const offset = radius(node) + 7;
    const candidates = [[0, offset + 8, 'middle'], [0, -offset, 'middle'], [offset, 3, 'start'], [-offset, 3, 'end'],
      [offset, offset + 9, 'start'], [-offset, offset + 9, 'end'], [offset, -offset, 'start'], [-offset, -offset, 'end'],
      [0, offset + 22, 'middle'], [0, -offset - 15, 'middle']];
    let best, score = Infinity;
    for (const [dx, dy, anchor] of candidates) {
      const left = x + dx - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
      const box = { left: left - 3, right: left + width + 3, top: y + dy - 10, bottom: y + dy + 3 };
      let penalty = placed.reduce((sum, other) => sum + overlap(box, other), 0);
      for (const point of points) {
        if (point.node === node) continue;
        penalty += overlap(box, { left: point.x - point.radius, right: point.x + point.radius, top: point.y - point.radius, bottom: point.y + point.radius });
      }
      if (penalty < score) { best = { dx, dy, anchor, box }; score = penalty; }
      if (penalty === 0) break;
    }
    node.label = best;
    placed.push(best.box);
  }
  nodeSelection.select('text').style('font-size', `${10.5 / scale}px`)
    .attr('x', (node) => node.label.dx / scale).attr('y', (node) => node.label.dy / scale)
    .attr('text-anchor', (node) => node.label.anchor)
    .style('visibility', (node) => dimensions.width < 600 && scale / fittedScale < 1.7 && node.depth > 2 && hovered !== node ? 'hidden' : null);
}
function fitGraph() {
  if (!layoutBounds || !dimensions.width || !dimensions.height) return;
  const width = layoutBounds.maxX - layoutBounds.minX;
  const height = layoutBounds.maxY - layoutBounds.minY;
  const paddingX = dimensions.width < 600 ? 48 : 75;
  const top = dimensions.height < 500 ? 100 : 125;
  const bottom = dimensions.width < 600 ? 105 : 65;
  const availableHeight = Math.max(100, dimensions.height - top - bottom);
  const scale = Math.max(.15, Math.min((dimensions.width - paddingX * 2) / width, availableHeight / height, 1.6));
  fittedScale = scale;
  const centerX = (layoutBounds.minX + layoutBounds.maxX) / 2;
  const centerY = (layoutBounds.minY + layoutBounds.maxY) / 2;
  select('#graph').call(zoomBehavior.transform, zoomIdentity.translate(dimensions.width / 2 - centerX * scale, top + availableHeight / 2 - centerY * scale).scale(scale));
  hasFitted = true;
}

function draw(time) {
  for (const node of nodes) {
    const drift = motionPaused || reducedMotion.matches || hovered === node ? 0 : 1.8;
    node.drawX = node.baseX + Math.sin(time / 3300 + node.phase) * drift;
    node.drawY = node.baseY + Math.cos(time / 4000 + node.phase) * drift;
  }
  nodeSelection.attr('transform', (node) => `translate(${node.drawX},${node.drawY})`);
  edgeSelection.attr('x1', (link) => link.source.drawX).attr('y1', (link) => link.source.drawY)
    .attr('x2', (link) => link.target.drawX).attr('y2', (link) => link.target.drawY);
}

function animate(time = 0) {
  cancelAnimationFrame(animationFrame);
  if (motionPaused || reducedMotion.matches || currentNote || document.hidden) return;
  if (time - lastFrame > 32) { draw(time); lastFrame = time; }
  animationFrame = requestAnimationFrame(animate);
}

function highlight(node) {
  hovered = node;
  if (dimensions.width < 600 && nodeSelection) {
    const scale = $('#graph').__zoom?.k || fittedScale;
    nodeSelection.select('text').style('visibility', (other) => scale / fittedScale < 1.7 && other.depth > 2 && other !== node ? 'hidden' : null);
  }
  const neighbors = node?.neighbors;
  nodeSelection.classed('dim', (other) => Boolean(node && other !== node && !neighbors.has(other.id)));
  edgeSelection.classed('dim', (link) => Boolean(node && link.source !== node && link.target !== node))
    .classed('highlighted', (link) => Boolean(node && (link.source === node || link.target === node)));
  document.querySelectorAll('.note-list a').forEach((link) => link.classList.toggle('is-highlighted', link.dataset.id === node?.id));
  $('#hover-card').hidden = !node;
  if (node) {
    $('#hover-title').textContent = node.title;
    $('#hover-category').textContent = categoryById.get(node.category).label;
    $('#hover-category').style.color = categoryById.get(node.category).color;
    $('#hover-description').textContent = `${Math.max(1, Math.ceil(node.words / 200))} min de leitura`;
  }
}

function filterNotes() {
  const query = fold($('#search').value.trim());
  const visible = nodes.filter((node) => matchesCategory(node, activeCategory) && fold(node.title).includes(query));
  document.querySelectorAll('#category-filters button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.category === (activeCategory || 'all')));
  });
  visibleIds = new Set(visible.map((node) => node.id));
  nodeSelection.style('display', (node) => visibleIds.has(node.id) ? null : 'none');
  edgeSelection.style('display', (link) => visibleIds.has(link.source.id) && visibleIds.has(link.target.id) ? null : 'none');
  $('#visible-notes').textContent = visible.length;
  $('#empty-state').hidden = visible.length > 0;
  highlight(null);
  const list = $('#note-list');
  list.replaceChildren();
  const sorted = [...visible].sort((a, b) => (a.id === 'Stack' ? -1 : b.id === 'Stack' ? 1 : a.title.localeCompare(b.title, 'pt-BR')));
  for (const node of sorted) {
    const link = noteLink(node);
    link.dataset.id = node.id;
    link.addEventListener('mouseenter', () => highlight(node));
    link.addEventListener('mouseleave', () => highlight(null));
    link.addEventListener('focus', () => highlight(node));
    link.addEventListener('blur', () => highlight(null));
    link.addEventListener('click', () => { graphFocus = link; });
    list.append(link);
  }
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'list-empty';
    empty.textContent = 'Nenhuma nota encontrada.';
    list.append(empty);
  }
}

function noteLink(node) {
  const link = document.createElement('a');
  link.href = routeUrl(node.id);
  link.style.setProperty('--category', categoryById.get(node.category).color);
  const dot = document.createElement('span');
  dot.className = 'category-dot';
  const title = document.createElement('span');
  title.textContent = node.title;
  link.append(dot, title);
  return link;
}

function openNote(id, trigger) {
  if (trigger) graphFocus = trigger;
  location.hash = routeUrl(id);
}

function route() {
  const params = new URLSearchParams(location.hash.slice(1));
  const note = byId.get(params.get('note'));
  if (note) {
    currentNote = note;
    cancelAnimationFrame(animationFrame);
    $('#graph-view').hidden = true;
    $('#reader-view').hidden = false;
    document.title = `${note.title} · DeveloperVault`;
    $('#reader-title').textContent = note.title;
    $('#reader-path').textContent = note.path;
    $('#reader-category').textContent = categoryById.get(note.category).label;
    $('#reader-category').style.color = categoryById.get(note.category).color;
    $('#reader-meta').textContent = `${Math.max(1, Math.ceil(note.words / 200))} min de leitura`;
    $('#source-link').href = `https://github.com/gabrielcrzojo/DeveloperVault/blob/main/${note.path.split('/').map(encodeURIComponent).join('/')}`;
    // Only the HTML sanitized by the build pipeline reaches this container.
    $('#note-content').innerHTML = note.html;
    $('#related-notes').replaceChildren();
    for (const id of [...note.neighbors].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
      const link = noteLink(byId.get(id));
      const arrow = document.createElement('span');
      arrow.textContent = '↗';
      arrow.setAttribute('aria-hidden', 'true');
      link.append(arrow);
      $('#related-notes').append(link);
    }
    $('#related-section').hidden = note.neighbors.size === 0;
    for (const block of document.querySelectorAll('#note-content pre')) {
      const code = block.querySelector('code');
      if (!code || !navigator.clipboard) continue;
      const button = document.createElement('button');
      button.className = 'copy-code';
      button.textContent = 'Copiar';
      button.setAttribute('aria-label', 'Copiar bloco de código');
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          button.textContent = 'Copiado';
        } catch { button.textContent = 'Não foi possível copiar'; }
        setTimeout(() => { button.textContent = 'Copiar'; }, 2000);
      });
      block.prepend(button);
    }
    $('#reader-scroll').scrollTop = 0;
    $('#reader-title').focus({ preventScroll: true });
    const heading = params.get('heading');
    const target = heading && document.getElementById(heading);
    if (target && $('#note-content').contains(target)) target.scrollIntoView();
    $('#announcement').textContent = `Nota ${note.title} aberta.`;
  } else {
    const wasReading = Boolean(currentNote);
    currentNote = null;
    $('#reader-view').hidden = true;
    $('#graph-view').hidden = false;
    document.title = 'DeveloperVault · Mapa de conhecimento';
    if (wasReading && graphFocus?.isConnected) graphFocus.focus({ preventScroll: true });
    if (params.has('note')) $('#announcement').textContent = 'Nota não encontrada. Escolha uma nota no mapa.';
    animate();
  }
}

function syncMotionButton() {
  const paused = motionPaused || reducedMotion.matches;
  $('#toggle-motion').setAttribute('aria-pressed', String(paused));
  $('#toggle-motion').setAttribute('aria-label', paused ? 'Ativar movimento' : 'Pausar movimento');
  $('#toggle-motion').title = paused ? 'Ativar movimento' : 'Pausar movimento';
  $('#toggle-motion svg').innerHTML = paused ? '<path d="m9 5 10 7-10 7Z"/>' : '<path d="M9 6v12M15 6v12"/>';
}

function bindControls() {
  $('#search').addEventListener('input', filterNotes);
  $('#clear-filters').addEventListener('click', () => {
    $('#search').value = '';
    activeCategory = null;
    filterNotes();
    $('#search').focus();
  });
  $('#zoom-in').addEventListener('click', () => select('#graph').call(zoomBehavior.scaleBy, 1.3));
  $('#zoom-out').addEventListener('click', () => select('#graph').call(zoomBehavior.scaleBy, 1 / 1.3));
  $('#reset-view').addEventListener('click', () => {
    for (const node of nodes) { node.baseX = node.x; node.baseY = node.y; }
    draw(performance.now());
    fitGraph();
  });
  $('#toggle-motion').addEventListener('click', () => {
    if (reducedMotion.matches) {
      $('#announcement').textContent = 'Movimento reduzido pela preferência do sistema.';
      return;
    }
    motionPaused = !motionPaused;
    syncMotionButton();
    draw(performance.now());
    animate();
  });
  reducedMotion.addEventListener('change', () => { motionPaused = reducedMotion.matches; syncMotionButton(); draw(performance.now()); animate(); });
  $('#back-to-graph').addEventListener('click', () => { location.hash = ''; });
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => animate());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (currentNote) location.hash = '';
      else { highlight(null); $('#search').blur(); }
    }
    if (event.key === '/' && !currentNote && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#search').focus(); }
  });
}

start().catch((error) => {
  console.error(error);
  $('#graph-error').hidden = false;
  $('#graph-error').textContent = 'Não foi possível abrir o cofre. Recarregue a página para tentar novamente.';
});
