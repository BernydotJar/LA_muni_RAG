import { isSecurityPermission, type SecurityPermission } from "./rbac.js";
import { isCanonicalUuid } from "./tenant.js";

export const SECURITY_AUDIT_EVENT_TYPES = [
  "identity.authentication_succeeded",
  "identity.authentication_failed",
  "identity.authorization_allowed",
  "identity.authorization_denied",
  "identity.tenant_access_allowed",
  "identity.tenant_access_denied",
] as const;

export type SecurityAuditEventType = (typeof SECURITY_AUDIT_EVENT_TYPES)[number];

export const SECURITY_AUDIT_OUTCOMES = ["success", "error", "blocked"] as const;
export type SecurityAuditOutcome = (typeof SECURITY_AUDIT_OUTCOMES)[number];

export const SECURITY_AUDIT_REASON_CODES = [
  "authenticated",
  "credential_rejected",
  "permission_granted",
  "permission_denied",
  "tenant_match",
  "tenant_mismatch",
] as const;
export type SecurityAuditReasonCode = (typeof SECURITY_AUDIT_REASON_CODES)[number];

export class SecurityAuditValidationError extends Error {
  constructor() {
    super("Invalid security audit event");
    this.name = "SecurityAuditValidationError";
  }
}

export interface SecurityAuditEventInput {
  tenantId: string;
  principalId?: string;
  eventType: SecurityAuditEventType;
  outcome: SecurityAuditOutcome;
  reasonCode: SecurityAuditReasonCode;
  requestId?: string;
  route?: string;
  permission?: SecurityPermission;
}

export interface SecurityAuditEvent {
  tenantId: string;
  actorExternalId: string | null;
  eventType: SecurityAuditEventType;
  outcome: SecurityAuditOutcome;
  entitySchema: "identity";
  entityTable: "principals";
  entityId: string | null;
  details: Readonly<Record<string, string>>;
}

const safeToken = (value: string, maxLength: number): string | null =>
  value.length > 0 && value.length <= maxLength && /^[A-Za-z0-9._:-]+$/.test(value) ? value : null;

const safeRoute = (value: string): string | null =>
  value.length <= 200 && /^\/[A-Za-z0-9/_.:-]*$/.test(value) ? value : null;

export const buildSecurityAuditEvent = (input: SecurityAuditEventInput): SecurityAuditEvent => {
  if (!isCanonicalUuid(input.tenantId)) throw new SecurityAuditValidationError();
  if (input.principalId !== undefined && !isCanonicalUuid(input.principalId)) {
    throw new SecurityAuditValidationError();
  }
  if (!(SECURITY_AUDIT_EVENT_TYPES as readonly unknown[]).includes(input.eventType)) {
    throw new SecurityAuditValidationError();
  }
  if (!(SECURITY_AUDIT_OUTCOMES as readonly unknown[]).includes(input.outcome)) {
    throw new SecurityAuditValidationError();
  }
  if (!(SECURITY_AUDIT_REASON_CODES as readonly unknown[]).includes(input.reasonCode)) {
    throw new SecurityAuditValidationError();
  }
  if (input.permission !== undefined && !isSecurityPermission(input.permission)) {
    throw new SecurityAuditValidationError();
  }

  const details: Record<string, string> = { reasonCode: input.reasonCode };
  if (input.requestId !== undefined) {
    const requestId = safeToken(input.requestId, 128);
    if (!requestId) throw new SecurityAuditValidationError();
    details.requestId = requestId;
  }
  if (input.route !== undefined) {
    const route = safeRoute(input.route);
    if (!route) throw new SecurityAuditValidationError();
    details.route = route;
  }
  if (input.permission !== undefined) details.permission = input.permission;

  const principalId = input.principalId?.toLowerCase() ?? null;
  return Object.freeze({
    tenantId: input.tenantId.toLowerCase(),
    actorExternalId: principalId,
    eventType: input.eventType,
    outcome: input.outcome,
    entitySchema: "identity",
    entityTable: "principals",
    entityId: principalId,
    details: Object.freeze(details),
  });
};
