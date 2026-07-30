import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("procedure training console", () => {
  it("ships a semantic Spanish read-only academy shell without fake authentication", async () => {
    const html = await read("public/procedure-training.html");

    assert.match(html, /<html lang="es">/);
    assert.match(html, /href="#training-main"[^>]*>Saltar al contenido/);
    assert.match(html, /<main id="training-main"/);
    assert.match(html, /aria-label="Navegación principal de la academia"/);
    assert.match(html, /Vista pública de capacitación/);
    assert.match(html, /Entrenamiento local, no certificación institucional/);
    assert.match(html, /data-saas-only[^>]*disabled[^>]*aria-disabled="true"/);
    assert.match(html, /Requiere sesión SaaS aprobada/);
    assert.doesNotMatch(html, /<input[^>]+type="password"/i);
    assert.doesNotMatch(html, /onclick=|onchange=|onsubmit=/i);
  });

  it("contains exactly 47 ordered water research categories and marks them as non-facts", async () => {
    const map = JSON.parse(await read("public/data/water-training-map.json")) as {
      schema_version: string;
      module_id: string;
      research_not_facts: boolean;
      research_categories: Array<{ sequence: number; label: string; group_id: string }>;
      groups: Array<{ id: string; category_sequences: number[] }>;
    };

    assert.equal(map.schema_version, "v1");
    assert.equal(map.module_id, "water-community-antigua");
    assert.equal(map.research_not_facts, true);
    assert.equal(map.research_categories.length, 47);
    assert.deepEqual(map.research_categories.map((item) => item.sequence),
      Array.from({ length: 47 }, (_, index) => index + 1));
    assert.equal(new Set(map.research_categories.map((item) => item.label)).size, 47);
    assert.equal(map.research_categories[0]?.label, "Necesidad comunitaria");
    assert.equal(map.research_categories[46]?.label, "Calidad del servicio");
    assert.ok(map.groups.length >= 6 && map.groups.length <= 10);
    assert.deepEqual(
      map.groups.flatMap((group) => group.category_sequences),
      Array.from({ length: 47 }, (_, index) => index + 1)
    );
  });

  it("loads bounded procedure data, degrades safely and renders dynamic values without HTML injection", async () => {
    const script = await read("public/procedure-training.js");

    assert.match(script, /new URLSearchParams\(\{ q: module\.query, mode: "keyword", limit: "8", depth: "deep_dive" \}\)/);
    assert.match(script, /fetch\(`\/api\/procedure\?\$\{params\.toString\(\)\}`/);
    assert.match(script, /credentials: "omit"/);
    assert.match(script, /redirect: "error"/);
    assert.match(script, /dependency_failure/);
    assert.match(script, /validateCurriculum/);
    assert.match(script, /stepsForGroup/);
    assert.match(script, /aggregateEvidenceStatus/);
    assert.match(script, /categoryEvidence/);
    assert.match(script, /card\.dataset\.evidenceStatus = evidence\.status/);
    assert.match(script, /raw === "missing_evidence" \|\| citations\.length > 0 \? raw : "missing_evidence"/);
    assert.match(script, /participantEvidenceStatus === "supported" && stepCitations\.length > 0/);
    assert.match(script, /Documento o regla pendiente de localizar y validar\./);
    assert.match(script, /textContent =/);
    assert.doesNotMatch(script, /\.innerHTML\s*=|insertAdjacentHTML|document\.write/);
  });

  it("stores only bounded local learning progress and never browser credentials or case facts", async () => {
    const script = await read("public/procedure-training.js");

    assert.match(script, /la-muni-rag:training-progress:v1/);
    assert.match(script, /completed_lesson_ids/);
    assert.match(script, /localStorage\.setItem/);
    assert.match(script, /clearTrainingProgress/);
    assert.match(script, /try \{[\s\S]*localStorage\.setItem/);
    assert.match(script, /El navegador no permitió guardar progreso local/);
    assert.doesNotMatch(script, /authorization|bearer|api[_-]?key|access[_-]?token|refresh[_-]?token/i);
    assert.doesNotMatch(script, /case_context|provided_documents|subject_reference/);
  });

  it("exposes each lesson's procedure, evidence and learning semantics", async () => {
    const html = await read("public/procedure-training.html");
    const script = await read("public/procedure-training.js");

    for (const label of [
      "Acción investigada",
      "Participantes",
      "Documentos y salidas",
      "Decisiones y dependencias",
      "Riesgos y desconocidos",
      "Evidencia del paso",
      "Comprobación de aprendizaje",
    ]) assert.match(html, new RegExp(label));

    for (const status of [
      "supported",
      "inferred_for_review",
      "comparative_reference",
      "missing_evidence",
    ]) assert.match(script, new RegExp(status));
    assert.match(script, /Pendiente de evidencia/);
    assert.match(script, /Marcar como comprendido/);
    assert.doesNotMatch(script, /Marcar como completado|certificad[oa]|aprobación institucional/i);
  });

  it("wires the academy into the public entrypoint and Pages artifact", async () => {
    const [index, build, verify] = await Promise.all([
      read("public/index.html"),
      read("scripts/build-pages.mjs"),
      read("scripts/verify-pages-artifact.mjs"),
    ]);

    assert.match(index, /href="\.\/procedure-training\.html"[^>]*>Academia/);
    assert.match(build, /href="\/procedure-training\.html"/);
    assert.match(build, /href="\.\/procedure-training\.html"/);
    for (const file of [
      "procedure-training.html",
      "procedure-training.css",
      "procedure-training.js",
      "data/water-training-map.json",
    ]) assert.match(verify, new RegExp(file.replace(/[./]/g, "\\$&")));
    assert.match(verify, /requester_supplied_unverified/);
  });
});
