import { MODES, MODE_LABELS, FLOW_EDGES, requestedModes, text, readPublicResponse, projectFlow, edgeState, connectorGeometry } from './glass-wall-flow.js';

const $ = (id) => document.getElementById(id);
const approvedEndpointPaths = ['/api/public/v1/query'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const state = { query: $('glass-wall-query').value, mode: 'hybrid', phase: 'idle', routes: [], run: 0 };
const arrowColors = { inactive: 'var(--line)', pending: 'var(--hot)', executed: 'var(--hot)', warning: 'var(--warn)', error: 'var(--error)' };
let controller;
let frame = 0;

const element = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
};
const nodeState = (id, value, status) => {
  const node = $(id);
  node.dataset.state = status;
  node.querySelector('.node-value').textContent = value;
};
const routeLabel = (route) => !route ? 'No ejecutada' : route.status === 'pending' ? 'En curso' :
  route.status === 'error' ? 'No completada' : `${route.citations.length} fragmentos recibidos`;

function prepareMarkers() {
  const defs = $('glass-wall-markers');
  for (const [status, color] of Object.entries(arrowColors)) {
    const marker = document.createElementNS(SVG_NS, 'marker');
    for (const [key, value] of Object.entries({ id: `gw-arrow-${status}`, markerWidth: 8, markerHeight: 8,
      refX: 10, refY: 5, orient: 'auto', viewBox: '0 0 10 10', markerUnits: 'userSpaceOnUse' })) {
      marker.setAttribute(key, String(value));
    }
    const arrow = document.createElementNS(SVG_NS, 'path');
    arrow.setAttribute('d', 'M0,0 L10,5 L0,10 Z');
    arrow.setAttribute('fill', color);
    arrow.classList.add('arrow-head');
    marker.append(arrow);
    defs.append(marker);
  }
}

function renderEdges() {
  const board = $('glass-wall-board');
  const box = board.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const vertical = window.matchMedia('(max-width: 760px)').matches;
  board.dataset.orientation = vertical ? 'vertical' : 'horizontal';
  const svg = $('glass-wall-edges');
  svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  const paths = $('glass-wall-paths');
  const view = projectFlow(state.routes, state.phase);
  const relative = (id) => {
    const rect = $(id).getBoundingClientRect();
    return { x: rect.left - box.left, y: rect.top - box.top, width: rect.width, height: rect.height };
  };
  for (const [from, to, kind] of FLOW_EDGES) {
    const geometry = connectorGeometry(relative(from), relative(to), vertical);
    if (!geometry) continue;
    const status = edgeState(kind, state.routes, view);
    let path = paths.querySelector(`[data-from="${from}"][data-to="${to}"]`);
    if (!path) { path = document.createElementNS(SVG_NS, 'path'); path.classList.add('edge'); paths.append(path); }
    path.dataset.from = from;
    path.dataset.to = to;
    path.dataset.kind = kind;
    path.dataset.state = status;
    path.setAttribute('d', geometry.d);
    path.setAttribute('marker-end', `url(#gw-arrow-${status})`);
  }
}
function scheduleEdges() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; renderEdges(); });
}

