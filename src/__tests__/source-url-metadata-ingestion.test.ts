import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("source URL metadata ingestion", () => {
  it("uses existing schema source URL columns instead of adding a migration", async () => {
    const schema = await readSource("db/migrations/001_initial_rag_schema.sql");
    const requirements = await readSource("specs/032-corpus-source-url-metadata-ingestion/requirements.md");

    assert.match(schema, /CREATE TABLE rag\.documents/);
    assert.match(schema, /source_url TEXT/);
    assert.match(schema, /CREATE TABLE rag\.document_versions/);
    assert.match(requirements, /No database migration/);
  });

  it("selects source URLs from version first and document second in search", async () => {
    const search = await readSource("src/search.ts");

    assert.match(search, /sourceUrl\?: string \| null/);
    assert.match(search, /COALESCE\(v\.source_url, d\.source_url\) AS source_url/);
    assert.match(search, /const rowSourceUrl/);
    assert.match(search, /sourceUrl: rowSourceUrl\(row\)/);
  });

  it("preserves source URLs through evidence, vector, and chat contracts", async () => {
    const evidence = await readSource("src/evidence.ts");
    const vector = await readSource("src/retrieval/vectorRetriever.ts");
    const chat = await readSource("src/chat.ts");

    assert.match(evidence, /sourceUrl: optionalSourceUrl\(result\)/);
    assert.match(evidence, /sourceUrl: optionalSourceUrl\(candidate\)/);
    assert.match(vector, /sourceUrl\?: string \| null/);
    assert.match(vector, /sourceUrl: candidate\.sourceUrl \?\? null/);
    assert.match(chat, /sourceUrl: e\.sourceUrl \?\? null/);
  });

  it("documents the viewer boundary", async () => {
    const design = await readSource("specs/032-corpus-source-url-metadata-ingestion/design.md");

    assert.match(design, /does not derive PDF links from titles/);
    assert.match(design, /does not expose `storage_uri`/);
    assert.match(design, /PDF viewer remains out of scope/);
  });
});
