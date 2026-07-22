import { accessDenied } from "./errors.js";
import type { AuthenticatedPrincipal } from "./types.js";

export const SECURITY_ROLES = [
  "platform_admin",
  "tenant_admin",
  "document_manager",
  "researcher",
  "procedure_author",
  "procedure_reviewer",
  "procedure_approver",
  "case_operator",
  "viewer",
  "integration_client",
] as const;

export type SecurityRole = (typeof SECURITY_ROLES)[number];

export const SECURITY_PERMISSIONS = [
  "platform:admin",
  "tenant:manage",
  "identity:manage",
  "source:read",
  "source:write",
  "document:read",
  "document:write",
  "document:ingest",
  "evidence:query",
  "procedure:read",
  "procedure:draft",
  "procedure:review",
  "procedure:approve",
  "case:read",
  "case:write",
  "audit:read",
  "integration:query",
] as const;

export type SecurityPermission = (typeof SECURITY_PERMISSIONS)[number];

const permissions = (...values: SecurityPermission[]): readonly SecurityPermission[] =>
  Object.freeze(values);

/**
 * Explicit, least-privilege application roles. A platform administrator has
 * every permission but is still bound to the authenticated credential tenant.
 */
export const ROLE_PERMISSIONS: Readonly<Record<SecurityRole, readonly SecurityPermission[]>> =
  Object.freeze({
    platform_admin: permissions(...SECURITY_PERMISSIONS),
    tenant_admin: permissions(
      "tenant:manage",
      "identity:manage",
      "source:read",
      "source:write",
      "document:read",
      "document:write",
      "document:ingest",
      "evidence:query",
      "procedure:read",
      "procedure:draft",
      "procedure:review",
      "case:read",
      "case:write",
      "audit:read"
    ),
    document_manager: permissions(
      "source:read",
      "source:write",
      "document:read",
      "document:write",
      "document:ingest",
      "evidence:query",
      "procedure:read"
    ),
    researcher: permissions(
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "case:read"
    ),
    procedure_author: permissions(
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "procedure:draft"
    ),
    procedure_reviewer: permissions(
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "procedure:review"
    ),
    procedure_approver: permissions(
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "procedure:approve"
    ),
    case_operator: permissions(
      "document:read",
      "evidence:query",
      "procedure:read",
      "case:read",
      "case:write"
    ),
    viewer: permissions(
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "case:read"
    ),
    integration_client: permissions(
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "integration:query"
    ),
  });

export const isSecurityRole = (value: unknown): value is SecurityRole =>
  typeof value === "string" && (SECURITY_ROLES as readonly string[]).includes(value);

export const isSecurityPermission = (value: unknown): value is SecurityPermission =>
  typeof value === "string" && (SECURITY_PERMISSIONS as readonly string[]).includes(value);

export const permissionsForRoles = (roles: readonly SecurityRole[]): readonly SecurityPermission[] => {
  const granted = new Set<SecurityPermission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) granted.add(permission);
  }
  return Object.freeze(SECURITY_PERMISSIONS.filter((permission) => granted.has(permission)));
};

export const hasPermission = (
  principal: AuthenticatedPrincipal,
  permission: SecurityPermission
): boolean => principal.permissions.includes(permission);

export const requirePermission = (
  principal: AuthenticatedPrincipal,
  permission: SecurityPermission
): void => {
  if (!hasPermission(principal, permission)) throw accessDenied();
};
