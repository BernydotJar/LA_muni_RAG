import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readBackfillCli = (): Promise<string> => readFile("src/cli/backfillCorpus.ts", "utf-8");

describe("backfill corpus CLI type narrowing", () => {
  it("uses a concrete validated args type instead of assertion-only narrowing", async () => {
    const source = await readBackfillCli();

    assert.match(source, /export type ValidBackfillCorpusArgs/);
    assert.match(source, /const toValidBackfillCorpusArgs/);
    assert.match(source, /const validArgs = toValidBackfillCorpusArgs\(args\)/);
    assert.match(source, /runBackfillCorpusDryRun\(validArgs, runtimeMetadata\)/);
    assert.doesNotMatch(source, /asserts args is/);
  });

  it("keeps manifest and document arguments required after validation", async () => {
    const source = await readBackfillCli();

    assert.match(source, /manifestPath: string/);
    assert.match(source, /inputPath: string/);
    assert.match(source, /documentKey: string/);
    assert.match(source, /documentVersion: string/);
    assert.match(source, /new JsonFileCorpusManifestStore\(validArgs\.manifestPath\)/);
    assert.match(source, /buildDocumentInput\(validArgs, runtimeMetadata\)/);
  });
});
