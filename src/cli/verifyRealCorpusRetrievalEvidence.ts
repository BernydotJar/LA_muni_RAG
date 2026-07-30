import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const CONFIG_PATH = "evals/real-corpus/retrieval-cases.json";
const RECEIPT_PATH = "evals/real-corpus/results/retrieval-eval-receipt.json";
const MODES = ["phrase", "keyword", "vector_lexical", "hybrid"] as const;
type Mode = typeof MODES[number];

interface ModeEvidence {
  values: {
    hitAt5: number;
    mrr: number;
    citationIdentityAccuracy: number;
    unsupportedAnswerRate: number;
    crossDocumentLeakageRate: number;
  };
  thresholds: Record<string, number>;
  checks: Record<string, boolean>;
  passed: boolean;
}
interface Receipt {
  schemaVersion: number;
  evaluationStatus: string;
  safetyGatePassed: boolean;
  qualityTargetsPassed: boolean;
  corpus: { documentKey: string; documentVersion: string; contentSha256: string; expectedChunks: number };
  environment: { tenantScoped: boolean; persistedChunks: number; persistedDocuments: number; postgresVersion: string; pgvectorVersion: string };
  provider: { name: string; model: string; dimensions: number; classification: string; semanticModel: boolean; productiveProvider: boolean };
  querySet: { positiveCases: number; noAnswerCases: number; frozenBeforeMeasurement: boolean; configPath: string };
  metrics: Record<Mode, ModeEvidence>;
  cases: Array<{ id: string; kind: string; query: string; modes: Record<Mode, { answerEligible: boolean; candidates: unknown[] }> }>;
  limitations: Record<string, boolean | number>;
}
interface Config {
  schemaVersion: number;
  corpus: Receipt["corpus"];
  evaluation: { vectorAnswerThreshold: number; calibration: Record<string, unknown>; modes: Mode[]; thresholds: Record<Mode, Record<string, number>> };
  cases: Array<{ id: string; kind: string; query: string }>;
  claims: Record<string, boolean>;
}

const load = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T;
const fail = (message: string): never => { throw new Error(message); };
const finiteRate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

