import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-MISSING-001 — explicit no-evidence and gap behavior", () => {
  it("tests unknown procedures without invented actors, deadlines, systems or citations", async () => {
    const [apiTest, mapperTest] = await Promise.all([
      read("src/__tests__/procedure-query-api-v1.test.ts"),
      read("src/__tests__/procedure-query-mapper-v1.test.ts"),
    ]);
    assert.match(mapperTest, /procedureType:\s*"unknown"/);
    assert.match(mapperTest, /step\?\.evidence_status, "missing_evidence"/);
    assert.match(mapperTest, /responsible_actor, null/);
    assert.match(mapperTest, /responsible_unit, null/);
    assert.match(mapperTest, /external_system, null/);
    assert.match(mapperTest, /deadline, null/);
    assert.match(apiTest, /firstStep\?\.evidence_status, "missing_evidence"/);
    assert.match(mapperTest, /missing_evidence/);
    assert.match(mapperTest, /citations[^\n]*\[\]/);
  });

  it("downgrades incomplete, inactive, private or unprocessed documentary records", async () => {
    const [mapper, tests] = await Promise.all([
      read("src/api/v1/mapper.ts"),
      read("src/__tests__/procedure-query-mapper-v1.test.ts"),
    ]);
    assert.match(mapper, /missing_evidence/);
    assert.match(mapper, /documentStatus/);
    assert.match(mapper, /versionExtractionStatus/);
    assert.match(mapper, /confidentiality/);
    assert.match(mapper, /citation_refs/);
    assert.match(mapper, /official_for_target_jurisdiction/);
    assert.match(tests, /repealed|inactive|private|unprocessed/i);
  });

  it("preserves an immutable research intake instead of claiming a gap is resolved", async () => {
    const [schema, mapper, migration] = await Promise.all([
      read("contracts/schemas/v1/evidence-gap-response.schema.json"),
      read("src/api/v1/evidenceGapMapper.ts"),
      read("db/migrations/012_evidence_gap_requests.sql"),
    ]);
    assert.match(schema, /"status"\s*:\s*\{[\s\S]*"const"\s*:\s*"open"/);
    assert.match(schema, /requester_supplied_unverified/);
    assert.doesNotMatch(schema, /"resolved"\s*:\s*true/);
    assert.match(mapper, /requester_supplied_unverified/);
    assert.match(migration, /status[^\n]*'open'/i);
  });

  it("keeps comparative evidence below target-official authority", async () => {
    const [mapper, mixcoEval] = await Promise.all([
      read("src/api/v1/mapper.ts"),
      read("src/__tests__/eval-mixco-001.test.ts"),
    ]);
    assert.match(mapper, /comparative_reference/);
    assert.match(mapper, /official_for_target_jurisdiction/);
    assert.match(mapper, /Referencia comparativa de la Municipalidad de Mixco/);
    assert.match(mapper, /No define por sí sola el procedimiento oficial de Antigua Guatemala/);
    assert.match(mixcoEval, /mandatory warning|advertencia|warning/i);
  });

  it("documents that real-corpus gap resolution and notification remain open", async () => {
    const state = await read("program/current-state.md");
    assert.match(state, /EvidenceGap is intake-only/i);
    assert.match(state, /no research assignment, resolution lifecycle/i);
    assert.match(state, /minimum Antigua-first and comparative corpus is incomplete/i);
  });
});
