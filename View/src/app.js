import { layoutGraph } from './layout.js';
import { buildRevealTimeline } from './reveal.js';
import { stackDistances, compareStackDistance, labelOpacity, screenRadius, noteZoomTarget } from './graph-detail.js';
import { createFrameTask, zoomAtCenter } from './navigation.js';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';

const elements = new Map();
const $ = (selector) => {
  if (!elements.has(selector)) elements.set(selector, document.querySelector(selector));
  return elements.get(selector);
};
const fold = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
const routeUrl = (id) => `#${new URLSearchParams({ note: id })}`;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealRun = null;
let openingRun = null, viewEntry = null, zoomRun = null, filterEntry = null;
let data, nodes, orderedNodes, links, byId, categoryById, nodeSelection, coreSelection, textSelection, edgeSelection, zoomBehavior;
let activeCategory = null, visibleIds = new Set(), currentNote, hovered, graphFocus;
let animationFrame, layoutBounds, fittedScale = 1, hasFitted = false;
let lastFrame = 0, dimensions = { width: 0, height: 0 };
let detailScale = null, placementScale = null, graphInteracting = false, hasRouted = false;
const listLinks = new Map(), noteTemplates = new Map(), readerPositions = new Map();
const zoomTask = createFrameTask(renderZoom);
const filterTask = createFrameTask(() => filterNotes());
const drawTask = createFrameTask(() => draw(performance.now()));

