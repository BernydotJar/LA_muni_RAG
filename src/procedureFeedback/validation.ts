import { HttpError } from "../http.js";
import {
  PROCEDURE_CONFIDENCE,
  PROCEDURE_FEEDBACK_TYPES,
  PROCEDURE_JURISDICTIONS,
  PROCEDURE_TYPES,
  type ProcedureFeedbackFilters,
  type ProcedureFeedbackInput,
  type ProcedureFeedbackType,
} from "./types.js";

const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

const normalizeText = (value: unknown, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_feedback_payload", `${field} must be a string`);
  }

  const normalized = stripControlCharacters(value.normalize("NFC")).trim();
  if (!normalized) {
    throw new HttpError(400, "invalid_feedback_payload", `${field} is required`);
  }
  if (normalized.length > maxLength) {
    throw new HttpError(400, "invalid_feedback_payload", `${field} exceeds ${maxLength} characters`);
  }
  return normalized;
};

const enumValue = <T extends readonly string[]>(
  value: unknown,
  field: string,
  allowed: T
): T[number] => {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    throw new HttpError(400, "invalid_feedback_payload", `${field} has an unsupported value`);
  }
  return value as T[number];
};

export const validateProcedureFeedbackInput = (value: unknown): ProcedureFeedbackInput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_feedback_payload", "Request body must be an object");
  }

  const body = value as Record<string, unknown>;
  return {
    workflowId: normalizeText(body.workflowId, "workflowId", 200),
    workflowTitle: normalizeText(body.workflowTitle, "workflowTitle", 300),
    procedureType: enumValue(body.procedureType, "procedureType", PROCEDURE_TYPES),
    jurisdiction: enumValue(body.jurisdiction, "jurisdiction", PROCEDURE_JURISDICTIONS),
    confidence: enumValue(body.confidence, "confidence", PROCEDURE_CONFIDENCE),
    query: normalizeText(body.query, "query", 1200),
    stepNumber: normalizeText(body.stepNumber, "stepNumber", 32),
    stepTitle: normalizeText(body.stepTitle, "stepTitle", 300),
    feedbackType: enumValue(body.feedbackType, "feedbackType", PROCEDURE_FEEDBACK_TYPES),
    comment: normalizeText(body.comment, "comment", 1200),
  };
};

const parseBoundedLimit = (value: string | null): number => {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new HttpError(400, "invalid_feedback_limit", "limit must be an integer between 1 and 100");
  }
  return parsed;
};

export const validateProcedureFeedbackFilters = (url: URL): ProcedureFeedbackFilters => {
  const feedbackTypeValue = url.searchParams.get("feedbackType")?.trim();
  const workflowIdValue = url.searchParams.get("workflowId")?.trim();

  let feedbackType: ProcedureFeedbackType | undefined;
  if (feedbackTypeValue) {
    feedbackType = enumValue(feedbackTypeValue, "feedbackType", PROCEDURE_FEEDBACK_TYPES);
  }

  return {
    limit: parseBoundedLimit(url.searchParams.get("limit")),
    feedbackType,
    workflowId: workflowIdValue ? normalizeText(workflowIdValue, "workflowId", 200) : undefined,
  };
};
