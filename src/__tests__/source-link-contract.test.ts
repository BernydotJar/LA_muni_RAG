import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("corpus source link contract", () => {
  it("allows evidence items and hybrid candidates to carry source URLs", async () => {
    const evidence = await readSource("src/evidence.ts");
    const types = await readSource("src/retrieval/types.ts");

    assert.match(evidence, /sourceUrl\?: string \| null/);
    assert.match(evidence, /const optionalSourceUrl/);
    assert.match(evidence, /sourceUrl: optionalSourceUrl\(result\)/);
    assert.match(evidence, /sourceUrl: optionalSourceUrl\(candidate\)/);
    assert.match(types, /sourceUrl\?: string \| null/);
  });

  it("passes source URLs through chat citations", async () => {
    const chat = await readSource("src/chat.ts");

    assert.match(chat, /export interface ChatCitation/);
    assert.match(chat, /sourceUrl\?: string \| null/);
    assert.match(chat, /sourceUrl: e\.sourceUrl \?\? null/);
  });

  it("keeps widget source actions honest", async () => {
    const widget = await readSource("public/widget.js");

    assert.match(widget, /function safeSourceHref/);
    assert.match(widget, /citation\?\.sourceUrl/);
    assert.match(widget, /Abrir fuente/);
    assert.match(widget, /Fuente no enlazada/);
    assert.doesNotMatch(widget, /PDM-OT.*\.pdf/);
  });

  it("documents that PDF viewer is gated on stable corpus links", async () => {
    const requirements = await readSource("specs/031-corpus-document-links-and-pdf-page-viewer/requirements.md");
    const design = await readSource("specs/031-corpus-document-links-and-pdf-page-viewer/design.md");

    assert.match(requirements, /Do not invent links/);
    assert.match(requirements, /No fake PDF link generation/);
    assert.match(design, /Never infer source URLs from document names/);
    assert.match(design, /modal document viewer/);
  });
});