async function start() {
  const moduleUrl = new URL(import.meta.url);
  const dataUrl = new URL('./vault.json', moduleUrl);
  const version = moduleUrl.searchParams.get('v');
  if (version) dataUrl.searchParams.set('v', version);
  const response = await fetch(dataUrl, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Não foi possível carregar as notas (${response.status}).`);
  data = await response.json();
  nodes = data.notes.map((note, index) => ({ ...note, searchTitle: fold(note.title), labelWidth: note.title.length * 5.7, phase: index * 2.39996 }));
  byId = new Map(nodes.map((node) => [node.id, node]));
  links = data.links.map((link) => ({ source: byId.get(link.source), target: byId.get(link.target) }));
  categoryById = new Map(data.categories.map((category) => [category.id, category]));
  for (const node of nodes) node.neighbors = new Set();
  for (const link of links) {
    link.source.neighbors.add(link.target.id);
    link.target.neighbors.add(link.source.id);
  }
  const distances = stackDistances(nodes, links);
  for (const node of nodes) node.stackDistance = distances.get(node.id);
  orderedNodes = [...nodes].sort(compareStackDistance);
  $('#total-badge').textContent = nodes.length;
  buildFilters();
  positionNodes();
  buildNoteList();
  buildGraph();
  bindControls();
  filterNotes();
  route();
  $('#announcement').textContent = `${nodes.length} notas disponíveis.`;
  if (!currentNote) replayAnimation();
}

function matchesCategory(node, category) {
  if (!category) return true;
  return category === 'Note' ? node.category === 'Note' : node.tags.includes(category);
}

function buildFilters() {
  for (const category of [{ id: 'all', label: 'Todas as notas', color: '#a2abb9' }, ...data.categories.filter((category) => !['Main', 'Note'].includes(category.id))]) {
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
  const positions = layoutGraph(nodes, links);
  for (const node of nodes) {
    Object.assign(node, positions.get(node.id));
    node.baseX = node.x;
    node.baseY = node.y;
  }
  layoutBounds = {
    minX: Math.min(...nodes.map((node) => node.x - 45)), maxX: Math.max(...nodes.map((node) => node.x + 45)),
    minY: Math.min(...nodes.map((node) => node.y - 22)), maxY: Math.max(...nodes.map((node) => node.y + 30)),
  };
}

function buildGraph() {
  const svg = select('#graph');
  zoomBehavior = zoom().scaleExtent([.15, 5])
    .on('start', (event) => {
      if (!event.sourceEvent) return;
      cancelZoom();
      graphInteracting = true;
      cancelAnimationFrame(animationFrame);
      highlight(null);
    })
    .on('zoom', (event) => zoomTask.schedule(event.transform))
    .on('end', (event) => {
      if (!event.sourceEvent) return;
      zoomTask.flush();
      if (placementScale !== $('#graph').__zoom.k) renderGraphDetails($('#graph').__zoom.k, true);
      graphInteracting = false;
      animate();
    });
  svg.call(zoomBehavior).on('dblclick.zoom', null);
  edgeSelection = select('#edges').selectAll('line').data(links).join('line').attr('class', 'edge');
  nodeSelection = select('#nodes').selectAll('g').data(nodes).join('g')
    .attr('class', (node) => `node${node.neighbors.size > 3 ? ' is-hub' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (node) => `${node.title}, ${categoryById.get(node.category).label}. Abrir nota.`)
    .style('--node-color', (node) => categoryById.get(node.category).color);
  coreSelection = nodeSelection.append('circle').attr('class', 'core').attr('r', (node) => screenRadius(node));
  textSelection = nodeSelection.append('text').attr('text-anchor', 'middle').text((node) => node.title);
  nodeSelection
    .on('pointerenter', (event, node) => highlight(node))
    .on('pointerleave', () => highlight(null))
    .on('focus', (event, node) => { if (event.currentTarget.matches(':focus-visible')) highlight(node); })
    .on('blur', () => highlight(null))
    .on('click', (event, node) => { if (!event.defaultPrevented) openNote(node.id, event.currentTarget); })
    .on('keydown', (event, node) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNote(node.id, event.currentTarget); }
    })
    .call(drag().container($('#graph-world')).on('start', () => {
      cancelZoom();
      graphInteracting = true;
      cancelAnimationFrame(animationFrame);
      $('#hover-card').hidden = true;
    }).on('drag', (event, node) => {
      node.baseX = event.x;
      node.baseY = event.y;
      drawTask.schedule();
    }).on('end', () => {
      drawTask.flush();
      graphInteracting = false;
      renderGraphDetails($('#graph').__zoom.k, true);
      animate();
    }));
  svg.on('pointermove', (event) => {
    if (hovered && !event.target.closest('.node')) highlight(null);
  }).on('pointerleave', () => highlight(null));
  new ResizeObserver(([entry]) => {
    const next = entry.contentRect;
    if (!next.width || !next.height) return;
    const sizeChanged = next.width !== dimensions.width || next.height !== dimensions.height;
    if (sizeChanged) { cancelNoteOpening(); cancelZoom(); }
    dimensions = { width: next.width, height: next.height };
    if (!hasFitted || (sizeChanged && !currentNote)) fitGraph();
  }).observe($('#graph-stage'));
  draw(performance.now());
  animate();
}

function renderZoom(transform) {
  select($('#graph-world')).attr('transform', transform);
  const percentage = `${Math.round(transform.k / fittedScale * 100)}%`;
  if ($('#zoom-level').textContent !== percentage) $('#zoom-level').textContent = percentage;
  // Panning only moves the camera; it never runs the label placement solver.
  if (detailScale !== transform.k) renderGraphDetails(transform.k);
  $('#hover-card').hidden = true;
}

function renderGraphDetails(scale, force = false) {
  const reposition = force || placementScale === null || Math.abs(Math.log(scale / placementScale)) > .09;
  if (reposition) {
    placeLabels(scale);
    placementScale = scale;
  }
  const relativeZoom = scale / fittedScale;
  coreSelection.attr('r', (node) => screenRadius(node, relativeZoom) / scale);
  textSelection.style('font-size', `${10.5 / scale}px`)
    .attr('x', (node) => node.label.dx / scale).attr('y', (node) => node.label.dy / scale)
    .attr('text-anchor', (node) => node.label.anchor);
  updateLabelVisibility(scale);
  if (revealRun) edgeSelection.style('stroke-width', `${1 / scale}px`);
  detailScale = scale;
}