const main = async (): Promise<void> => {
  const [config, receipt] = await Promise.all([load<Config>(CONFIG_PATH), load<Receipt>(RECEIPT_PATH)]);
  if (config.schemaVersion !== 1 || receipt.schemaVersion !== 1) fail("Retrieval evidence schema is invalid.");
  if (JSON.stringify(receipt.corpus) !== JSON.stringify(config.corpus)) fail("Receipt corpus identity differs from the frozen query set.");
  if (config.cases.length !== 12 || new Set(config.cases.map((item) => item.id)).size !== 12) fail("Frozen retrieval case set is invalid.");
  if (config.cases.filter((item) => item.kind === "evidence").length !== 8 || config.cases.filter((item) => item.kind === "no_answer").length !== 4) {
    fail("Frozen retrieval case composition is invalid.");
  }
  if (Object.values(config.claims).some(Boolean)) fail("Frozen query set pre-authorizes an unsupported claim.");
  if (config.evaluation.vectorAnswerThreshold !== 0.35 || config.evaluation.calibration.finalThresholdFrozenBeforeFinalMeasurement !== true) {
    fail("Final lexical-vector answer threshold was not frozen after the excluded calibration run.");
  }

  if (
    receipt.evaluationStatus !== "measured_with_quality_gaps" || !receipt.safetyGatePassed || receipt.qualityTargetsPassed ||
    !receipt.environment.tenantScoped || receipt.environment.persistedChunks !== 444 || receipt.environment.persistedDocuments !== 1 ||
    !receipt.environment.postgresVersion.startsWith("15.18") || receipt.environment.pgvectorVersion !== "0.8.5"
  ) fail("Retrieval evaluation environment or overall result is invalid.");
  if (
    receipt.provider.name !== "local-eval-hashing" || receipt.provider.model !== "token-bigram-hash-1536-v1" ||
    receipt.provider.dimensions !== 1536 || receipt.provider.classification !== "deterministic_lexical_hashing" ||
    receipt.provider.semanticModel || receipt.provider.productiveProvider
  ) fail("Retrieval provider identity or limitations are invalid.");
  if (
    receipt.querySet.positiveCases !== 8 || receipt.querySet.noAnswerCases !== 4 ||
    !receipt.querySet.frozenBeforeMeasurement || receipt.querySet.configPath !== CONFIG_PATH || receipt.cases.length !== 12
  ) fail("Retrieval query-set receipt is invalid.");

  for (const mode of MODES) {
    const evidence = receipt.metrics[mode];
    if (!evidence) fail(`Missing retrieval mode ${mode}.`);
    for (const value of Object.values(evidence.values)) if (!finiteRate(value)) fail(`Invalid metric value for ${mode}.`);
    if (evidence.values.unsupportedAnswerRate !== 0 || evidence.values.crossDocumentLeakageRate !== 0) {
      fail(`Safety metrics failed for ${mode}.`);
    }
    if (!evidence.checks.unsupportedAnswerRate || !evidence.checks.crossDocumentLeakageRate) {
      fail(`Safety checks are not passing for ${mode}.`);
    }
    if (JSON.stringify(evidence.thresholds) !== JSON.stringify(config.evaluation.thresholds[mode])) {
      fail(`Threshold drift detected for ${mode}.`);
    }
  }
  if (!receipt.metrics.vector_lexical.passed) fail("Lexical-vector mode must satisfy its frozen bounded targets.");
  if (receipt.metrics.phrase.passed || receipt.metrics.keyword.passed || receipt.metrics.hybrid.passed) {
    fail("Receipt must preserve the observed phrase, keyword and hybrid quality gaps.");
  }
  if (
    receipt.metrics.phrase.values.hitAt5 !== 0.75 ||
    receipt.metrics.keyword.values.hitAt5 !== 0.75 ||
    receipt.metrics.vector_lexical.values.hitAt5 !== 0.75 ||
    receipt.metrics.hybrid.values.hitAt5 !== 0.875
  ) fail("Frozen hit-at-five results drifted.");
  if (
    receipt.limitations.corpusDocuments !== 1 || receipt.limitations.corpusCompletenessClaim !== false ||
    receipt.limitations.legalCorrectnessClaim !== false || receipt.limitations.semanticRetrievalClaim !== false ||
    receipt.limitations.productionSloClaim !== false || receipt.limitations.generalizationBeyondCases !== false ||
    receipt.limitations.dmpNoTextExcluded !== true
  ) fail("Retrieval result limitations are incomplete.");

  for (const testCase of receipt.cases) {
    const expected = config.cases.find((item) => item.id === testCase.id) ?? fail(`Unknown receipt case ${testCase.id}.`);
    if (expected.kind !== testCase.kind || expected.query !== testCase.query) fail(`Receipt case drift for ${testCase.id}.`);
    if (testCase.kind === "no_answer") {
      for (const mode of MODES) if (testCase.modes[mode].answerEligible) fail(`No-answer case ${testCase.id} became eligible in ${mode}.`);
    }
  }

  const trackedRaw = execFileSync("git", ["ls-files", "--", ".rag/library", "data/raw", "artifacts"], { encoding: "utf8" }).trim();
  if (trackedRaw) fail("Raw corpus bytes or legacy extraction artifacts must not be committed.");

  process.stdout.write(`${JSON.stringify({
    status: "pass",
    evaluationStatus: receipt.evaluationStatus,
    safetyGatePassed: receipt.safetyGatePassed,
    qualityTargetsPassed: receipt.qualityTargetsPassed,
    positiveCases: receipt.querySet.positiveCases,
    noAnswerCases: receipt.querySet.noAnswerCases,
    metrics: Object.fromEntries(MODES.map((mode) => [mode, receipt.metrics[mode].values])),
    qualityGaps: ["phrase_mrr_and_top1_citation", "keyword_mrr_and_top1_citation", "hybrid_mrr_and_top1_citation"],
  }, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Real-corpus retrieval evidence verification failed."}\n`);
  process.exitCode = 1;
});
