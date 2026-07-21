import { randomUUID } from "node:crypto";
import { pool } from "../../db.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import { loadEvidenceGapContractValidators } from "./contracts.js";
import { handleEvidenceGapV1 } from "./evidenceGapHandler.js";
import { mapEvidenceGapResponseV1 } from "./evidenceGapMapper.js";
import {
  InMemoryEvidenceGapPersistence,
  PostgresEvidenceGapPersistence,
} from "./evidenceGapPersistence.js";
import {
  EVIDENCE_GAP_ROUTE,
  type EvidenceGapApiDependencies,
  type EvidenceGapAuthenticationFailureRecorder,
  type EvidenceGapPersistence,
} from "./evidenceGapTypes.js";

export interface EvidenceGapV1Options
extends Partial<Omit<EvidenceGapApiDependencies, "persistence" | "authenticationFailureRecorder">> {
  persistence?: EvidenceGapPersistence;
  authenticationFailureRecorder?: EvidenceGapAuthenticationFailureRecorder;
}

const hasAuthenticationFailureRecorder = (
  value: EvidenceGapPersistence
): value is EvidenceGapPersistence & EvidenceGapAuthenticationFailureRecorder =>
  "recordAuthenticationFailure" in value &&
  typeof (value as { recordAuthenticationFailure?: unknown }).recordAuthenticationFailure === "function";

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

export const createEvidenceGapV1Dependencies = (
  options: EvidenceGapV1Options = {}
): EvidenceGapApiDependencies => {
  const rateLimit = boundedInteger(options.rateLimit ?? 30, "evidence gap rateLimit", 1, 10_000);
  const rateWindowSeconds = boundedInteger(
    options.rateWindowSeconds ?? 60,
    "evidence gap rateWindowSeconds",
    1,
    86_400
  );
  const postgresPersistence = new PostgresEvidenceGapPersistence();
  const persistence = options.persistence ?? postgresPersistence;
  const authenticationFailureRecorder =
    options.authenticationFailureRecorder ??
    (hasAuthenticationFailureRecorder(persistence) ? persistence : postgresPersistence);

  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool: options.transactionPool ?? pool,
    persistence,
    authenticationFailureRecorder,
    validators: options.validators ?? loadEvidenceGapContractValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit,
    rateWindowSeconds,
  };
};

export {
  EVIDENCE_GAP_ROUTE,
  handleEvidenceGapV1,
  InMemoryEvidenceGapPersistence,
  loadEvidenceGapContractValidators,
  mapEvidenceGapResponseV1,
  PostgresEvidenceGapPersistence,
};
export type * from "./evidenceGapTypes.js";