function renderCitations(view) {
  const list = $('evidence-list');
  const fragments = $('fragment-list');
  list.replaceChildren();
  fragments.replaceChildren();
  if (!view.citations.length) {
    const copy = view.result === 'idle' ? 'Ejecuta una consulta para ver sus documentos de respaldo.' :
      view.result === 'loading' ? 'Buscando fragmentos en los documentos disponibles…' :
      view.result === 'error' ? 'La consulta no se completó. No se puede concluir que falten documentos.' :
      view.result === 'partial' ? 'Una ruta falló y la otra no devolvió fragmentos. El resultado está incompleto.' :
      'No se recuperaron fragmentos citables para esta consulta. Prueba términos más específicos; esto no demuestra que la información no exista.';
    list.append(element('p', 'empty-copy', copy));
  }
  view.citations.forEach((citation, index) => {
    const id = `evidence-${index + 1}`;
    const row = element('article', 'evidence-item');
    row.id = id;
    row.tabIndex = -1;
    row.append(element('h3', '', `${index + 1}. ${citation.citationLabel}`));
    row.append(element('p', '', citation.excerpt));
    const source = element('a', '', 'Abrir documento oficial ↗');
    source.href = citation.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    row.append(source, element('small', '', `Devuelta por: ${citation.returnedBy.map((mode) => MODE_LABELS[mode]).join(' + ')}.`));
    list.append(row);
    const li = element('li');
    const link = element('a', 'fragment-link');
    link.id = `node-evidence-${index + 1}`;
    link.href = `#${id}`;
    link.setAttribute('aria-label', `Ver fragmento ${index + 1}: ${citation.citationLabel}`);
    link.append(element('span', 'fragment-number', String(index + 1).padStart(2, '0')), element('span', '', 'Ver fragmento'));
    link.addEventListener('click', () => { requestAnimationFrame(() => row.focus({ preventScroll: true })); });
    li.append(link);
    fragments.append(li);
  });
  $('node-not-found').hidden = view.citations.length > 0;
  $('node-not-found').textContent = view.result === 'idle' ? 'Todavía no hay una consulta ejecutada.' :
    view.result === 'loading' ? 'Esperando resultados.' : view.result === 'error' || view.result === 'partial' ? 'Resultado no confirmado.' : 'No hay fragmentos para esta consulta.';
  $('sources-caption').textContent = view.citations.length ? `${view.citations.length} fragmentos · ${view.documentCount} documentos distintos` :
    view.result === 'idle' ? 'Aquí podrás revisar las citas recuperadas.' : view.label;
}

function render() {
  const view = projectFlow(state.routes, state.phase);
  document.body.dataset.flowState = view.result;
  $('glass-wall-graph').setAttribute('aria-busy', String(view.result === 'loading'));
  const pill = $('glass-wall-status');
  pill.className = `status-pill ${view.result}`;
  pill.textContent = view.label;
  $('glass-wall-submit').disabled = view.result === 'loading';
  $('glass-wall-submit').textContent = view.result === 'loading' ? 'Buscando…' : 'Inspeccionar ruta';
  $('metric-evidence-count').textContent = String(view.citations.length);
  $('metric-document-count').textContent = String(view.documentCount);
  $('metric-answer-status').textContent = view.label;
  $('node-mode').textContent = MODE_LABELS[state.mode];
  const stepState = edgeState('merge', state.routes, view);
  nodeState('node-query', state.phase === 'idle' ? 'En espera' : text(state.query, 160), state.phase === 'idle' ? 'inactive' : 'executed');
  for (const mode of MODES) nodeState(`node-${mode}`, routeLabel(state.routes.find((route) => route.mode === mode)), edgeState(mode, state.routes, view));
  nodeState('node-merge', view.result === 'idle' || view.result === 'loading' ? 'Esperando resultados' :
    view.result === 'error' ? 'No se pudo reunir evidencia' : `${view.citations.length} fragmentos sin duplicados`, stepState);
  nodeState('node-citation', view.result === 'idle' || view.result === 'loading' ? 'En espera' : `${view.citations.length} fragmentos disponibles`, stepState);
  nodeState('node-answer', view.label, view.result === 'error' ? 'error' : stepState);
  const origins = {
    unconfirmed: 'Sin ejecución confirmada. No se infiere la salud del servidor.',
    static: 'Consulta local sobre la copia pública de documentos. No fue necesario consultar al servidor para obtener estos resultados.',
    remote: 'Respuesta recibida del servicio público. Esta consulta no certifica la salud general del sistema.',
    mixed: 'Se combinaron respuestas del servicio y de la copia pública local. Revisa las fuentes y los límites de cada resultado.',
  };
  $('runtime-copy').textContent = origins[view.source];
  $('node-audit').textContent = view.source === 'static' ? 'Esta ruta local no acredita una auditoría del servidor.' : 'No se confirma un registro de auditoría del servidor desde esta vista.';
  const routes = $('execution-list');
  routes.replaceChildren();
  for (const mode of MODES) {
    const route = state.routes.find((item) => item.mode === mode);
    const li = element('li');
    const badge = element('span', 'route-badge', routeLabel(route));
    badge.dataset.state = edgeState(mode, state.routes, view);
    li.append(element('span', '', MODE_LABELS[mode]), badge);
    routes.append(li);
  }
  const descriptions = {
    idle: 'Escribe una consulta y sigue las flechas. Ninguna ruta aparece completada antes de recibir su resultado.',
    loading: 'La consulta está en curso. Las líneas discontinuas indican pasos aún sin completar; no se muestran resultados anteriores.',
    success: `${view.executedModes.map((mode) => MODE_LABELS[mode]).join(' + ')} → resultados reunidos → ${view.citations.length} fragmentos citables. Son referencias documentales, no una conclusión jurídica automática.`,
    empty: 'Las rutas completadas no devolvieron evidencia suficiente. La ausencia de resultados no confirma que una norma o documento no exista.',
    partial: 'Sólo se muestran resultados de las rutas completadas. Una búsqueda no terminó; este resultado es parcial y puedes reintentarlo.',
    error: 'La búsqueda no se completó. No se presenta como una consulta sin hallazgos ni se atribuye actividad a componentes internos.',
  };
  $('flow-caption').textContent = descriptions[view.result];
  const error = $('glass-wall-error');
  error.hidden = !['error', 'partial'].includes(view.result);
  error.textContent = error.hidden ? '' : state.routes.some((route) => route.code === 'rate_limited') ?
    'Se alcanzó el límite de consultas. Espera antes de reintentar.' :
    'No se completaron todos los métodos de búsqueda. Revisa la conexión y vuelve a intentarlo.';
  renderCitations(view);
  scheduleEdges();
}

