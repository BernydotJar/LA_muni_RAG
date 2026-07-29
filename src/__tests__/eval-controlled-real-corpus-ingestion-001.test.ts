import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("evals/real-corpus/controlled-ingestion-config.json", "utf8"));
const inventory = JSON.parse(readFileSync(".rag/source-inventory.json", "utf8"));
const receipt = JSON.parse(readFileSync("evals/real-corpus/results/controlled-ingestion-receipt.json", "utf8"));
const manifest = JSON.parse(readFileSync("evals/real-corpus/controlled-corpus-manifest.json", "utf8"));
const downloader = readFileSync("scripts/acquire-controlled-real-corpus.mjs", "utf8");
const runner = readFileSync("scripts/run-controlled-real-corpus.sh", "utf8");
const setup = readFileSync("db/tests/controlled_real_corpus_setup.sql", "utf8");
const cli = readFileSync("src/cli/controlledCorpusIngestion.ts", "utf8");
const verifier = readFileSync("src/cli/verifyControlledCorpusEvidence.ts", "utf8");

const expected = new Map([
  ["antigua-pdm-ot", { hash: "824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b", bytes: 34822596 }],
  ["antigua-mnp-dmp-v3-2026", { hash: "4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9", bytes: 49052885 }],
]);

test("EVAL-CONTROLLED-REAL-CORPUS-INGESTION-001", async (t) => {
  await t.test("binds exactly two real municipal PDFs to historical hashes and sizes", () => {
    assert.equal(config.sources.length, 2);
    for (const source of config.sources) {
      const identity = expected.get(source.sourceId);
      assert.ok(identity, source.sourceId);
      assert.equal(source.expectedSha256, identity.hash);
      assert.equal(source.expectedByteLength, identity.bytes);
    }
  });

  await t.test("downloads only registered HTTPS municipal URLs without redirects", () => {
    assert.match(downloader, /redirect: "manual"/);
    assert.match(downloader, /url\.hostname !== "muniantigua\.gob\.gt"/);
    assert.match(downloader, /response\.status >= 300/);
    assert.match(downloader, /Content-Length mismatch/);
    assert.match(downloader, /Downloaded artifact identity mismatch/);
  });

  await t.test("requires complete ClamAV and structural evidence before acceptance", () => {
    assert.match(cli, /createClamAvScannerFromEnv/);
    assert.match(cli, /scanVerifiedArtifactSnapshot/);
    assert.match(cli, /malware\.verdict !== "clean" \|\| !malware\.definitionsVersion/);
    assert.match(cli, /inspectArtifactContent/);
    assert.equal(receipt.sources.every((source: any) => source.scanner.engine === "clamav" && source.scanner.definitionsVersion), true);
  });

  await t.test("uses the existing persisted acceptance, lease and tenant vector runtime", () => {
    assert.match(cli, /PostgresArtifactAcceptanceRepository/);
    assert.match(cli, /PersistedAcceptedArtifactResolver/);
    assert.match(cli, /PostgresIngestionJobService/);
    assert.match(cli, /TenantIngestionWorker/);
    assert.doesNotMatch(cli, /InMemory/);
  });

  await t.test("enforces non-owner no-bypass FORCE RLS in a disposable database", () => {
    assert.match(setup, /NOSUPERUSER[\s\S]*NOBYPASSRLS/);
    assert.match(setup, /relrowsecurity AND c\.relforcerowsecurity/);
    assert.match(runner, /trap cleanup EXIT INT TERM/);
    assert.match(runner, /pg_ctl.*-m immediate stop/);
    assert.match(runner, /rm -rf \"\$TEMP_ROOT\"/);
    assert.equal(receipt.database.runtimeRoleNonOwner, true);
    assert.equal(receipt.database.runtimeRoleNoBypassRls, true);
    assert.equal(receipt.database.forcedRlsTables, 5);
    assert.equal(receipt.database.disposable, true);
  });

  await t.test("credits one real ingestion and preserves the scanned no-text blocker", () => {
    assert.equal(receipt.sources.length, 2);
    const ingested = receipt.sources.filter((source: any) => source.ingestionStatus === "ingested");
    const blocked = receipt.sources.filter((source: any) => source.ingestionStatus === "blocked_no_text");
    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].sectionCount > 0 && ingested[0].chunkCount > 0, true);
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0].failureCode, "pdf_no_extractable_text");
    assert.equal(blocked[0].sectionCount, 0);
    assert.equal(blocked[0].chunkCount, 0);
    assert.equal(manifest.records.length, 1);
    assert.equal(manifest.records[0].status, "indexed");
  });

  await t.test("reconciles the durable source inventory as ingested without authority promotion", () => {
    for (const sourceId of expected.keys()) {
      const record = inventory.records.find((candidate: any) => candidate.sourceId === sourceId);
      assert.ok(record.status === "ingested" || record.status === "failed");
      assert.equal(record.authorityClass, "official_municipal");
      assert.equal(record.authorityLevel, "primary");
      assert.equal(record.artifactSafety.verdict, "clean");
      if (record.status === "ingested") {
        assert.ok(record.extraction.sectionCount > 0);
        assert.ok(record.indexing.chunkCount > 0);
      } else {
        assert.deepEqual(record.failureCodes, ["pdf_no_extractable_text"]);
      }
    }
  });

  await t.test("labels local lexical hashing and rejects semantic or productive overclaims", () => {
    assert.equal(receipt.embedding.provider, "local-eval-hashing");
    assert.equal(receipt.embedding.model, "token-bigram-hash-1536-v1");
    assert.equal(receipt.embedding.semanticClaim, false);
    assert.equal(receipt.productionObjectStoreClaim, false);
    assert.equal(receipt.legalValidityClaim, false);
    assert.equal(receipt.corpusCompletenessClaim, false);
    assert.match(cli, /no un modelo semántico productivo/i);
  });

  await t.test("keeps raw PDFs and legacy extraction artifacts outside Git", () => {
    assert.equal(receipt.rawBytesCommittedToGit, false);
    const tracked = execFileSync("git", ["ls-files", "--", ".rag/library", "data/raw", "artifacts"], { encoding: "utf8" }).trim();
    assert.equal(tracked, "");
    assert.match(verifier, /Raw controlled corpus bytes or legacy extraction artifacts must not be committed/);
  });

  await t.test("wires deterministic verification and named EVAL commands", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    assert.equal(pkg.scripts["corpus:verify:controlled"], "npm run build && node dist/cli/verifyControlledCorpusEvidence.js");
    assert.match(pkg.scripts["eval:controlled-real-corpus-ingestion"], /eval-controlled-real-corpus-ingestion-001/);
    assert.doesNotMatch(JSON.stringify(receipt), /postgresql:\/\//i);
  });
});
