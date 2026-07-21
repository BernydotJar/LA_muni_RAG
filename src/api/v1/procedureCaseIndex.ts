import { randomUUID } from "node:crypto";
import { pool } from "../../db.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import {
  InMemoryProcedureCaseRepository,
  PostgresProcedureCaseRepository,
} from "../../procedureCases/repository.js";
import { loadProcedureCaseValidators } from "./procedureCaseContracts.js";
import { handleProcedureCaseV1 } from "./procedureCaseHandler.js";
import type {
  ProcedureCaseApiDependencies,
  ProcedureCaseRepository,
} from "./procedureCaseTypes.js";

export interface ProcedureCaseV1Options
  extends Partial<Omit<ProcedureCaseApiDependencies, "repository">> {
  repository?: ProcedureCaseRepository;
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

export const createProcedureCaseV1Dependencies = (
  options: ProcedureCaseV1Options = {}
): ProcedureCaseApiDependencies => {
  const transactionPool = options.transactionPool ?? pool;
  const rateLimit = boundedInteger(options.rateLimit ?? 120, "procedure case rateLimit", 1, 10_000);
  const rateWindowSeconds = boundedInteger(
    options.rateWindowSeconds ?? 60,
    "procedure case rateWindowSeconds",
    1,
    86_400
  );
  const idempotencyTtlSeconds = boundedInteger(
    options.idempotencyTtlSeconds ?? 86_400,
    "procedure case idempotencyTtlSeconds",
    60,
    7 * 86_400
  );
  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool,
    repository: options.repository ?? new PostgresProcedureCaseRepository(transactionPool),
    validators: options.validators ?? loadProcedureCaseValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit,
    rateWindowSeconds,
    idempotencyTtlSeconds,
  };
};

export {
  handleProcedureCaseV1,
  InMemoryProcedureCaseRepository,
  loadProcedureCaseValidators,
  PostgresProcedureCaseRepository,
};
export * from "./procedureCaseTypes.js";
