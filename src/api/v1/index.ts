import { randomUUID } from "node:crypto";
import type { DomainPack } from "../../domain/registry.js";
import { pool } from "../../db.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import { createDefaultProcedureWorkflowCompiler } from "./compiler.js";
import { loadProcedureQueryContractValidators } from "./contracts.js";
import { handleProcedureQueryV1 } from "./handler.js";
import {
  InMemoryProcedureQueryPersistence,
  PostgresProcedureQueryPersistence,
} from "./persistence.js";
import type {
  AuthenticationFailureRecorder,
  ProcedureQueryApiDependencies,
  ProcedureQueryPersistence,
} from "./types.js";

export interface ProcedureQueryV1Options
extends Partial<Omit<ProcedureQueryApiDependencies, "persistence" | "authenticationFailureRecorder">> {
  persistence?: ProcedureQueryPersistence;
  authenticationFailureRecorder?: AuthenticationFailureRecorder;
}

const hasAuthenticationFailureRecorder = (
  value: ProcedureQueryPersistence
): value is ProcedureQueryPersistence & AuthenticationFailureRecorder =>
  "recordAuthenticationFailure" in value &&
  typeof (value as { recordAuthenticationFailure?: unknown }).recordAuthenticationFailure === "function";

export const createProcedureQueryV1Dependencies = (
  options: ProcedureQueryV1Options = {},
  domainPack?: DomainPack
): ProcedureQueryApiDependencies => {
  const rateLimit = options.rateLimit ?? 30;
  const rateWindowSeconds = options.rateWindowSeconds ?? 60;
  if (!Number.isInteger(rateLimit) || rateLimit < 1) {
    throw new Error("procedure query rateLimit must be a positive integer");
  }
  if (!Number.isInteger(rateWindowSeconds) || rateWindowSeconds < 1) {
    throw new Error("procedure query rateWindowSeconds must be a positive integer");
  }
  const postgresPersistence = new PostgresProcedureQueryPersistence();
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
    validators: options.validators ?? loadProcedureQueryContractValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit,
    rateWindowSeconds,
  };
};

export {
  createDefaultProcedureWorkflowCompiler,
  handleProcedureQueryV1,
  InMemoryProcedureQueryPersistence,
  loadProcedureQueryContractValidators,
  PostgresProcedureQueryPersistence,
};
export { detectProductBoundaryViolation } from "./boundary.js";
export {
  bindCitationLabelToEvidenceIdentity,
  bindScopedEvidenceRecord,
  evidenceIdentityFromCitationLabel,
} from "./evidenceIdentity.js";
export { mapProcedureWorkflowV1, deterministicUuid, MIXCO_COMPARATIVE_WARNING } from "./mapper.js";
export type * from "./types.js";
