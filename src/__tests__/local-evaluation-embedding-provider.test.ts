import assert from "node:assert/strict";
import test from "node:test";
import {
  LocalEvaluationEmbeddingProvider,
  LOCAL_EVALUATION_EMBEDDING_DIMENSIONS,
  LOCAL_EVALUATION_EMBEDDING_MODEL,
  LOCAL_EVALUATION_EMBEDDING_PROVIDER,
} from "../embeddings/localEvaluationEmbeddingProvider.js";

test("local evaluation lexical hashing provider", async (t) => {
  await t.test("uses an explicit non-productive identity and fixed schema dimension", () => {
    const provider = new LocalEvaluationEmbeddingProvider();
    assert.equal(provider.providerName, LOCAL_EVALUATION_EMBEDDING_PROVIDER);
    assert.equal(provider.model, LOCAL_EVALUATION_EMBEDDING_MODEL);
    assert.equal(provider.dimensions, LOCAL_EVALUATION_EMBEDDING_DIMENSIONS);
    assert.equal(provider.dimensions, 1536);
  });

  await t.test("is deterministic, finite and normalized", async () => {
    const provider = new LocalEvaluationEmbeddingProvider();
    const [first, second] = await provider.embed(["licencia municipal de construcción", "licencia municipal de construcción"]);
    assert.deepEqual(first, second);
    assert.equal(first?.length, 1536);
    assert.ok(first?.every(Number.isFinite));
    const norm = Math.sqrt(first!.reduce((sum, value) => sum + value * value, 0));
    assert.ok(Math.abs(norm - 1) < 1e-12);
  });

  await t.test("distinguishes different lexical evidence", async () => {
    const provider = new LocalEvaluationEmbeddingProvider();
    const [planning, procedures] = await provider.embed([
      "ordenamiento territorial y uso del suelo",
      "manual de normas y procedimientos administrativos",
    ]);
    assert.notDeepEqual(planning, procedures);
  });

  await t.test("rejects empty or oversized batches", async () => {
    const provider = new LocalEvaluationEmbeddingProvider();
    await assert.rejects(provider.embed([]));
    await assert.rejects(provider.embed(Array.from({ length: 65 }, () => "texto")));
    await assert.rejects(provider.embed([" "]));
  });
});
