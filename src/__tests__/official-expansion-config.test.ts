import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { resolve } from "node:path";

interface SourceConfig {
  sourceId: string;
  relativePath: string;
  expectedSha256: string;
  expectedByteLength: number;
}

describe("official corpus expansion config", () => {
  it("binds PDM-OT modules 3 and 4 to exact acquired bytes", async () => {
    const config = JSON.parse(await readFile("evals/real-corpus/official-expansion-config.json", "utf8")) as {
      schemaVersion: number;
      sources: SourceConfig[];
    };
    assert.equal(config.schemaVersion, 1);
    assert.deepEqual(config.sources.map((source) => source.sourceId), [
      "antigua-pdmot-module-3",
      "antigua-pdmot-module-4",
    ]);
    for (const source of config.sources) {
      const bytes = await readFile(resolve(".rag/library", source.relativePath));
      assert.equal(bytes.byteLength, source.expectedByteLength);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), source.expectedSha256);
    }
  });
});
