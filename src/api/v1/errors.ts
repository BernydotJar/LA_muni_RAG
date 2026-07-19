import type {
  ApiErrorDetailV1,
  ApiErrorV1,
  ProcedureQueryContractValidators,
} from "./types.js";

export type ApiV1Status = ApiErrorV1["http_status"];

export class ApiV1Error extends Error {
  constructor(
    public readonly statusCode: ApiV1Status,
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorDetailV1[] = [],
    public readonly retryable = false
  ) {
    super(message);
    this.name = "ApiV1Error";
  }
}

export interface ErrorIdentityContext {
  tenantId: string | null;
  credentialId: string | null;
  requestId: string;
  auditId: string;
  createdAt: string;
}

export const buildApiError = (
  error: ApiV1Error,
  context: ErrorIdentityContext
): ApiErrorV1 => ({
  schema_version: "v1",
  response_type: "api_error",
  tenant_id: context.tenantId,
  request_id: context.requestId,
  audit_id: context.auditId,
  http_status: error.statusCode,
  retryable: error.retryable,
  error: {
    code: error.code,
    message: error.message,
    details: error.details,
  },
  provenance: {
    source_product: "la_muni_rag",
    generated_by: "system",
    created_at: context.createdAt,
    source_refs: [],
    credential_id: context.credentialId,
    audit_id: context.auditId,
  },
});

export const serializeValidatedApiError = (
  error: ApiV1Error,
  context: ErrorIdentityContext,
  validators: ProcedureQueryContractValidators
): string => {
  const body = buildApiError(error, context);
  if (!validators.apiError(body)) {
    throw new Error("Generated ApiError failed the canonical v1 contract");
  }
  return JSON.stringify(body);
};

export const unauthorizedError = (): ApiV1Error =>
  new ApiV1Error(401, "unauthorized", "Authentication required");

export const forbiddenError = (): ApiV1Error =>
  new ApiV1Error(403, "forbidden", "Access denied");

export const internalError = (): ApiV1Error =>
  new ApiV1Error(500, "internal_error", "Unexpected server error", [], true);
