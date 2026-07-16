import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("procedure case workspace", () => {
  it("loads progressively from the existing procedure feedback entrypoint", async () => {
    const loader = await readSource("public/procedure-feedback.js");

    assert.match(loader, /procedure-case-workspace\.js/);
    assert.match(loader, /data-procedure-case-workspace/);
    assert.match(loader, /script\.async = false/);
  });

  it("uses a versioned local-only workspace schema", async () => {
    const source = await readSource("public/procedure-case-workspace.js");

    assert.match(source, /schemaVersion: 1/);
    assert.match(source, /la-muni-rag:procedure-case:/);
    assert.match(source, /localStorage\.setItem/);
    assert.match(source, /localStorage\.getItem/);
    assert.match(source, /localStorage\.removeItem/);
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|sendBeacon/);
  });

  it("tracks bounded operational states without claiming institutional approval", async () => {
    const source = await readSource("public/procedure-case-workspace.js");

    assert.match(source, /not_started/);
    assert.match(source, /in_progress/);
    assert.match(source, /blocked/);
    assert.match(source, /ready_for_review/);
    assert.match(source, /completed/);
    assert.match(source, /Completado operativo/);
    assert.match(source, /no evidencia legal/i);
    assert.match(source, /no equivale a aprobación/i);
    assert.match(source, /recepción, liquidación, pago o cierre institucional/i);
  });

  it("tracks documents, user-entered assignees, notes, and append-only audit events", async () => {
    const source = await readSource("public/procedure-case-workspace.js");

    assert.match(source, /operationalAssignee/);
    assert.match(source, /Ingresado por el usuario; no es autoridad extraída/);
    assert.match(source, /DOCUMENT_STATES/);
    assert.match(source, /missing/);
    assert.match(source, /requested/);
    assert.match(source, /received/);
    assert.match(source, /reviewed/);
    assert.match(source, /auditLog\.push/);
    assert.match(source, /workspace_created/);
    assert.match(source, /document_state_changed/);
  });

  it("validates and bounds imported JSON", async () => {
    const source = await readSource("public/procedure-case-workspace.js");

    assert.match(source, /MAX_IMPORT_BYTES = 250000/);
    assert.match(source, /validateWorkspace/);
    assert.match(source, /schemaVersion no soportado/);
    assert.match(source, /steps\.length > 100/);
    assert.match(source, /documents\.length > 200/);
    assert.match(source, /auditLog\.length > 300/);
    assert.match(source, /estado de paso inválido/);
    assert.match(source, /estado documental inválido/);
  });

  it("escapes dynamic content and warns against sensitive information", async () => {
    const source = await readSource("public/procedure-case-workspace.js");

    assert.match(source, /div\.textContent = String\(value \?\? ""\)/);
    assert.match(source, /esc\(currentWorkspace\.workflowSnapshot\.title\)/);
    assert.match(source, /esc\(step\.title\)/);
    assert.match(source, /No ingreses datos sensibles/);
    assert.match(source, /personales, confidenciales, reservados, credenciales o secretos/);
  });
});
