import { embedQuery, type QueryEmbeddingProvider } from "../embeddings/queryEmbedding.js";
import type { TenantTransactionClient } from "../security/index.js";
import {
  SearchEvidenceRepositoryError,
  type AuthorityStatus,
  type ClassifiedSearchCandidate,
  type ExecutedSearchMode,
  type SearchEvidenceRequestV1,
  type SearchEvidenceRepository,
  type SearchExecutionInput,
  type SearchFiltersV1,
  type SearchMode,
  type SearchResultV1,
  type StoredSearchCandidate,
  type TemporalStatus,
} from "../api/v1/searchEvidenceTypes.js";
import { deterministicUuid } from "../api/v1/mapper.js";

const MAX_REPOSITORY_RESULTS = 200;
const RRF_K = 60;
const TARGET_COMPARATIVE_WARNING =
  "Referencia comparativa: no define por sí sola el procedimiento oficial de La Antigua Guatemala y requiere corroboración con fuente nacional o de la jurisdicción objetivo.";
const QUALITY_LIMITATION =
  "La presencia de un resultado no demuestra completitud del corpus, calidad de recuperación, vigencia jurídica ni aplicabilidad al caso concreto.";
const DATE_LIMITATION =
  "La clasificación temporal usa únicamente fechas almacenadas y requiere revisión humana de vigencia, supersession y aplicabilidad.";

const normalized = (value: string): string => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const sameJurisdiction = (left: string, right: string): boolean =>
  normalized(left) === normalized(right);

