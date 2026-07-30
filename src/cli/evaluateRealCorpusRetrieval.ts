import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import { LocalEvaluationEmbeddingProvider } from "../embeddings/localEvaluationEmbeddingProvider.js";
import { TenantPgVectorRepository } from "../embeddings/tenantPgVectorRepository.js";
import { buildHybridRetrievalResult } from "../retrieval/hybridRetriever.js";
import type { HybridCandidate } from "../retrieval/types.js";
import { vectorCandidateToHybridCandidate } from "../retrieval/vectorRetriever.js";
import { withTenantTransaction } from "../security/index.js";

const { Pool } = pg;
const CONFIG_PATH = process.argv[2] ?? "evals/real-corpus/retrieval-cases.json";
const RESULT_PATH = process.env.REAL_CORPUS_RETRIEVAL_RESULT_PATH ?? "evals/real-corpus/results/retrieval-eval-receipt.json";
const DATABASE_URL = process.env.REAL_CORPUS_RETRIEVAL_DATABASE_URL?.trim();
const TENANT_ID = process.env.REAL_CORPUS_RETRIEVAL_TENANT_ID?.trim() ?? "a7100000-0000-4000-8000-000000000001";
const EPSILON = 1e-12;

if (!DATABASE_URL) throw new Error("REAL_CORPUS_RETRIEVAL_DATABASE_URL is required.");

interface PageRange extends Array<number> { 0: number; 1: number; }
interface EvidenceCase {
  id: string;
  kind: "evidence";
  query: string;
  expectedDocumentKey: string;
  expectedPageRanges: PageRange[];
}
interface NoAnswerCase { id: string; kind: "no_answer"; query: string; }
type RetrievalCase = EvidenceCase | NoAnswerCase;
type ModeName = "phrase" | "keyword" | "vector_lexical" | "hybrid";
interface Thresholds {
  hitAt5: number;
  mrr: number;
  citationIdentityAccuracy: number;
  unsupportedAnswerRate: number;
  crossDocumentLeakageRate: number;
}
interface EvaluationConfig {
  schemaVersion: 1;
  corpus: { documentKey: string; documentVersion: string; contentSha256: string; expectedChunks: number };
  evaluation: {
    limit: number;
    hitAt: number;
    vectorAnswerThreshold: number;
    modes: ModeName[];
    thresholds: Record<ModeName, Thresholds>;
  };
  cases: RetrievalCase[];
  claims: Record<string, boolean>;
}
interface RankedCandidate {
  rank: number;
  chunkId: string | null;
  documentKey: string | null;
  documentVersion: string | null;
  citationLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  matchedModes: string[];
  scores: Record<string, number>;
  hybridScore: number;
  relevant: boolean;
}
interface CaseModeResult {
  mode: ModeName;
  answerEligible: boolean;
  firstRelevantRank: number | null;
  hitAt5: boolean;
  citationIdentityValid: boolean;
  leakedCandidateCount: number;
  candidates: RankedCandidate[];
}

const atomicJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
};
const rowsFrom = (result: unknown): Record<string, unknown>[] => {
  if (!result || typeof result !== "object" || !Array.isArray((result as { rows?: unknown }).rows)) {
    throw new Error("Retrieval query returned an invalid result.");
  }
  return (result as { rows: Record<string, unknown>[] }).rows;
};
const finite = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const nullableNumber = (value: unknown): number | null => value === null || value === undefined ? null : finite(value);
const documentKeyFor = (candidate: HybridCandidate): string | null => {
  const value = candidate.metadata?.documentKey;
  return typeof value === "string" && value ? value : null;
};
const documentVersionFor = (candidate: HybridCandidate): string | null => {
  const value = candidate.metadata?.documentVersion;
  return typeof value === "string" && value ? value : null;
};
const overlaps = (candidate: HybridCandidate, ranges: PageRange[]): boolean => {
  const start = candidate.pageStart;
  const end = candidate.pageEnd ?? candidate.pageStart;
  if (start === null || start === undefined || end === null || end === undefined) return false;
  return ranges.some(([expectedStart, expectedEnd]) => start <= expectedEnd && end >= expectedStart);
};
const isRelevant = (candidate: HybridCandidate, testCase: RetrievalCase): boolean =>
  testCase.kind === "evidence" &&
  documentKeyFor(candidate) === testCase.expectedDocumentKey &&
  overlaps(candidate, testCase.expectedPageRanges);

