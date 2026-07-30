import { createHash, timingSafeEqual } from "node:crypto";
import { authenticationRequired } from "./errors.js";
import { isSecurityRole, permissionsForRoles, type SecurityRole } from "./rbac.js";
import { isCanonicalUuid } from "./tenant.js";
import type { AuthenticatedPrincipal, IdentityRepository } from "./types.js";

export const MIN_BEARER_TOKEN_LENGTH = 32;
export const MAX_BEARER_TOKEN_LENGTH = 512;
export const MAX_AUTHORIZATION_HEADER_LENGTH = 640;

const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;

const parseBearerCredential = (header: string | string[] | undefined): string | null => {
  if (typeof header !== "string" || header.length > MAX_AUTHORIZATION_HEADER_LENGTH) return null;
  const match = /^Bearer +([^ ]+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token) return null;
  if (token.length < MIN_BEARER_TOKEN_LENGTH || token.length > MAX_BEARER_TOKEN_LENGTH) return null;
  if (!TOKEN_PATTERN.test(token)) return null;
  return token;
};

export const hashBearerCredential = (credential: string): string =>
  createHash("sha256").update(credential, "utf8").digest("hex");

/** Useful for memory adapters and tests; both decoded hashes are always 32 bytes. */
export const credentialHashesEqual = (actual: string, expected: string): boolean => {
  if (!SHA256_HEX_PATTERN.test(actual) || !SHA256_HEX_PATTERN.test(expected)) return false;
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return timingSafeEqual(actualBytes, expectedBytes);
};

const validRoles = (value: unknown): value is readonly SecurityRole[] =>
  Array.isArray(value) && value.length > 0 && value.every(isSecurityRole);

export const authenticateBearer = async (
  authorizationHeader: string | string[] | undefined,
  repository: IdentityRepository
): Promise<AuthenticatedPrincipal> => {
  const credential = parseBearerCredential(authorizationHeader);
  if (!credential) throw authenticationRequired();

  const credentialSha256 = hashBearerCredential(credential);
  const record = await repository.authenticateByCredentialHash(credentialSha256);
  if (
    !record ||
    !isCanonicalUuid(record.credentialId) ||
    !isCanonicalUuid(record.tenantId) ||
    !isCanonicalUuid(record.principalId) ||
    !validRoles(record.roles)
  ) {
    throw authenticationRequired();
  }

  const roles = Object.freeze([...new Set(record.roles)]);
  return Object.freeze({
    credentialId: record.credentialId.toLowerCase(),
    tenantId: record.tenantId.toLowerCase(),
    principalId: record.principalId.toLowerCase(),
    roles,
    permissions: permissionsForRoles(roles),
  });
};