const safeDate = (value: string | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

export const authorityStatusFor = (
  candidate: StoredSearchCandidate,
  requestedJurisdiction: string
): AuthorityStatus => {
  if (
    candidate.validationState === "validated"
    && candidate.officialSource
    && candidate.officialForTargetJurisdiction
    && candidate.sourceRelation === "target"
    && sameJurisdiction(candidate.targetJurisdiction, requestedJurisdiction)
  ) return "official_target_jurisdiction";

  if (
    candidate.validationState === "validated"
    && candidate.officialSource
    && candidate.sourceRelation === "national"
  ) return "official_national";

  if (
    candidate.sourceRelation === "comparative"
    || (
      candidate.sourceRelation !== "national"
      && !sameJurisdiction(candidate.sourceJurisdiction, requestedJurisdiction)
    )
  ) return "comparative";

  return "unknown";
};

export const temporalStatusFor = (
  candidate: Pick<StoredSearchCandidate, "effectiveDate" | "repealDate">,
  asOfDate: string
): TemporalStatus => {
  const effectiveDate = safeDate(candidate.effectiveDate);
  const repealDate = safeDate(candidate.repealDate);
  if (repealDate && repealDate <= asOfDate) return "expired_by_stored_dates";
  if (effectiveDate && effectiveDate > asOfDate) return "future_by_stored_dates";
  if (effectiveDate && effectiveDate <= asOfDate && (!repealDate || repealDate > asOfDate)) {
    return "current_by_stored_dates";
  }
  return "undetermined";
};

const evidenceStatusFor = (
  authorityStatus: AuthorityStatus,
  temporalStatus: TemporalStatus
): ClassifiedSearchCandidate["evidenceStatus"] => {
  if (
    (authorityStatus === "official_target_jurisdiction" || authorityStatus === "official_national")
    && temporalStatus === "current_by_stored_dates"
  ) return "supported";
  if (
    authorityStatus === "comparative"
    && (temporalStatus === "current_by_stored_dates" || temporalStatus === "undetermined")
  ) return "comparative_reference";
  return "validation_required";
};

const limitationsFor = (
  authorityStatus: AuthorityStatus,
  temporalStatus: TemporalStatus
): string[] => {
  const limitations = [QUALITY_LIMITATION, DATE_LIMITATION];
  if (authorityStatus === "comparative") limitations.push(TARGET_COMPARATIVE_WARNING);
  if (authorityStatus === "unknown") {
    limitations.push("La autoridad documental y la relación con la jurisdicción objetivo no están validadas.");
  }
  if (temporalStatus !== "current_by_stored_dates") {
    limitations.push("Las fechas almacenadas no sostienen una clasificación temporal vigente para la fecha consultada.");
  }
  return [...new Set(limitations)];
};

const finiteScore = (value: number | null, fallback = 0): number =>
  Math.max(0, typeof value === "number" && Number.isFinite(value) ? value : fallback);

const classify = (
  candidate: StoredSearchCandidate,
  request: SearchEvidenceRequestV1,
  matchedModes: ExecutedSearchMode[],
  score: number,
  scoreType: ClassifiedSearchCandidate["scoreType"]
): ClassifiedSearchCandidate => {
  const authorityStatus = authorityStatusFor(candidate, request.jurisdiction);
  const temporalStatus = temporalStatusFor(candidate, request.as_of_date);
  return {
    ...candidate,
    authorityStatus,
    temporalStatus,
    evidenceStatus: evidenceStatusFor(authorityStatus, temporalStatus),
    matchedModes,
    score: finiteScore(score),
    scoreType,
    limitations: limitationsFor(authorityStatus, temporalStatus),
  };
};

const candidateIdentity = (candidate: StoredSearchCandidate): string =>
  `${candidate.documentVersionId.toLowerCase()}:${candidate.sectionId.toLowerCase()}`;

const dedupeCandidates = (
  candidates: ClassifiedSearchCandidate[]
): ClassifiedSearchCandidate[] => {
  const byIdentity = new Map<string, ClassifiedSearchCandidate>();
  for (const candidate of candidates) {
    const identity = candidateIdentity(candidate);
    const existing = byIdentity.get(identity);
    if (!existing || candidate.score > existing.score) byIdentity.set(identity, candidate);
  }
  return [...byIdentity.values()].sort((left, right) =>
    right.score - left.score || candidateIdentity(left).localeCompare(candidateIdentity(right))
  );
};

const filterCandidate = (
  candidate: ClassifiedSearchCandidate,
  filters: SearchFiltersV1
): boolean =>
  (filters.document_types.length === 0 || filters.document_types.includes(candidate.documentType))
  && (filters.source_relations.length === 0 || filters.source_relations.includes(candidate.sourceRelation))
  && (filters.authority_statuses.length === 0 || filters.authority_statuses.includes(candidate.authorityStatus))
  && (filters.temporal_statuses.length === 0 || filters.temporal_statuses.includes(candidate.temporalStatus))
  && (filters.source_ids.length === 0 || filters.source_ids.some((id) =>
    id.toLowerCase() === candidate.sourceId.toLowerCase()
  ));

const inputFor = (request: SearchEvidenceRequestV1): SearchExecutionInput => ({
  tenantId: request.tenant_id,
  query: request.query,
  jurisdiction: request.jurisdiction,
  asOfDate: request.as_of_date,
  limit: Math.min(MAX_REPOSITORY_RESULTS, Math.max(request.limit, request.limit * 4)),
  filters: request.filters,
});

export interface PreparedSemanticQuery {
  queryVector: number[];
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
}

const requireSemanticProvider = (provider: QueryEmbeddingProvider | null): QueryEmbeddingProvider => {
  if (!provider || provider.dimensions !== 1536) {
    throw new SearchCapabilityError("Semantic retrieval capability is unavailable.");
  }
  return provider;
};

export const prepareSearchCapability = async (
  request: SearchEvidenceRequestV1,
  provider: QueryEmbeddingProvider | null
): Promise<PreparedSemanticQuery | null> => {
  if (request.mode === "keyword" || request.mode === "phrase") return null;
  const activeProvider = requireSemanticProvider(provider);
  try {
    return {
      queryVector: await embedQuery(activeProvider, request.query),
      embeddingProvider: activeProvider.providerName,
      embeddingModel: activeProvider.model,
      embeddingDimension: activeProvider.dimensions,
    };
  } catch (cause) {
    throw new SearchCapabilityError("Semantic retrieval capability is unavailable.", { cause });
  }
};

const requirePreparedSemanticQuery = (
  prepared: PreparedSemanticQuery | null
): PreparedSemanticQuery => {
  if (!prepared || prepared.embeddingDimension !== 1536 || prepared.queryVector.length !== 1536) {
    throw new SearchCapabilityError("Semantic retrieval capability is unavailable.");
  }
  return prepared;
};

const semanticRows = async (
  repository: SearchEvidenceRepository,
  client: TenantTransactionClient,
  request: SearchEvidenceRequestV1,
  prepared: PreparedSemanticQuery | null
): Promise<StoredSearchCandidate[]> => {
  const semantic = requirePreparedSemanticQuery(prepared);
  try {
    return await repository.searchSemantic(client, {
      ...inputFor(request),
      queryVector: semantic.queryVector,
      embeddingProvider: semantic.embeddingProvider,
      embeddingModel: semantic.embeddingModel,
      embeddingDimension: semantic.embeddingDimension,
    });
  } catch (cause) {
    if (cause instanceof SearchEvidenceRepositoryError) throw cause;
    throw new SearchCapabilityError("Semantic retrieval capability is unavailable.", { cause });
  }
};

const rankSingleMode = (
  rows: StoredSearchCandidate[],
  request: SearchEvidenceRequestV1,
  mode: Exclude<SearchMode, "hybrid">
): ClassifiedSearchCandidate[] => rows.map((candidate) => {
  if (mode === "keyword") {
    return classify(candidate, request, ["keyword"], finiteScore(candidate.keywordScore), "ts_rank_cd");
  }
  if (mode === "phrase") {
    return classify(candidate, request, ["phrase"], candidate.phraseMatched ? 1 : 0, "phrase_match");
  }
  return classify(candidate, request, ["semantic"], finiteScore(candidate.semanticScore), "cosine_similarity");
});

const mergeHybrid = (
  keywordRows: StoredSearchCandidate[],
  phraseRows: StoredSearchCandidate[],
  semanticRowsResult: StoredSearchCandidate[],
  request: SearchEvidenceRequestV1
): ClassifiedSearchCandidate[] => {
  const aggregate = new Map<string, {
    candidate: StoredSearchCandidate;
    score: number;
    matchedModes: ExecutedSearchMode[];
  }>();
  const add = (rows: StoredSearchCandidate[], mode: ExecutedSearchMode): void => {
    rows.forEach((candidate, index) => {
      const identity = candidateIdentity(candidate);
      const current = aggregate.get(identity) ?? { candidate, score: 0, matchedModes: [] };
      current.score += 1 / (RRF_K + index + 1);
      if (!current.matchedModes.includes(mode)) current.matchedModes.push(mode);
      aggregate.set(identity, current);
    });
  };
  add(keywordRows, "keyword");
  add(phraseRows, "phrase");
  add(semanticRowsResult, "semantic");
  return [...aggregate.values()]
    .map(({ candidate, score, matchedModes }) =>
      classify(candidate, request, matchedModes, score, "reciprocal_rank_fusion"))
    .sort((left, right) => right.score - left.score || candidateIdentity(left).localeCompare(candidateIdentity(right)));
};

export interface SearchExecutionResult {
  candidates: ClassifiedSearchCandidate[];
  executedModes: ExecutedSearchMode[];
}

export class SearchCapabilityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SearchCapabilityError";
  }
}