const rowToCandidate = (row: Record<string, unknown>, mode: "phrase" | "keyword"): HybridCandidate => ({
  id: `${mode}:${String(row.chunk_id)}`,
  mode,
  matchedModes: [mode],
  documentVersionId: String(row.document_version_id),
  documentTitle: String(row.document_title),
  chunkId: String(row.chunk_id),
  citationLabel: String(row.citation_label),
  excerpt: String(row.chunk_text),
  sourceType: String(row.source_type),
  pageStart: nullableNumber(row.page_start),
  pageEnd: nullableNumber(row.page_end),
  articleNumber: row.article_number === null || row.article_number === undefined ? null : String(row.article_number),
  scores: mode === "phrase"
    ? { phrase: Math.min(1, Math.max(0, finite(row.exact_match) > 0 ? 1 : finite(row.phrase_score))) }
    : { keyword: Math.min(1, Math.max(0, finite(row.keyword_score))) },
  hybridScore: 0,
  metadata: {
    documentKey: String(row.document_key),
    documentVersion: String(row.document_version),
    contentSha256: String(row.content_sha256),
  },
});

const PHRASE_SQL = `
  SELECT vector.chunk_id, vector.document_version_id, vector.document_key, vector.document_version,
         vector.document_title, vector.citation_label, vector.page_start, vector.page_end,
         vector.article_number, vector.source_type, vector.chunk_text, vector.content_sha256,
         CASE WHEN strpos(lower(vector.chunk_text), lower($2)) > 0 THEN 1 ELSE 0 END AS exact_match,
         ts_rank_cd(to_tsvector('spanish', vector.chunk_text), phraseto_tsquery('spanish', $2)) AS phrase_score
    FROM rag.embedding_vectors AS vector
    JOIN rag.document_versions AS version
      ON version.tenant_id = vector.tenant_id AND version.id = vector.document_version_id
    JOIN rag.documents AS document
      ON document.tenant_id = version.tenant_id AND document.id = version.document_id
    JOIN rag.ingestion_jobs AS job
      ON job.tenant_id = vector.tenant_id AND job.id = vector.ingestion_job_id
   WHERE vector.tenant_id = $1::uuid
     AND vector.contract_version = 1
     AND job.status = 'processed'
     AND version.extraction_status = 'processed'
     AND document.status = 'active'
     AND document.metadata ->> 'confidentiality' = 'public'
     AND to_tsvector('spanish', vector.chunk_text) @@ phraseto_tsquery('spanish', $2)
   ORDER BY exact_match DESC, phrase_score DESC, vector.page_start ASC NULLS LAST, vector.chunk_ordinal ASC, vector.chunk_id ASC
   LIMIT $3::integer`;
const KEYWORD_SQL = `
  SELECT vector.chunk_id, vector.document_version_id, vector.document_key, vector.document_version,
         vector.document_title, vector.citation_label, vector.page_start, vector.page_end,
         vector.article_number, vector.source_type, vector.chunk_text, vector.content_sha256,
         ts_rank_cd(to_tsvector('spanish', vector.chunk_text), websearch_to_tsquery('spanish', $2)) AS keyword_score
    FROM rag.embedding_vectors AS vector
    JOIN rag.document_versions AS version
      ON version.tenant_id = vector.tenant_id AND version.id = vector.document_version_id
    JOIN rag.documents AS document
      ON document.tenant_id = version.tenant_id AND document.id = version.document_id
    JOIN rag.ingestion_jobs AS job
      ON job.tenant_id = vector.tenant_id AND job.id = vector.ingestion_job_id
   WHERE vector.tenant_id = $1::uuid
     AND vector.contract_version = 1
     AND job.status = 'processed'
     AND version.extraction_status = 'processed'
     AND document.status = 'active'
     AND document.metadata ->> 'confidentiality' = 'public'
     AND to_tsvector('spanish', vector.chunk_text) @@ websearch_to_tsquery('spanish', $2)
   ORDER BY keyword_score DESC, vector.page_start ASC NULLS LAST, vector.chunk_ordinal ASC, vector.chunk_id ASC
   LIMIT $3::integer`;

