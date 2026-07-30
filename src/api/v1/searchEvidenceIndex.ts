import { randomUUID } from "node:crypto";
import { pool } from "../../db.js";
import { createQueryEmbeddingProvider } from "../../embeddings/queryEmbeddingFactory.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import {
  InMemorySearchEvidenceRepository,
  PostgresSearchEvidenceRepository,
} from "../../searchEvidence/repository.js";
import { loadSearchEvidenceValidators } from "./searchEvidenceContracts.js";
import { handleSearchEvidenceV1 } from "./searchEvidenceHandler.js";
import type { SearchEvidenceApiDependencies } from "./searchEvidenceTypes.js";

export interface SearchEvidenceV1Options extends Partial<SearchEvidenceApiDependencies> {}

export const createSearchEvidenceV1Dependencies = (
  options: SearchEvidenceV1Options = {}
): SearchEvidenceApiDependencies => {
  const rateLimit = options.rateLimit ?? 60;
  const rateWindowSeconds = options.rateWindowSeconds ?? 60;
  const idempotencyTtlSeconds = options.idempotencyTtlSeconds ?? 86_400;
  if (!Number.isSafeInteger(rateLimit) || rateLimit < 1 || rateLimit > 1_000_000) {
    throw new Error("search/evidence rateLimit must be an integer between 1 and 1000000");
  }
  if (!Number.isSafeInteger(rateWindowSeconds) || rateWindowSeconds < 1 || rateWindowSeconds > 86_400) {
    throw new Error("search/evidence rateWindowSeconds must be an integer between 1 and 86400");
  }
  if (!Number.isSafeInteger(idempotencyTtlSeconds) || idempotencyTtlSeconds < 60 || idempotencyTtlSeconds > 604_800) {
    throw new Error("search/evidence idempotencyTtlSeconds must be between 60 and 604800");
  }
  const repository = options.repository ?? new PostgresSearchEvidenceRepository(pool, pool);
  const queryEmbeddingProvider = Object.prototype.hasOwnProperty.call(options, "queryEmbeddingProvider")
    ? options.queryEmbeddingProvider ?? null
    : createQueryEmbeddingProvider();
  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool: options.transactionPool ?? pool,
    repository,
    validators: options.validators ?? loadSearchEvidenceValidators(),
    queryEmbeddingProvider,
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit,
    rateWindowSeconds,
    idempotencyTtlSeconds,
  };
};

export {
  EVIDENCE_BUNDLES_ROUTE,
  SEARCH_ROUTE,
  SearchEvidenceRepositoryError,
} from "./searchEvidenceTypes.js";
export {
  handleSearchEvidenceV1,
  InMemorySearchEvidenceRepository,
  loadSearchEvidenceValidators,
  PostgresSearchEvidenceRepository,
};
export type * from "./searchEvidenceTypes.js";
