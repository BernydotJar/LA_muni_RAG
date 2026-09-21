/** Public contract projection only, not an internal server trace. */
export const MODES = Object.freeze(['keyword', 'phrase']);
export const MODE_LABELS = Object.freeze({ keyword: 'Palabras clave', phrase: 'Frase exacta', hybrid: 'Combinado' });
export const FLOW_EDGES = Object.freeze([
  ['node-query', 'node-phrase', 'phrase'],
  ['node-query', 'node-keyword', 'keyword'],
  ['node-phrase', 'node-merge', 'phrase'],
  ['node-keyword', 'node-merge', 'keyword'],
  ['node-merge', 'node-citation', 'merge'],
  ['node-citation', 'node-answer', 'answer'],
]);
export const requestedModes = (mode) => mode === 'hybrid' ? [...MODES] : MODES.includes(mode) ? [mode] : [];
export const text = (value, limit = 240) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export const safeSourceUrl = (value) => {
  try {
    if (typeof value !== 'string' || value.length > 2048) return null;
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
};

/** Reject malformed success data instead of labeling it a valid empty result. */
export function readPublicResponse(payload, mode, source = 'remote') {
  const invalid = () => { throw new Error('invalid_public_response'); };
  if (!MODES.includes(mode) || !payload || payload.schema_version !== 'v1' || payload.response_type !== 'public_query') invalid();
  const meta = payload.meta;
  if (!meta || !['evidence_found', 'insufficient_evidence', 'not_found'].includes(meta.responseLabel) ||
      !Array.isArray(meta.executedModes) || !meta.executedModes.includes(mode) ||
      meta.executedModes.some((item) => !MODES.includes(item)) || !Array.isArray(payload.citations) || payload.citations.length > 5 ||
      !Number.isInteger(meta.evidenceCount) || meta.evidenceCount !== payload.citations.length) invalid();
  if ((meta.responseLabel === 'not_found' && payload.citations.length) ||
      (meta.responseLabel === 'evidence_found' && !payload.citations.length)) invalid();
  const citations = payload.citations.map((citation) => {
    const sourceUrl = safeSourceUrl(citation?.sourceUrl);
    const citationLabel = text(citation?.citationLabel, 240);
    const excerpt = text(citation?.excerpt, 1200);
    if (!sourceUrl || !citationLabel || !excerpt) invalid();
    return { sourceUrl, citationLabel, excerpt };
  });
  return { mode, status: 'complete', source: source === 'static' ? 'static' : 'remote', label: meta.responseLabel,
    executedModes: [...new Set(meta.executedModes)], citations };
}

/** Fair display interleave, not an invented relevance ranking. */
export function projectFlow(routes = [], phase = 'idle') {
  const complete = routes.filter((route) => route.status === 'complete');
  const failed = routes.filter((route) => route.status === 'error');
  const pending = routes.some((route) => route.status === 'pending');
  const canShow = phase !== 'idle' && phase !== 'loading' && !pending;
  const citations = [];
  if (canShow) {
    const seen = new Map();
    for (let i = 0; i < 5; i += 1) {
      for (const route of complete) {
        const item = route.citations[i];
        if (!item) continue;
        const key = JSON.stringify([item.sourceUrl, item.citationLabel, item.excerpt]);
        const existing = seen.get(key);
        if (existing) { if (!existing.returnedBy.includes(route.mode)) existing.returnedBy.push(route.mode); continue; }
        const entry = { ...item, returnedBy: [route.mode] };
        seen.set(key, entry);
        if (citations.length < 5) citations.push(entry);
      }
    }
  }
  const result = phase === 'idle' ? 'idle' : phase === 'loading' || pending ? 'loading' :
    !complete.length ? 'error' : failed.length ? 'partial' : citations.length ? 'success' : 'empty';
  const hasLimitedEvidence = complete.some((route) => route.label === 'insufficient_evidence');
  const labels = { idle: 'Lista para consultar', loading: 'Buscando documentos', success: hasLimitedEvidence ? 'Evidencia limitada' : 'Fuentes encontradas',
    empty: 'Sin evidencia suficiente', partial: 'Resultado parcial', error: 'Consulta no disponible' };
  const source = !canShow || !complete.length ? 'unconfirmed' : complete.every((route) => route.source === 'static') ? 'static' :
    complete.every((route) => route.source === 'remote') ? 'remote' : 'mixed';
  const sources = new Set(citations.map((item) => { const url = new URL(item.sourceUrl); url.hash = ''; return url.href; }));
  return { result, label: labels[result], citations, documentCount: sources.size, source,
    executedModes: complete.flatMap((route) => route.executedModes).filter((mode, index, array) => array.indexOf(mode) === index),
    failedModes: failed.map((route) => route.mode), hasLimitedEvidence };
}

export function edgeState(kind, routes, view) {
  if (MODES.includes(kind)) {
    const route = routes.find((item) => item.mode === kind);
    return !route ? 'inactive' : route.status === 'complete' ? 'executed' : route.status === 'error' ? 'error' : 'pending';
  }
  if (view.result === 'idle') return 'inactive';
  if (view.result === 'loading') return 'pending';
  if (view.result === 'error') return 'inactive';
  return ['partial', 'empty'].includes(view.result) || view.hasLimitedEvidence ? 'warning' : 'executed';
}

/** Rectangles are board-relative; arrow tips remain outside target borders. */
export function connectorGeometry(from, to, vertical = false) {
  const values = [from?.x, from?.y, from?.width, from?.height, to?.x, to?.y, to?.width, to?.height];
  if (!values.every(Number.isFinite) || from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) return null;
  const start = vertical ? { x: from.x + from.width / 2, y: from.y + from.height + 3 } : { x: from.x + from.width + 3, y: from.y + from.height / 2 };
  const end = vertical ? { x: to.x + to.width / 2, y: to.y - 6 } : { x: to.x - 6, y: to.y + to.height / 2 };
  const delta = vertical ? end.y - start.y : end.x - start.x;
  if (delta <= 0) return null;
  const bend = Math.max(4, delta * 0.5);
  const c1 = vertical ? `${start.x},${start.y + bend}` : `${start.x + bend},${start.y}`;
  const c2 = vertical ? `${end.x},${end.y - bend}` : `${end.x - bend},${end.y}`;
  return { start, end, d: `M${start.x},${start.y} C${c1} ${c2} ${end.x},${end.y}` };
}
