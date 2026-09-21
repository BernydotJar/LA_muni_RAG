import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

const flow = await import(pathToFileURL(join(process.cwd(), 'public/glass-wall-flow.js')).href);
const citation = (id = 1, document = 'pdm') => ({ citationLabel: `PDM-OT, página ${id}`, sourceUrl: `https://muniantigua.gob.gt/${document}.pdf#page=${id}`, excerpt: `Fragmento público de agua ${id}` });
const payload = (mode = 'keyword', citations = [citation()], label = citations.length ? 'evidence_found' : 'not_found') => ({ schema_version: 'v1', response_type: 'public_query', citations, meta: { responseLabel: label, evidenceCount: citations.length, executedModes: [mode] } });
const route = (mode = 'keyword', citations = [citation()], source = 'static') => flow.readPublicResponse(payload(mode, citations), mode, source);

describe('EVAL-GLASS-WALL-FLOW-001 — directional observable public flow', () => {
  it('defines a forward five-stage topology without internal vector or audit routes', () => {
    const stages: Record<string, number> = { 'node-query': 0, 'node-phrase': 1, 'node-keyword': 1, 'node-merge': 2, 'node-citation': 3, 'node-answer': 4 };
    assert.equal(flow.FLOW_EDGES.length, 6);
    for (const [from, to] of flow.FLOW_EDGES) assert.ok(stages[from] < stages[to]);
    assert.doesNotMatch(JSON.stringify(flow.FLOW_EDGES), /vector|embedding|audit|node-db/);
  });
  it('does not mark a selected route executed before receiving evidence of completion', () => {
    const idle = flow.projectFlow([], 'idle');
    for (const [, , kind] of flow.FLOW_EDGES) assert.equal(flow.edgeState(kind, [], idle), 'inactive');
    const routes = [{ mode: 'keyword', status: 'pending' }];
    const loading = flow.projectFlow(routes, 'loading');
    assert.equal(flow.edgeState('keyword', routes, loading), 'pending');
    assert.equal(flow.edgeState('phrase', routes, loading), 'inactive');
    assert.equal(loading.citations.length, 0);
  });
  it('keeps an unrequested phrase route inactive even when keyword returns five citations', () => {
    const routes = [route('keyword', [1, 2, 3, 4, 5].map((id) => citation(id)))];
    const result = flow.projectFlow(routes, 'complete');
    assert.equal(flow.edgeState('phrase', routes, result), 'inactive');
    assert.equal(flow.edgeState('keyword', routes, result), 'executed');
    assert.equal(result.label, 'Fuentes encontradas');
    assert.equal(result.documentCount, 1);
  });
  it('distinguishes a completed empty route from a transport failure', () => {
    const routes = [route('keyword', [])];
    const empty = flow.projectFlow(routes, 'complete');
    assert.equal(empty.result, 'empty');
    assert.equal(flow.edgeState('keyword', routes, empty), 'executed');
    assert.equal(flow.projectFlow([{ mode: 'keyword', status: 'error' }], 'complete').result, 'error');
  });
  it('retains only successful citations and marks a partial response incomplete', () => {
    const routes = [route(), { mode: 'phrase', status: 'error' }];
    const partial = flow.projectFlow(routes, 'complete');
    assert.equal(partial.result, 'partial');
    assert.equal(partial.citations.length, 1);
    assert.deepEqual(partial.failedModes, ['phrase']);
    assert.equal(flow.edgeState('phrase', routes, partial), 'error');
    assert.equal(flow.edgeState('answer', routes, partial), 'warning');
  });
  it('interleaves and deduplicates citations without inventing scores', () => {
    const routes = [route('keyword', [citation(1), citation(2), citation(3)]), route('phrase', [citation(1), citation(4, 'mod3'), citation(5, 'mod3')])];
    const result = flow.projectFlow(routes, 'complete');
    assert.equal(result.citations.length, 5);
    assert.deepEqual(result.citations[0].returnedBy, ['keyword', 'phrase']);
    assert.equal(result.citations[2].citationLabel, 'PDM-OT, página 4');
    assert.equal(result.documentCount, 2);
    assert.equal(result.citations.some((item: Record<string, unknown>) => 'score' in item), false);
  });
  it('clears previous evidence in loading and idle states', () => {
    for (const phase of ['loading', 'idle']) assert.equal(flow.projectFlow([route()], phase).citations.length, 0);
  });
  it('records static, remote and mixed origins, never a server-audit claim', () => {
    assert.equal(flow.projectFlow([route()], 'complete').source, 'static');
    assert.equal(flow.projectFlow([route('keyword', [citation()], 'remote')], 'complete').source, 'remote');
    const mixed = flow.projectFlow([route(), route('phrase', [], 'remote')], 'complete');
    assert.equal(mixed.source, 'mixed');
    assert.equal('serverAudit' in mixed, false);
  });
  it('preserves insufficient-evidence semantics', () => {
    const limited = flow.readPublicResponse(payload('keyword', [citation()], 'insufficient_evidence'), 'keyword');
    const view = flow.projectFlow([limited], 'complete');
    assert.equal(view.label, 'Evidencia limitada');
    assert.equal(flow.edgeState('answer', [limited], view), 'warning');
  });
  it('fails closed on malformed or contradictory public response metadata', () => {
    const samples = [null, {}, { ...payload(), response_type: 'private' }, { ...payload(), citations: null },
      { ...payload(), meta: { ...payload().meta, evidenceCount: 9 } },
      { ...payload(), meta: { ...payload().meta, executedModes: ['vector'] } },
      payload('keyword', [citation()], 'not_found'), payload('keyword', [], 'evidence_found')];
    for (const sample of samples) assert.throws(() => flow.readPublicResponse(sample, 'keyword'), /invalid_public_response/);
  });
  it('validates source links and bounds text, leaving markup inert', () => {
    for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', '//example.com', 'data:text/plain,test']) assert.equal(flow.safeSourceUrl(url), null);
    const item = { ...citation(), citationLabel: '<b>Texto, no HTML</b>' };
    assert.equal(flow.readPublicResponse(payload('keyword', [item]), 'keyword').citations[0].citationLabel, item.citationLabel);
    assert.equal(flow.text('x'.repeat(999), 160).length, 160);
    assert.throws(() => flow.readPublicResponse(payload('keyword', [{ ...citation(), sourceUrl: 'http://bad.example' }]), 'keyword'));
  });
  it('places horizontal arrow tips outside both node borders', () => {
    const geometry = flow.connectorGeometry({ x: 20, y: 40, width: 100, height: 80 }, { x: 180, y: 90, width: 100, height: 50 });
    assert.deepEqual(geometry.start, { x: 123, y: 80 });
    assert.deepEqual(geometry.end, { x: 174, y: 115 });
    assert.match(geometry.d, /^M123,80 C/);
  });
  it('places vertical arrow tips at downward-facing boundary ports', () => {
    const geometry = flow.connectorGeometry({ x: 20, y: 40, width: 100, height: 80 }, { x: 5, y: 180, width: 150, height: 60 }, true);
    assert.deepEqual(geometry.start, { x: 70, y: 123 });
    assert.deepEqual(geometry.end, { x: 80, y: 174 });
  });
  it('rejects invalid geometry instead of emitting NaN or backward paths', () => {
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(flow.connectorGeometry(rect, rect), null);
    assert.equal(flow.connectorGeometry({ ...rect, width: NaN }, rect), null);
    assert.equal(flow.connectorGeometry({ ...rect, height: 0 }, rect), null);
  });
  it('keeps DOM rendering safe and request fencing explicit', async () => {
    const view = await readFile('public/glass-wall-view.js', 'utf8');
    assert.doesNotMatch(view, /\.innerHTML\s*=|insertAdjacentHTML|eval\(/);
    assert.match(view, /run !== state\.run/);
    assert.match(view, /credentials: 'omit'/);
    assert.match(view, /ResizeObserver/);
    assert.match(view, /marker-end/);
    assert.match(view, /orient: 'auto'/);
    assert.match(view, /x-la-muni-rag-static-fallback/);
  });
});
