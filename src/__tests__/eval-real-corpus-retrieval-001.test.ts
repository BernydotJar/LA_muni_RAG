import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("evals/real-corpus/retrieval-cases.json", "utf8"));
const receipt = JSON.parse(readFileSync("evals/real-corpus/results/retrieval-eval-receipt.json", "utf8"));
const evaluator = readFileSync("src/cli/evaluateRealCorpusRetrieval.ts", "utf8");
const verifier = readFileSync("src/cli/verifyRealCorpusRetrievalEvidence.ts", "utf8");
const runner = readFileSync("scripts/run-real-corpus-retrieval-eval.sh", "utf8");
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

const modes = ["phrase", "keyword", "vector_lexical", "hybrid"];

test("EVAL-REAL-CORPUS-RETRIEVAL-001", async (t) => {
  await t.test("freezes eight positive and four no-answer cases before final measurement", () => {
    assert.equal(config.schemaVersion, 1);
    assert.equal(config.cases.filter((item: any) => item.kind === "evidence").length, 8);
    assert.equal(config.cases.filter((item: any) => item.kind === "no_answer").length, 4);
    assert.equal(new Set(config.cases.map((item: any) => item.id)).size, 12);
    assert.equal(config.evaluation.calibration.pilotReceiptExcludedFromEvidence, true);
    assert.equal(config.evaluation.calibration.finalThresholdFrozenBeforeFinalMeasurement, true);
  });

  await t.test("binds the query set to the exact ingested PDM-OT corpus", () => {
    assert.equal(config.corpus.documentKey, "antigua-pdm-ot");
    assert.equal(config.corpus.documentVersion, "official-municipal-pdf-2026-06-22");
    assert.equal(config.corpus.contentSha256, "824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b");
    assert.equal(config.corpus.expectedChunks, 444);
    assert.deepEqual(receipt.corpus, config.corpus);
    assert.equal(receipt.environment.persistedChunks, 444);
    assert.equal(receipt.environment.persistedDocuments, 1);
  });

  await t.test("executes genuine phrase, keyword, lexical-vector and hybrid retrieval", () => {
    assert.match(evaluator, /phraseto_tsquery\('spanish'/);
    assert.match(evaluator, /websearch_to_tsquery\('spanish'/);
    assert.match(evaluator, /TenantPgVectorRepository/);
    assert.match(evaluator, /buildHybridRetrievalResult/);
    assert.deepEqual(config.evaluation.modes, modes);
    assert.deepEqual(Object.keys(receipt.metrics), modes);
  });

  await t.test("passes no-answer and cross-document leakage gates in every mode", () => {
    assert.equal(receipt.safetyGatePassed, true);
    for (const mode of modes) {
      assert.equal(receipt.metrics[mode].values.unsupportedAnswerRate, 0);
      assert.equal(receipt.metrics[mode].values.crossDocumentLeakageRate, 0);
      assert.equal(receipt.metrics[mode].checks.unsupportedAnswerRate, true);
      assert.equal(receipt.metrics[mode].checks.crossDocumentLeakageRate, true);
    }
    for (const testCase of receipt.cases.filter((item: any) => item.kind === "no_answer")) {
      for (const mode of modes) assert.equal(testCase.modes[mode].answerEligible, false);
    }
  });

  await t.test("records measured quality instead of converting gaps into a pass", () => {
    assert.equal(receipt.evaluationStatus, "measured_with_quality_gaps");
    assert.equal(receipt.qualityTargetsPassed, false);
    assert.equal(receipt.metrics.vector_lexical.passed, true);
    assert.equal(receipt.metrics.phrase.passed, false);
    assert.equal(receipt.metrics.keyword.passed, false);
    assert.equal(receipt.metrics.hybrid.passed, false);
    assert.deepEqual({
      phrase: receipt.metrics.phrase.values.hitAt5,
      keyword: receipt.metrics.keyword.values.hitAt5,
      vector_lexical: receipt.metrics.vector_lexical.values.hitAt5,
      hybrid: receipt.metrics.hybrid.values.hitAt5,
    }, { phrase: 0.75, keyword: 0.75, vector_lexical: 0.75, hybrid: 0.875 });
  });

  await t.test("uses explicit lexical hashing and makes no semantic or productive claim", () => {
    assert.equal(receipt.provider.name, "local-eval-hashing");
    assert.equal(receipt.provider.model, "token-bigram-hash-1536-v1");
    assert.equal(receipt.provider.classification, "deterministic_lexical_hashing");
    assert.equal(receipt.provider.semanticModel, false);
    assert.equal(receipt.provider.productiveProvider, false);
    assert.equal(receipt.limitations.semanticRetrievalClaim, false);
    assert.equal(receipt.limitations.productionSloClaim, false);
  });

  await t.test("keeps the result bounded to one document and twelve judged cases", () => {
    assert.equal(receipt.querySet.positiveCases, 8);
    assert.equal(receipt.querySet.noAnswerCases, 4);
    assert.equal(receipt.cases.length, 12);
    assert.equal(receipt.limitations.corpusDocuments, 1);
    assert.equal(receipt.limitations.corpusCompletenessClaim, false);
    assert.equal(receipt.limitations.legalCorrectnessClaim, false);
    assert.equal(receipt.limitations.generalizationBeyondCases, false);
    assert.equal(receipt.limitations.dmpNoTextExcluded, true);
  });

  await t.test("uses a disposable tenant-scoped PostgreSQL and pgvector runtime", () => {
    assert.match(receipt.environment.postgresVersion, /^15\.18/);
    assert.equal(receipt.environment.pgvectorVersion, "0.8.5");
    assert.equal(receipt.environment.tenantScoped, true);
    assert.match(runner, /pg_ctl.*-m immediate stop/);
    assert.match(runner, /rm -rf \"\$TEMP_ROOT\"/);
    assert.match(runner, /REAL_CORPUS_RETRIEVAL_DATABASE_URL/);
  });

  await t.test("keeps raw PDFs outside Git and validates only committed evidence in CI", () => {
    const tracked = execFileSync("git", ["ls-files", "--", ".rag/library", "data/raw", "artifacts"], { encoding: "utf8" }).trim();
    assert.equal(tracked, "");
    assert.match(verifier, /Raw corpus bytes or legacy extraction artifacts must not be committed/);
    assert.match(workflow, /Verify real-corpus retrieval evidence/);
    assert.match(workflow, /Run EVAL-REAL-CORPUS-RETRIEVAL-001/);
  });

  await t.test("wires deterministic verifier and named EVAL commands", () => {
    assert.equal(packageJson.scripts["retrieval:verify:real-corpus"], "npm run build && node dist/cli/verifyRealCorpusRetrievalEvidence.js");
    assert.match(packageJson.scripts["eval:real-corpus-retrieval"], /eval-real-corpus-retrieval-001/);
    assert.doesNotMatch(JSON.stringify(receipt), /postgres(?:ql)?:\/\//i);
  });
});