async function queryRoute(message, mode, signal) {
  const path = approvedEndpointPaths[0];
  let timer;
  let onAbort;
  const local = new AbortController();
  const work = async () => {
    const response = await fetch(path, { method: 'POST', credentials: 'omit', signal: local.signal,
      headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ message, mode, limit: 5 }) });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : 'query_unavailable');
    if (!response.body) throw new Error('invalid_public_response');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let raw = '', size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536 || local.signal.aborted) {
          await reader.cancel();
          throw new Error('invalid_public_response');
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    const source = response.headers.get('x-la-muni-rag-static-fallback') === 'true' ? 'static' : 'remote';
    return readPublicResponse(JSON.parse(raw), mode, source);
  };
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => { local.abort(); reject(new Error('query_timeout')); }, 12000);
    onAbort = () => { local.abort(); reject(new Error('query_cancelled')); };
    if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([work(), expiry]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}

async function inspect() {
  if (!$('glass-wall-form').reportValidity()) return;
  const query = $('glass-wall-query').value.trim();
  const mode = $('glass-wall-mode').value;
  if (!query || !requestedModes(mode).length) return;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const run = ++state.run;
  state.query = query; state.mode = mode; state.phase = 'loading';
  state.routes = requestedModes(mode).map((item) => ({ mode: item, status: 'pending' }));
  render();
  const routes = await Promise.all(requestedModes(mode).map(async (item) => {
    try { return await queryRoute(query, item, signal); }
    catch (error) { return { mode: item, status: 'error', code: error?.message === 'rate_limited' ? 'rate_limited' : 'query_unavailable' }; }
  }));
  if (run !== state.run) return;
  state.routes = routes; state.phase = 'complete';
  render();
}

$('glass-wall-form').addEventListener('submit', (event) => { event.preventDefault(); void inspect(); });
window.addEventListener('resize', scheduleEdges);
prepareMarkers();
const observer = new ResizeObserver(scheduleEdges);
observer.observe($('glass-wall-board'));
for (const id of new Set(FLOW_EDGES.flatMap(([from, to]) => [from, to]))) observer.observe($(id));
document.fonts?.ready.then(scheduleEdges);
render();
