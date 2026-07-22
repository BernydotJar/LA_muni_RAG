export type SecurityErrorCode = "unauthorized" | "forbidden";

/**
 * Safe transport-neutral security error. HTTP integration is intentionally left
 * to the API layer; callers must preserve this status/code/message verbatim.
 */
export class SecurityError extends Error {
  constructor(
    public readonly statusCode: 401 | 403,
    public readonly code: SecurityErrorCode,
    message: string
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

export const authenticationRequired = (): SecurityError =>
  new SecurityError(401, "unauthorized", "Authentication required");

/**
 * Permission denials and tenant mismatches deliberately share one response so
 * an attacker cannot infer whether a tenant or protected object exists.
 */
export const accessDenied = (): SecurityError =>
  new SecurityError(403, "forbidden", "Access denied");