export const executeSearch = async (
  repository: SearchEvidenceRepository,
  client: TenantTransactionClient,
  request: SearchEvidenceRequestV1,
  preparedSemantic: PreparedSemanticQuery | null
): Promise<SearchExecutionResult> => {
  let classified: ClassifiedSearchCandidate[];
  let executedModes: ExecutedSearchMode[];
  if (request.mode === "keyword") {
    classified = rankSingleMode(await repository.searchKeyword(client, inputFor(request)), request, "keyword");
    executedModes = ["keyword"];
  } else if (request.mode === "phrase") {
    classified = rankSingleMode(await repository.searchPhrase(client, inputFor(request)), request, "phrase");
    executedModes = ["phrase"];
  } else if (request.mode === "semantic") {
    classified = rankSingleMode(await semanticRows(repository, client, request, preparedSemantic), request, "semantic");
    executedModes = ["semantic"];
  } else {
    requirePreparedSemanticQuery(preparedSemantic);
    let keywordRows: StoredSearchCandidate[];
    let phraseRows: StoredSearchCandidate[];
    let semantic: StoredSearchCandidate[];
    try {
      // Prove semantic capability before running lexical work so hybrid never
      // performs a partial fallback while claiming semantic execution.
      semantic = await semanticRows(repository, client, request, preparedSemantic);
      // A node-postgres transaction client cannot safely multiplex queries.
      keywordRows = await repository.searchKeyword(client, inputFor(request));
      phraseRows = await repository.searchPhrase(client, inputFor(request));
    } catch (cause) {
      if (cause instanceof SearchCapabilityError) throw cause;
      throw cause;
    }
    classified = mergeHybrid(keywordRows, phraseRows, semantic, request);
    executedModes = ["keyword", "phrase", "semantic"];
  }
  const candidates = dedupeCandidates(classified)
    .filter((item) => filterCandidate(item, request.filters))
    .slice(0, request.limit);
  return { candidates, executedModes };
};

export const searchResultFromCandidate = (candidate: ClassifiedSearchCandidate): SearchResultV1 => ({
  result_id: deterministicUuid(
    `search-result:${candidate.tenantId}:${candidate.documentVersionId}:${candidate.sectionId}`
  ),
  source_id: candidate.sourceId.toLowerCase(),
  source_key: candidate.sourceKey,
  document_id: candidate.documentId.toLowerCase(),
  document_version_id: candidate.documentVersionId.toLowerCase(),
  section_id: candidate.sectionId.toLowerCase(),
  chunk_id: candidate.chunkId,
  title: candidate.documentTitle.trim().slice(0, 500),
  document_type: candidate.documentType,
  document_scope: candidate.documentScope,
  source_relation: candidate.sourceRelation,
  source_jurisdiction: candidate.sourceJurisdiction.trim().slice(0, 240),
  target_jurisdiction: candidate.targetJurisdiction.trim().slice(0, 240),
  authority_status: candidate.authorityStatus,
  temporal_status: candidate.temporalStatus,
  evidence_status: candidate.evidenceStatus,
  confidentiality: "public",
  official_source: candidate.officialSource,
  official_for_target_jurisdiction: candidate.officialForTargetJurisdiction,
  publication_date: candidate.publicationDate,
  effective_date: candidate.effectiveDate,
  repeal_date: candidate.repealDate,
  citation: {
    label: candidate.citationLabel.trim().slice(0, 500),
    excerpt: candidate.excerpt.trim().slice(0, 4000),
    source_url: candidate.sourceUrl,
    page_start: candidate.pageStart,
    page_end: candidate.pageEnd,
    article_number: candidate.articleNumber?.trim().slice(0, 256) ?? null,
  },
  retrieval: {
    matched_modes: candidate.matchedModes,
    score: Number(candidate.score.toFixed(8)),
    score_type: candidate.scoreType,
  },
  content_sha256: candidate.contentSha256,
  limitations: candidate.limitations,
});

export const SEARCH_RESPONSE_LIMITATIONS = [QUALITY_LIMITATION, DATE_LIMITATION] as const;
