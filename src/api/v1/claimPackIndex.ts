import { randomUUID } from "node:crypto";
import type { DomainPack } from "../../domain/registry.js";
import { pool } from "../../db.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import { createDefaultProcedureWorkflowCompiler } from "./compiler.js";
import { loadClaimPackContractValidators } from "./contracts.js";
import { handleClaimPackV1 } from "./claimPackHandler.js";
import {
  InMemoryClaimPackPersistence,
  PostgresClaimPackPersistence,
} from "./claimPackPersistence.js";
import {
  CLAIM_PACK_ROUTE,
  type ClaimPackApiDependencies,
  type ClaimPackAuthenticationFailureRecorder,
  type ClaimPackPersistence,
} from "./claimPackTypes.js";

export interface ClaimPackV1Options
extends Partial<Omit<ClaimPackApiDependencies, "persistence" | "authenticationFailureRecorder">> {
  persistence?: ClaimPackPersistence;
  authenticationFailureRecorder?: ClaimPackAuthenticationFailureRecorder;
}

const hasAuthenticationFailureRecorder = (
  value: ClaimPackPersistence
): value is ClaimPackPersistence & ClaimPackAuthenticationFailureRecorder =>
  "recordAuthenticationFailure" in value &&
  typeof (value as { recordAuthenticationFailure?: unknown }).recordAuthenticationFailure === "function";

export const createClaimPackV1Dependencies = (
  options: ClaimPackV1Options = {},
  domainPack?: DomainPack
): ClaimPackApiDependencies => {
  const rateLimit = options.rateLimit ?? 30;
  const rateWindowSeconds = options.rateWindowSeconds ?? 60;
  const validitySeconds = options.validitySeconds ?? 86_400;
  if (!Number.isInteger(rateLimit) || rateLimit < 1 || rateLimit > 10_000) {
    throw new Error("claim pack rateLimit must be an integer between 1 and 10000");
  }
  if (
    !Number.isInteger(rateWindowSeconds) ||
    rateWindowSeconds < 1 ||
    rateWindowSeconds > 86_400
  ) {
    throw new Error("claim pack rateWindowSeconds must be an integer between 1 and 86400");
  }
  if (
    !Number.isInteger(validitySeconds) ||
    validitySeconds < 60 ||
    validitySeconds > 86_400
  ) {
    throw new Error("claim pack validitySeconds must be an integer between 60 and 86400");
  }

  const postgresPersistence = new PostgresClaimPackPersistence();
  const persistence = options.persistence ?? postgresPersistence;
  const authenticationFailureRecorder =
    options.authenticationFailureRecorder ??
    (hasAuthenticationFailureRecorder(persistence) ? persistence : postgresPersistence);

  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool: options.transactionPool ?? pool,
    persistence,
    authenticationFailureRecorder,
    compiler: options.compiler ?? createDefaultProcedureWorkflowCompiler(domainPack),
    validators: options.validators ?? loadClaimPackContractValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit,
    rateWindowSeconds,
    validitySeconds,
  };
};

export {
  CLAIM_PACK_ROUTE,
  handleClaimPackV1,
  InMemoryClaimPackPersistence,
  loadClaimPackContractValidators,
  PostgresClaimPackPersistence,
};
export { mapClaimPackV1 } from "./mapper.js";
export type * from "./claimPackTypes.js";
