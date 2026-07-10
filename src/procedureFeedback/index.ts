import { HttpError } from "../http.js";
import { PostgresProcedureFeedbackRepository } from "./repository.js";
import { InMemoryProcedureFeedbackRateLimiter } from "./rateLimit.js";
import type {
  ProcedureFeedbackDependencies,
  ProcedureFeedbackFilters,
  ProcedureFeedbackInput,
  ProcedureFeedbackListResult,
  ProcedureFeedbackRecord,
} from "./types.js";

export const createProcedureFeedbackDependencies = (): ProcedureFeedbackDependencies => ({
  repository: new PostgresProcedureFeedbackRepository(),
  apiToken: process.env.PROCEDURE_FEEDBACK_API_TOKEN,
  rateLimiter: new InMemoryProcedureFeedbackRateLimiter(),
});

export const createProcedureFeedback = async (
  input: ProcedureFeedbackInput,
  clientKey: string,
  dependencies: ProcedureFeedbackDependencies
): Promise<ProcedureFeedbackRecord> => {
  if (!dependencies.rateLimiter.consume(clientKey)) {
    throw new HttpError(429, "feedback_rate_limited", "Too many procedure feedback submissions");
  }
  return dependencies.repository.create(input);
};

export const listProcedureFeedback = async (
  filters: ProcedureFeedbackFilters,
  dependencies: ProcedureFeedbackDependencies
): Promise<ProcedureFeedbackListResult> => dependencies.repository.list(filters);

export { requireProcedureFeedbackAuth } from "./auth.js";
export { validateProcedureFeedbackFilters, validateProcedureFeedbackInput } from "./validation.js";
export type {
  ProcedureConfidence,
  ProcedureFeedbackDependencies,
  ProcedureFeedbackFilters,
  ProcedureFeedbackInput,
  ProcedureFeedbackListResult,
  ProcedureFeedbackRecord,
  ProcedureFeedbackRepository,
  ProcedureFeedbackType,
  ProcedureJurisdiction,
  ProcedureType,
} from "./types.js";
