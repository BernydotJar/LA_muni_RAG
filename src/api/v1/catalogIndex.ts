import { randomUUID } from "node:crypto";
import { pool } from "../../db.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import {
  InMemoryCatalogRepository,
  PostgresCatalogRepository,
} from "../../catalog/repository.js";
import { loadCatalogValidators } from "./catalogContracts.js";
import { handleCatalogV1 } from "./catalogHandler.js";
import type { CatalogApiDependencies, CatalogRepository } from "./catalogTypes.js";

export interface CatalogV1Options extends Partial<Omit<CatalogApiDependencies, "repository">> {
  repository?: CatalogRepository;
}

const boundedInteger = (
  value: number,
  name: string,
  minimum: number,
  maximum: number
): number => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
};

export const createCatalogV1Dependencies = (
  options: CatalogV1Options = {}
): CatalogApiDependencies => {
  const transactionPool = options.transactionPool ?? pool;
  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool,
    repository: options.repository ?? new PostgresCatalogRepository(transactionPool),
    validators: options.validators ?? loadCatalogValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit: boundedInteger(options.rateLimit ?? 180, "catalog rateLimit", 1, 10_000),
    rateWindowSeconds: boundedInteger(options.rateWindowSeconds ?? 60, "catalog rateWindowSeconds", 1, 86_400),
    idempotencyTtlSeconds: boundedInteger(options.idempotencyTtlSeconds ?? 86_400, "catalog idempotencyTtlSeconds", 60, 7 * 86_400),
  };
};

export {
  handleCatalogV1,
  InMemoryCatalogRepository,
  loadCatalogValidators,
  PostgresCatalogRepository,
};
export * from "./catalogTypes.js";
