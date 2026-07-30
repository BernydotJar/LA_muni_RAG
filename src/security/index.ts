export {
  authenticateBearer,
  credentialHashesEqual,
  hashBearerCredential,
  MAX_AUTHORIZATION_HEADER_LENGTH,
  MAX_BEARER_TOKEN_LENGTH,
  MIN_BEARER_TOKEN_LENGTH,
} from "./auth.js";
export {
  buildSecurityAuditEvent,
  SECURITY_AUDIT_EVENT_TYPES,
  SECURITY_AUDIT_OUTCOMES,
  SECURITY_AUDIT_REASON_CODES,
  SecurityAuditValidationError,
} from "./audit.js";
export { accessDenied, authenticationRequired, SecurityError } from "./errors.js";
export {
  hasPermission,
  isSecurityPermission,
  isSecurityRole,
  permissionsForRoles,
  requirePermission,
  ROLE_PERMISSIONS,
  SECURITY_PERMISSIONS,
  SECURITY_ROLES,
} from "./rbac.js";
export { PostgresIdentityRepository } from "./repository.js";
export {
  isCanonicalUuid,
  requireTenantMatch,
  tenantIdsEqual,
  withTenantTransaction,
} from "./tenant.js";
export type {
  SecurityAuditEvent,
  SecurityAuditEventInput,
  SecurityAuditEventType,
  SecurityAuditOutcome,
  SecurityAuditReasonCode,
} from "./audit.js";
export type { SecurityPermission, SecurityRole } from "./rbac.js";
export type { TenantTransactionClient, TenantTransactionPool } from "./tenant.js";
export type {
  AuthenticatedPrincipal,
  CredentialPrincipalRecord,
  IdentityRepository,
} from "./types.js";