const validateConfig = (config: EvaluationConfig): void => {
  if (config.schemaVersion !== 1 || config.cases.length !== 12 || config.evaluation.hitAt !== 5) {
    throw new Error("Real-corpus retrieval evaluation config is invalid.");
  }
  const ids = new Set<string>();
  for (const testCase of config.cases) {
    if (!testCase.id || ids.has(testCase.id) || !testCase.query.trim()) throw new Error("Retrieval case identity is invalid.");
    ids.add(testCase.id);
    if (testCase.kind === "evidence") {
      if (testCase.expectedDocumentKey !== config.corpus.documentKey || testCase.expectedPageRanges.length < 1) {
        throw new Error("Evidence case scope is invalid.");
      }
      for (const range of testCase.expectedPageRanges) {
        if (!Number.isSafeInteger(range[0]) || !Number.isSafeInteger(range[1]) || range[0] < 1 || range[1] < range[0]) {
          throw new Error("Evidence case page range is invalid.");
        }
      }
    }
  }
  if (Object.values(config.claims).some(Boolean)) throw new Error("Retrieval evaluation must not pre-authorize broad claims.");
};

const evaluateMode = (
  mode: ModeName,
  candidates: HybridCandidate[],
  testCase: RetrievalCase,
  config: EvaluationConfig
): CaseModeResult => {
  const top = candidates.slice(0, config.evaluation.limit);
  const firstRelevantIndex = testCase.kind === "evidence" ? top.findIndex((candidate) => isRelevant(candidate, testCase)) : -1;
  const firstRelevant = firstRelevantIndex >= 0 ? top[firstRelevantIndex] : undefined;
  const vectorEligible = (top[0]?.scores.vector ?? 0) + EPSILON >= config.evaluation.vectorAnswerThreshold;
  const answerEligible = mode === "vector_lexical"
    ? vectorEligible
    : mode === "hybrid"
      ? Boolean(top[0]?.matchedModes.some((candidateMode) => candidateMode === "phrase" || candidateMode === "keyword")) || vectorEligible
      : top.length > 0;
  const leakedCandidateCount = top.slice(0, config.evaluation.hitAt)
    .filter((candidate) => documentKeyFor(candidate) !== config.corpus.documentKey).length;
  const topCandidate = top[0];
  const citationIdentityValid = Boolean(
    topCandidate && topCandidate.citationLabel.trim() &&
    testCase.kind === "evidence" && isRelevant(topCandidate, testCase)
  );
  return {
    mode,
    answerEligible,
    firstRelevantRank: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
    hitAt5: firstRelevantIndex >= 0 && firstRelevantIndex < config.evaluation.hitAt,
    citationIdentityValid,
    leakedCandidateCount,
    candidates: top.slice(0, config.evaluation.hitAt).map((candidate, index) => ({
      rank: index + 1,
      chunkId: candidate.chunkId ?? null,
      documentKey: documentKeyFor(candidate),
      documentVersion: documentVersionFor(candidate),
      citationLabel: candidate.citationLabel,
      pageStart: candidate.pageStart ?? null,
      pageEnd: candidate.pageEnd ?? null,
      matchedModes: candidate.matchedModes,
      scores: Object.fromEntries(Object.entries(candidate.scores).filter((entry): entry is [string, number] => typeof entry[1] === "number")),
      hybridScore: candidate.hybridScore,
      relevant: isRelevant(candidate, testCase),
    })),
  };
};