function placeLabels(scale) {
  const relativeZoom = scale / fittedScale;
  const placed = [];
  const visible = nodes.filter((node) => visibleIds.has(node.id));
  const points = visible.map((node) => ({ node, x: node.baseX * scale, y: node.baseY * scale, radius: screenRadius(node, relativeZoom) + 3 }));
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (const node of orderedNodes) {
    const previous = node.label;
    node.label = { dx: 0, dy: screenRadius(node, relativeZoom) + 15, anchor: 'middle' };
    if (!visibleIds.has(node.id) || labelOpacity(node.stackDistance, relativeZoom) === 0) continue;
    const x = node.baseX * scale, y = node.baseY * scale, width = node.labelWidth;
    const offset = screenRadius(node, relativeZoom) + 7;
    const candidates = [[0, offset + 8, 'middle'], [0, -offset, 'middle'], [offset, 3, 'start'], [-offset, 3, 'end'],
      [offset, offset + 9, 'start'], [-offset, offset + 9, 'end'], [offset, -offset, 'start'], [-offset, -offset, 'end'],
      [0, offset + 22, 'middle'], [0, -offset - 15, 'middle']];
    if (previous) candidates.unshift([previous.dx, previous.dy, previous.anchor]);
    let best, score = Infinity;
    for (const [dx, dy, anchor] of candidates) {
      const left = x + dx - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
      const box = { left: left - 3, right: left + width + 3, top: y + dy - 10, bottom: y + dy + 3 };
      let penalty = placed.reduce((sum, other) => sum + overlap(box, other) * 1000, 0);
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
}

function updateLabelVisibility(scale) {
  textSelection
    .style('opacity', (node) => labelOpacity(node.stackDistance, scale / fittedScale))
    .style('visibility', (node) => labelOpacity(node.stackDistance, scale / fittedScale) > 0 ? null : 'hidden');
}
function fitGraph() {
  if (!layoutBounds || !dimensions.width || !dimensions.height) return;
  const width = layoutBounds.maxX - layoutBounds.minX;
  const height = layoutBounds.maxY - layoutBounds.minY;
  const paddingX = dimensions.width < 600 ? 48 : 75;
  const top = dimensions.width < 600 ? 32 : 48;
  const bottom = dimensions.width < 600 ? 105 : 65;
  const availableHeight = Math.max(100, dimensions.height - top - bottom);
  const scale = Math.max(.15, Math.min((dimensions.width - paddingX * 2) / width, availableHeight / height, 1.6));
  fittedScale = scale;
  detailScale = placementScale = null;
  zoomBehavior.scaleExtent([Math.min(.15, scale * .2), Math.max(5, scale * 8)]);
  const centerX = (layoutBounds.minX + layoutBounds.maxX) / 2;
  const centerY = (layoutBounds.minY + layoutBounds.maxY) / 2;
  select('#graph').call(zoomBehavior.transform, zoomIdentity.translate(dimensions.width / 2 - centerX * scale, top + availableHeight / 2 - centerY * scale).scale(scale));
  zoomTask.flush();
  hasFitted = true;
}

function draw(time) {
  for (const node of nodes) {
    const drift = revealRun || graphInteracting || reducedMotion.matches || hovered === node ? 0 : 1.8;
    node.drawX = node.baseX + Math.sin(time / 3300 + node.phase) * drift;
    node.drawY = node.baseY + Math.cos(time / 4000 + node.phase) * drift;
  }
  nodeSelection.attr('transform', (node) => `translate(${node.drawX},${node.drawY})`);
  edgeSelection.attr('x1', (link) => link.source.drawX).attr('y1', (link) => link.source.drawY)
    .attr('x2', (link) => link.target.drawX).attr('y2', (link) => link.target.drawY);
}

function animate(time = 0) {
  cancelAnimationFrame(animationFrame);
  if (revealRun || openingRun || zoomRun || graphInteracting || reducedMotion.matches || currentNote || document.hidden) return;
  if (time - lastFrame > 32) { draw(time); lastFrame = time; }
  animationFrame = requestAnimationFrame(animate);
}

function highlight(node) {
  if (openingRun) return;
  if (revealRun && node) return;
  if ((graphInteracting || zoomRun) && node) return;
  if (hovered === node) return;
  if (hovered) listLinks.get(hovered.id)?.classList.remove('is-highlighted');
  hovered = node;
  const neighbors = node?.neighbors;
  nodeSelection.classed('dim', (other) => Boolean(node && other !== node && !neighbors.has(other.id)));
  edgeSelection.classed('dim', (link) => Boolean(node && link.source !== node && link.target !== node))
    .classed('highlighted', (link) => Boolean(node && (link.source === node || link.target === node)));
  if (node) listLinks.get(node.id)?.classList.add('is-highlighted');
  $('#hover-card').hidden = !node;
  if (node) {
    $('#hover-title').textContent = node.title;
    $('#hover-category').textContent = categoryById.get(node.category).label;
    $('#hover-category').style.color = categoryById.get(node.category).color;
  }
}

function filterNotes() {
  filterTask.cancel();
  cancelNoteOpening();
  finishReveal();
  const query = fold($('#search').value.trim());
  const visible = orderedNodes.filter((node) => matchesCategory(node, activeCategory) && node.searchTitle.includes(query));
  document.querySelectorAll('#category-filters button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.category === (activeCategory || 'all')));
  });
  highlight(null);
  if (visible.length === visibleIds.size && visible.every((node) => visibleIds.has(node.id))) return;
  visibleIds = new Set(visible.map((node) => node.id));
  nodeSelection.style('display', (node) => visibleIds.has(node.id) ? null : 'none');
  edgeSelection.style('display', (link) => visibleIds.has(link.source.id) && visibleIds.has(link.target.id) ? null : 'none');
  renderGraphDetails($('#graph').__zoom?.k || fittedScale, true);
  $('#visible-notes').textContent = visible.length;
  $('#empty-state').hidden = visible.length > 0;
  for (const [id, link] of listLinks) link.hidden = !visibleIds.has(id);
  $('#note-list').scrollTop = 0;
  $('#list-empty').hidden = visible.length > 0;
  if (!reducedMotion.matches && !document.hidden && Element.prototype.animate) {
    const animation = $('#nodes').animate([{ opacity: .7 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    // A following filter replaces its visual transition instead of accumulating effects.
    filterEntry?.cancel();
    filterEntry = animation;
    animation.finished.then(() => { if (filterEntry === animation) filterEntry = null; }).catch(() => {});
  }
}

function buildNoteList() {
  const fragment = document.createDocumentFragment();
  for (const node of orderedNodes) {
    const link = noteLink(node);
    link.dataset.id = node.id;
    listLinks.set(node.id, link);
    fragment.append(link);
  }
  const empty = document.createElement('p');
  empty.id = 'list-empty';
  empty.className = 'list-empty';
  empty.textContent = 'Nenhuma nota encontrada.';
  empty.hidden = true;
  fragment.append(empty);
  $('#note-list').replaceChildren(fragment);
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

function cancelZoom() {
  if (!zoomRun) return;
  cancelAnimationFrame(zoomRun.frame);
  zoomRun = null;
  zoomTask.flush();
  animate();
}

function zoomBy(factor) {
  if (openingRun || currentNote) return;
  const from = $('#graph').__zoom || zoomIdentity;
  const target = zoomAtCenter(zoomRun?.target || from, factor, dimensions, zoomBehavior.scaleExtent());
  cancelZoom();
  highlight(null);
  const apply = (value) => {
    select($('#graph')).call(zoomBehavior.transform, zoomIdentity.translate(value.x, value.y).scale(value.k));
    zoomTask.flush();
  };
  if (reducedMotion.matches || document.hidden) { apply(target); return; }
  const run = { target, frame: null, start: performance.now() };
  zoomRun = run;
  cancelAnimationFrame(animationFrame);
  function step(time) {
    if (zoomRun !== run) return;
    const progress = Math.min(1, (time - run.start) / 180);
    const eased = 1 - (1 - progress) ** 3;
    apply({ k: from.k + (target.k - from.k) * eased, x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased });
    if (progress < 1) run.frame = requestAnimationFrame(step);
    else {
      zoomRun = null;
      renderGraphDetails(target.k, true);
      animate();
    }
  }
  run.frame = requestAnimationFrame(step);
}

function openNote(id, trigger) {
  const node = byId.get(id);
  if (!node || openingRun) return;
  if (trigger) graphFocus = trigger;
  filterTask.flush();
  cancelZoom();
  zoomTask.flush();
  drawTask.flush();
  filterEntry?.cancel();
  filterEntry = null;
  finishReveal();
  highlight(null);
  if (currentNote || reducedMotion.matches || document.hidden || !Element.prototype.animate) {
    location.hash = routeUrl(id);
    return;
  }
  const from = $('#graph').__zoom || zoomIdentity;
  const point = { x: node.drawX ?? node.baseX, y: node.drawY ?? node.baseY };
  const target = noteZoomTarget(point, from, dimensions, fittedScale, zoomBehavior.scaleExtent()[1]);
  const matrix = ({ k, x, y }) => `matrix(${k},0,0,${k},${x},${y})`;
  const run = { id, animation: null };
  openingRun = run;
  cancelAnimationFrame(animationFrame);
  $('#graph-view').inert = true;
  $('#graph-view').setAttribute('aria-busy', 'true');
  $('#hover-card').hidden = true;
  $('#announcement').textContent = `Aproximando de ${node.title}.`;
  run.animation = $('#graph-world').animate([
    { transform: matrix(from), opacity: 1 },
    { transform: matrix(target), opacity: .72 },
  ], { duration: 540, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
  run.animation.finished.then(() => {
    if (openingRun === run) location.hash = routeUrl(id);
  }).catch(() => {});
}

function cancelNoteOpening() {
  if (!openingRun) return;
  const run = openingRun;
  openingRun = null;
  run.animation?.cancel();
  $('#graph-view').inert = false;
  $('#graph-view').removeAttribute('aria-busy');
  animate();
}

function finishViewEntry() {
  viewEntry?.cancel();
  viewEntry = null;
}

function enterView(element, offset = 0) {
  if (reducedMotion.matches || document.hidden || !Element.prototype.animate) return;
  const entry = element.animate([
    { opacity: 0, transform: `translateY(${offset}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: 160, easing: 'ease-out' });
  viewEntry = entry;
  entry.finished.then(() => { if (viewEntry === entry) viewEntry = null; }).catch(() => {});
}

function renderNoteContent(note) {
  const content = $('#note-content');
  if (!noteTemplates.has(note.id)) {
    const template = document.createElement('template');
    // Only HTML sanitized by the build pipeline enters a template.
    template.innerHTML = note.html;
    const prepared = template.content;
    prepared.querySelectorAll('.note-tag').forEach((tag) => tag.remove());
    for (const paragraph of prepared.querySelectorAll('p')) {
      const prose = paragraph.cloneNode(true);
      prose.querySelectorAll('a[href^="#note="], .unresolved').forEach((link) => link.remove());
      if (!prose.textContent.trim() && !prose.querySelector('img, code, video, audio')) paragraph.remove();
    }
    prepared.querySelectorAll('a[href^="#note="], .unresolved').forEach((link) => link.replaceWith(...link.childNodes));
    for (const block of prepared.querySelectorAll('pre')) {
      if (!block.querySelector('code') || !navigator.clipboard) continue;
      const button = document.createElement('button');
      button.className = 'copy-code';
      button.textContent = 'Copiar';
      button.setAttribute('aria-label', 'Copiar bloco de código');
      block.prepend(button);
    }
    noteTemplates.set(note.id, prepared);
  }
  content.replaceChildren(noteTemplates.get(note.id).cloneNode(true));
}

function route() {
  if (currentNote) readerPositions.set(currentNote.id, $('#reader-scroll').scrollTop);
  filterTask.flush();
  cancelZoom();
  zoomTask.flush();
  drawTask.cancel();
  graphInteracting = false;
  const params = new URLSearchParams(location.hash.slice(1));
  const note = byId.get(params.get('note'));
  cancelNoteOpening();
  finishViewEntry();
  filterEntry?.cancel();
  filterEntry = null;
  const transition = hasRouted;
  hasRouted = true;
  if (note) {
    finishReveal();
    highlight(null);
    currentNote = note;
    cancelAnimationFrame(animationFrame);
    $('#graph-view').hidden = true;
    $('#reader-view').hidden = false;
    document.title = `${note.title} · DeveloperVault`;
    $('#reader-title').textContent = note.title;
    $('#reader-path').textContent = note.path;
    $('#reader-category').textContent = categoryById.get(note.category).label;
    $('#reader-category').style.color = categoryById.get(note.category).color;
    $('#source-link').href = `https://github.com/gabrielcrzojo/DeveloperVault/blob/main/${note.path.split('/').map(encodeURIComponent).join('/')}`;
    renderNoteContent(note);
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
    $('#reader-title').focus({ preventScroll: true });
    $('#reader-scroll').scrollTop = readerPositions.get(note.id) || 0;
    if (transition) enterView($('#reader-scroll'), 6);
    const heading = params.get('heading');
    const target = heading && document.getElementById(heading);
    if (target && $('#note-content').contains(target)) target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    $('#announcement').textContent = `Nota ${note.title} aberta.`;
  } else {
    const wasReading = Boolean(currentNote);
    currentNote = null;
    $('#reader-view').hidden = true;
    $('#graph-view').hidden = false;
    if (wasReading && transition) enterView($('#graph-stage'));
    document.title = 'DeveloperVault · Mapa de conhecimento';
    if (wasReading && graphFocus?.isConnected) graphFocus.focus({ preventScroll: true });
    highlight(null);
    if (params.has('note')) $('#announcement').textContent = 'Nota não encontrada. Escolha uma nota no mapa.';
    animate();
  }
}

function finishReveal() {
  if (!revealRun) return;
  const run = revealRun;
  revealRun = null;
  for (const animation of run.animations) animation.cancel();
  nodeSelection.style('pointer-events', null).attr('tabindex', 0);
  edgeSelection.attr('pathLength', null).style('stroke-dasharray', null)
    .style('vector-effect', null).style('stroke-width', null);
  $('#replay-animation').classList.remove('is-playing');
  animate();
}

function restoreGraphView() {
  cancelZoom();
  finishReveal();
  for (const node of nodes) { node.baseX = node.x; node.baseY = node.y; }
  draw(performance.now());
  fitGraph();
}

function replayAnimation() {
  // A replay always shows the complete map starting at Stack.
  activeCategory = null;
  $('#search').value = '';
  filterNotes();
  restoreGraphView();
  filterEntry?.cancel();
  filterEntry = null;
  if (!nodes.length || reducedMotion.matches || document.hidden || !Element.prototype.animate) return;
  const timeline = buildRevealTimeline(nodes, links);
  const run = { animations: [] };
  revealRun = run;
  cancelAnimationFrame(animationFrame);
  draw(performance.now());
  $('#replay-animation').classList.add('is-playing');
  $('#announcement').textContent = 'Construindo o mapa a partir da Stack.';
  nodeSelection.style('pointer-events', 'none').attr('tabindex', -1);
  nodeSelection.each(function(node) {
    const element = this;
    const delay = timeline.delays.get(node.id);
    const appearance = element.animate([{ opacity: 0 }, { opacity: 1 }], { delay, duration: 240, easing: 'ease-out', fill: 'both' });
    const growth = element.querySelector('.core').animate([{ transform: 'scale(0.12)' }, { transform: 'scale(1)' }], { delay, duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    run.animations.push(appearance, growth);
    appearance.finished.then(() => {
      if (revealRun !== run) return;
      element.style.removeProperty('pointer-events');
      element.setAttribute('tabindex', 0);
    }).catch(() => {});
  });
  // Normalize the dash in SVG coordinates while keeping its screen width.
  edgeSelection.attr('pathLength', 1).style('vector-effect', 'none')
    .style('stroke-width', `${1 / ($('#graph').__zoom?.k || fittedScale)}px`)
    .style('stroke-dasharray', '1 1').each(function(link, index) {
    const { delay, duration, reverse } = timeline.edges[index];
    run.animations.push(this.animate([
      { strokeDashoffset: reverse ? '-1' : '1', opacity: 1 },
      { strokeDashoffset: '0', opacity: 1 },
    ], { delay, duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }));
  });
  Promise.allSettled(run.animations.map((animation) => animation.finished)).then(() => {
    if (revealRun !== run) return;
    finishReveal();
    $('#announcement').textContent = `${nodes.length} notas disponíveis. Animação concluída.`;
  });
}

function bindControls() {
  $('#search').addEventListener('input', (event) => { if (!event.isComposing) filterTask.schedule(); });
  $('#search').addEventListener('compositionend', () => filterTask.schedule());
  const list = $('#note-list');
  list.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-id]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openNote(link.dataset.id, link);
  });
  list.addEventListener('pointerover', (event) => {
    const link = event.target.closest('a[data-id]');
    if (link && !link.contains(event.relatedTarget)) highlight(byId.get(link.dataset.id));
  });
  list.addEventListener('pointerout', (event) => {
    const link = event.target.closest('a[data-id]');
    if (link && !link.contains(event.relatedTarget)) highlight(null);
  });
  list.addEventListener('focusin', (event) => {
    const link = event.target.closest('a[data-id]');
    if (link?.matches(':focus-visible')) highlight(byId.get(link.dataset.id));
  });
  list.addEventListener('focusout', () => highlight(null));
  $('#note-content').addEventListener('click', async (event) => {
    const button = event.target.closest('.copy-code');
    if (!button) return;
    const code = button.closest('pre').querySelector('code');
    try {
      await navigator.clipboard.writeText(code.textContent);
      if (button.isConnected) button.textContent = 'Copiado';
    } catch { if (button.isConnected) button.textContent = 'Não foi possível copiar'; }
    setTimeout(() => { if (button.isConnected) button.textContent = 'Copiar'; }, 2000);
  });
  $('#clear-filters').addEventListener('click', () => {
    $('#search').value = '';
    activeCategory = null;
    filterNotes();
    $('#search').focus();
  });
  $('#zoom-in').addEventListener('click', () => zoomBy(1.3));
  $('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.3));
  $('#replay-animation').addEventListener('click', replayAnimation);
  reducedMotion.addEventListener('change', () => {
    const pendingId = openingRun?.id;
    cancelNoteOpening();
    cancelZoom();
    finishViewEntry();
    filterEntry?.cancel();
    filterEntry = null;
    finishReveal();
    draw(performance.now());
    if (pendingId) location.hash = routeUrl(pendingId);
    animate();
  });
  $('#back-to-graph').addEventListener('click', () => { location.hash = ''; });
  $('.brand').addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    cancelNoteOpening();
    cancelZoom();
    if (currentNote) location.hash = '';
    else highlight(null);
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('blur', () => highlight(null));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      const pendingId = openingRun?.id;
      cancelNoteOpening();
      cancelZoom();
      zoomTask.flush();
      drawTask.cancel();
      graphInteracting = false;
      finishViewEntry();
      filterEntry?.cancel();
      filterEntry = null;
      finishReveal();
      if (pendingId) location.hash = routeUrl(pendingId);
    }
    animate();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cancelZoom();
      if (openingRun) {
        cancelNoteOpening();
        highlight(null);
        graphFocus?.focus({ preventScroll: true });
        $('#announcement').textContent = 'Abertura cancelada.';
      } else if (currentNote) location.hash = '';
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
