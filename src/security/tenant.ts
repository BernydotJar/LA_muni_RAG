import { timingSafeEqual } from "node:crypto";
import { accessDenied } from "./errors.js";
import type { AuthenticatedPrincipal } from "./types.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isCanonicalUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const uuidBytes = (value: string): Buffer => Buffer.from(value.replaceAll("-", "").toLowerCase(), "hex");

export const tenantIdsEqual = (actual: string, expected: string): boolean => {
  if (!isCanonicalUuid(actual) || !isCanonicalUuid(expected)) return false;
  const actualBytes = uuidBytes(actual);
  const expectedBytes = uuidBytes(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
};

/** Tenant mismatch deliberately returns the same 403 as a missing permission. */
export const requireTenantMatch = (
  principal: AuthenticatedPrincipal,
  requestedTenantId: string
): void => {
  if (!tenantIdsEqual(principal.tenantId, requestedTenantId)) throw accessDenied();
};

export interface TenantTransactionClient {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  release(): void;
}

export interface TenantTransactionPool {
  connect(): Promise<TenantTransactionClient>;
}

/**
 * Run tenant-scoped database work with a transaction-local PostgreSQL setting.
 * RLS denies access before the setting is established and after COMMIT/ROLLBACK.
 */
export const withTenantTransaction = async <T>(
  pool: TenantTransactionPool,
  tenantId: string,
  operation: (client: TenantTransactionClient) => Promise<T>
): Promise<T> => {
  if (!isCanonicalUuid(tenantId)) throw new Error("Invalid tenant context");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId.toLowerCase()]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original failure; the pool will discard a broken client.
    }
    throw error;
  } finally {
    client.release();
  }
};
