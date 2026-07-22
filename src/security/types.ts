import type { SecurityPermission, SecurityRole } from "./rbac.js";

export interface CredentialPrincipalRecord {
  credentialId: string;
  tenantId: string;
  principalId: string;
  roles: readonly SecurityRole[];
}

export interface AuthenticatedPrincipal extends CredentialPrincipalRecord {
  permissions: readonly SecurityPermission[];
}

export interface IdentityRepository {
  /** Receives a lowercase SHA-256 hex digest, never the raw Bearer credential. */
  authenticateByCredentialHash(credentialSha256: string): Promise<CredentialPrincipalRecord | null>;
}
