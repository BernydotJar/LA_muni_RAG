import { randomUUID } from "node:crypto";
import { pool } from "../../db.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import {
  InMemoryWorkflowLifecycleRepository,
  PostgresWorkflowLifecycleRepository,
} from "../../workflowLifecycle/repository.js";
import { loadWorkflowLifecycleValidators } from "./workflowLifecycleContracts.js";
import { handleWorkflowLifecycleV1 } from "./workflowLifecycleHandler.js";
import type {
  WorkflowLifecycleApiDependencies,
  WorkflowLifecycleRepository,
} from "./workflowLifecycleTypes.js";

export interface WorkflowLifecycleV1Options
  extends Partial<Omit<WorkflowLifecycleApiDependencies, "repository">> {
  repository?: WorkflowLifecycleRepository;
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

export const createWorkflowLifecycleV1Dependencies = (
  options: WorkflowLifecycleV1Options = {}
): WorkflowLifecycleApiDependencies => {
  const transactionPool = options.transactionPool ?? pool;
  const rateLimit = boundedInteger(options.rateLimit ?? 60, "workflow lifecycle rateLimit", 1, 10_000);
  const rateWindowSeconds = boundedInteger(
    options.rateWindowSeconds ?? 60,
    "workflow lifecycle rateWindowSeconds",
    1,
    86_400
  );
  const idempotencyTtlSeconds = boundedInteger(
    options.idempotencyTtlSeconds ?? 86_400,
    "workflow lifecycle idempotencyTtlSeconds",
    60,
    7 * 86_400
  );

  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool,
    repository:
      options.repository ?? new PostgresWorkflowLifecycleRepository(transactionPool),
    validators: options.validators ?? loadWorkflowLifecycleValidators(),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
    rateLimit,
    rateWindowSeconds,
    idempotencyTtlSeconds,
  };
};

export {
  handleWorkflowLifecycleV1,
  InMemoryWorkflowLifecycleRepository,
  loadWorkflowLifecycleValidators,
  PostgresWorkflowLifecycleRepository,
};
export * from "./workflowLifecycleTypes.js";