const main = async (): Promise<void> => {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as EvaluationConfig;
  validateConfig(config);
  const provider = new LocalEvaluationEmbeddingProvider();
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 5_000 });
  try {
    const databaseIdentity = await pool.query(
      `SELECT current_setting('server_version') AS postgres_version,
              (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector_version`
    );
    const corpusCount = await withTenantTransaction(pool, TENANT_ID, async (client) => {
      const result = await client.query(
        `SELECT count(*)::int AS chunk_count,
                count(DISTINCT vector.document_key)::int AS document_count,
                min(version.content_sha256) AS content_sha256,
                min(version.version_label) AS document_version
           FROM rag.embedding_vectors AS vector
           JOIN rag.document_versions AS version
             ON version.tenant_id = vector.tenant_id AND version.id = vector.document_version_id
          WHERE vector.tenant_id = $1::uuid AND vector.contract_version = 1`, [TENANT_ID]
      ) as { rows: Array<{ chunk_count: number; document_count: number; content_sha256: string; document_version: string }> };
      return result.rows[0];
    });
    if (
      !corpusCount || Number(corpusCount.chunk_count) !== config.corpus.expectedChunks ||
      Number(corpusCount.document_count) !== 1 || corpusCount.content_sha256 !== config.corpus.contentSha256 ||
      corpusCount.document_version !== config.corpus.documentVersion
    ) throw new Error("Persisted corpus identity does not match the frozen evaluation set.");

    const caseResults: Array<{ id: string; kind: string; query: string; expectedPageRanges?: PageRange[]; modes: Record<ModeName, CaseModeResult> }> = [];
    for (const testCase of config.cases) {
      const [queryVector] = await provider.embed([testCase.query]);
      const retrieved = await withTenantTransaction(pool, TENANT_ID, async (client) => {
        const phraseRows = rowsFrom(await client.query(PHRASE_SQL, [TENANT_ID, testCase.query, config.evaluation.limit]));
        const keywordRows = rowsFrom(await client.query(KEYWORD_SQL, [TENANT_ID, testCase.query, config.evaluation.limit]));
        const vectorRepository = new TenantPgVectorRepository(client, {
          tenantId: TENANT_ID,
          embeddingProvider: provider.providerName,
          embeddingModel: provider.model,
          embeddingDimension: provider.dimensions,
        });
        const vectorRows = await vectorRepository.searchPublic(queryVector!, config.evaluation.limit);
        const phrase = phraseRows.map((row) => rowToCandidate(row, "phrase"));
        const keyword = keywordRows.map((row) => rowToCandidate(row, "keyword"));
        const vector = vectorRows.map((row) => {
          const candidate = vectorCandidateToHybridCandidate(row);
          const metadata = candidate.metadata ?? {};
          return {
            ...candidate,
            documentVersionId: typeof metadata.documentVersionId === "string" ? metadata.documentVersionId : candidate.documentVersionId,
          };
        });
        const hybrid = buildHybridRetrievalResult({
          phraseCandidates: phrase,
          keywordCandidates: keyword,
          vectorCandidates: vector,
          limit: config.evaluation.limit,
        }).candidates;
        return { phrase, keyword, vector, hybrid };
      });
      caseResults.push({
        id: testCase.id,
        kind: testCase.kind,
        query: testCase.query,
        ...(testCase.kind === "evidence" ? { expectedPageRanges: testCase.expectedPageRanges } : {}),
        modes: {
          phrase: evaluateMode("phrase", retrieved.phrase, testCase, config),
          keyword: evaluateMode("keyword", retrieved.keyword, testCase, config),
          vector_lexical: evaluateMode("vector_lexical", retrieved.vector, testCase, config),
          hybrid: evaluateMode("hybrid", retrieved.hybrid, testCase, config),
        },
      });
    }

    const positives = caseResults.filter((item) => item.kind === "evidence");
    const negatives = caseResults.filter((item) => item.kind === "no_answer");
    const metrics = Object.fromEntries(config.evaluation.modes.map((mode) => {
      const positiveMode = positives.map((item) => item.modes[mode]);
      const negativeMode = negatives.map((item) => item.modes[mode]);
      const topFiveCandidates = positiveMode.reduce((sum, result) => sum + result.candidates.length, 0);
      const values = {
        hitAt5: positiveMode.filter((result) => result.hitAt5).length / positives.length,
        mrr: positiveMode.reduce((sum, result) => sum + (result.firstRelevantRank ? 1 / result.firstRelevantRank : 0), 0) / positives.length,
        citationIdentityAccuracy: positiveMode.filter((result) => result.citationIdentityValid).length / positives.length,
        unsupportedAnswerRate: negativeMode.filter((result) => result.answerEligible).length / negatives.length,
        crossDocumentLeakageRate: topFiveCandidates === 0 ? 0 : positiveMode.reduce((sum, result) => sum + result.leakedCandidateCount, 0) / topFiveCandidates,
      };
      const thresholds = config.evaluation.thresholds[mode];
      const checks = {
        hitAt5: values.hitAt5 + EPSILON >= thresholds.hitAt5,
        mrr: values.mrr + EPSILON >= thresholds.mrr,
        citationIdentityAccuracy: values.citationIdentityAccuracy + EPSILON >= thresholds.citationIdentityAccuracy,
        unsupportedAnswerRate: values.unsupportedAnswerRate <= thresholds.unsupportedAnswerRate + EPSILON,
        crossDocumentLeakageRate: values.crossDocumentLeakageRate <= thresholds.crossDocumentLeakageRate + EPSILON,
      };
      return [mode, { values, thresholds, checks, passed: Object.values(checks).every(Boolean) }];
    }));
    const qualityTargetsPassed = Object.values(metrics).every((item) => (item as { passed: boolean }).passed);
    const safetyGatePassed = Object.values(metrics).every((item) => {
      const typed = item as { checks: { unsupportedAnswerRate: boolean; crossDocumentLeakageRate: boolean } };
      return typed.checks.unsupportedAnswerRate && typed.checks.crossDocumentLeakageRate;
    });
    const evaluationStatus = safetyGatePassed
      ? qualityTargetsPassed ? "pass" : "measured_with_quality_gaps"
      : "fail";
    const receipt = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      evaluationStatus,
      safetyGatePassed,
      qualityTargetsPassed,
      corpus: config.corpus,
      environment: {
        postgresVersion: String(databaseIdentity.rows[0]?.postgres_version ?? ""),
        pgvectorVersion: String(databaseIdentity.rows[0]?.pgvector_version ?? ""),
        tenantScoped: true,
        persistedChunks: Number(corpusCount.chunk_count),
        persistedDocuments: Number(corpusCount.document_count),
      },
      provider: {
        name: provider.providerName,
        model: provider.model,
        dimensions: provider.dimensions,
        classification: "deterministic_lexical_hashing",
        semanticModel: false,
        productiveProvider: false,
      },
      querySet: {
        positiveCases: positives.length,
        noAnswerCases: negatives.length,
        frozenBeforeMeasurement: true,
        configPath: CONFIG_PATH,
      },
      metrics,
      cases: caseResults,
      limitations: {
        corpusDocuments: 1,
        corpusCompletenessClaim: false,
        legalCorrectnessClaim: false,
        semanticRetrievalClaim: false,
        productionSloClaim: false,
        generalizationBeyondCases: false,
        dmpNoTextExcluded: true,
      },
    };
    await atomicJson(RESULT_PATH, receipt);
    process.stdout.write(`${JSON.stringify({ status: receipt.evaluationStatus, metrics }, null, 2)}\n`);
    if (!safetyGatePassed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Real-corpus retrieval evaluation failed."}\n`);
  process.exitCode = 1;
});
