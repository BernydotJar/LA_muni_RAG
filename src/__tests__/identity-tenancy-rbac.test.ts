import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authenticateBearer,
  buildSecurityAuditEvent,
  credentialHashesEqual,
  hashBearerCredential,
  MAX_AUTHORIZATION_HEADER_LENGTH,
  MAX_BEARER_TOKEN_LENGTH,
  MIN_BEARER_TOKEN_LENGTH,
  permissionsForRoles,
  requirePermission,
  requireTenantMatch,
  ROLE_PERMISSIONS,
  SECURITY_PERMISSIONS,
  SECURITY_ROLES,
  SecurityAuditValidationError,
  SecurityError,
  withTenantTransaction,
  type AuthenticatedPrincipal,
  type CredentialPrincipalRecord,
  type IdentityRepository,
  type SecurityPermission,
  type SecurityRole,
  type TenantTransactionClient,
  type TenantTransactionPool,
} from "../security/index.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";
const CREDENTIAL_ID = "44444444-4444-4444-8444-444444444444";
const VALID_TOKEN = "tenant-a-integration-credential-000001";

class CapturingIdentityRepository implements IdentityRepository {
  readonly hashes: string[] = [];

  constructor(private readonly record: CredentialPrincipalRecord | null) {}

  async authenticateByCredentialHash(credentialSha256: string): Promise<CredentialPrincipalRecord | null> {
    this.hashes.push(credentialSha256);
    return this.record;
  }
}

const record = (roles: readonly SecurityRole[] = ["integration_client"]): CredentialPrincipalRecord => ({
  credentialId: CREDENTIAL_ID,
  tenantId: TENANT_A,
  principalId: PRINCIPAL_ID,
  roles,
});

const principal = (roles: readonly SecurityRole[]): AuthenticatedPrincipal => ({
  ...record(roles),
  permissions: permissionsForRoles(roles),
});

const expectSecurityError = async (
  run: () => Promise<unknown> | unknown,
  expected: { statusCode: 401 | 403; code: "unauthorized" | "forbidden"; message: string }
): Promise<void> => {
  await assert.rejects(async () => run(), (error: unknown) => {
    assert.ok(error instanceof SecurityError);
    assert.equal(error.statusCode, expected.statusCode);
    assert.equal(error.code, expected.code);
    assert.equal(error.message, expected.message);
    return true;
  });
};

describe("identity, tenancy, and RBAC foundation", () => {
  it("defines the exact ten required roles and an explicit valid permission map", () => {
    assert.deepEqual(SECURITY_ROLES, [
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
    ]);
    assert.deepEqual(Object.keys(ROLE_PERMISSIONS), SECURITY_ROLES);

    const knownPermissions = new Set<string>(SECURITY_PERMISSIONS);
    for (const role of SECURITY_ROLES) {
      assert.ok(ROLE_PERMISSIONS[role].length > 0, `${role} must grant at least one permission`);
      assert.equal(new Set(ROLE_PERMISSIONS[role]).size, ROLE_PERMISSIONS[role].length);
      for (const permission of ROLE_PERMISSIONS[role]) assert.ok(knownPermissions.has(permission));
    }
    assert.deepEqual(ROLE_PERMISSIONS.platform_admin, SECURITY_PERMISSIONS);
    assert.ok(!ROLE_PERMISSIONS.tenant_admin.includes("procedure:approve"));
    assert.deepEqual(ROLE_PERMISSIONS.procedure_approver, [
      "source:read",
      "document:read",
      "evidence:query",
      "procedure:read",
      "procedure:approve",
    ]);
  });

  it("hashes a valid Bearer credential before the repository boundary", async () => {
    const repository = new CapturingIdentityRepository(record());
    const authenticated = await authenticateBearer(`Bearer ${VALID_TOKEN}`, repository);

    assert.equal(repository.hashes.length, 1);
    assert.equal(repository.hashes[0], hashBearerCredential(VALID_TOKEN));
    assert.match(repository.hashes[0] ?? "", /^[0-9a-f]{64}$/);
    assert.ok(!repository.hashes[0]?.includes(VALID_TOKEN));
    assert.equal(authenticated.tenantId, TENANT_A);
    assert.deepEqual(authenticated.roles, ["integration_client"]);
    assert.ok(authenticated.permissions.includes("integration:query"));
    assert.ok(!("credential" in authenticated));
  });

  it("uses equal-length timing-safe digest comparison semantics", () => {
    const digest = hashBearerCredential(VALID_TOKEN);
    assert.equal(credentialHashesEqual(digest, digest.toUpperCase()), true);
    assert.equal(credentialHashesEqual(digest, hashBearerCredential(`${VALID_TOKEN}-different`)), false);
    assert.equal(credentialHashesEqual("short", digest), false);
  });

  it("enforces Bearer token and header boundaries before repository access", async () => {
    const repository = new CapturingIdentityRepository(record());
    const malformedHeaders: Array<string | string[] | undefined> = [
      undefined,
      "Basic abc",
      `Bearer ${"a".repeat(MIN_BEARER_TOKEN_LENGTH - 1)}`,
      `Bearer ${"a".repeat(MAX_BEARER_TOKEN_LENGTH + 1)}`,
      `Bearer ${"a".repeat(MIN_BEARER_TOKEN_LENGTH - 1)} space`,
      ["Bearer duplicate", "Bearer duplicate"],
      "x".repeat(MAX_AUTHORIZATION_HEADER_LENGTH + 1),
    ];

    for (const header of malformedHeaders) {
      await expectSecurityError(() => authenticateBearer(header, repository), {
        statusCode: 401,
        code: "unauthorized",
        message: "Authentication required",
      });
    }
    assert.deepEqual(repository.hashes, []);

    const boundaryRepository = new CapturingIdentityRepository(record());
    await authenticateBearer(`Bearer ${"a".repeat(MIN_BEARER_TOKEN_LENGTH)}`, boundaryRepository);
    await authenticateBearer(`Bearer ${"b".repeat(MAX_BEARER_TOKEN_LENGTH)}`, boundaryRepository);
    assert.equal(boundaryRepository.hashes.length, 2);
  });

  it("returns one uniform 401 for unknown, malformed, or role-less credentials", async () => {
    const cases: Array<{ header: string | undefined; repository: IdentityRepository }> = [
      { header: undefined, repository: new CapturingIdentityRepository(record()) },
      { header: "Bearer too-short", repository: new CapturingIdentityRepository(record()) },
      { header: `Bearer ${VALID_TOKEN}`, repository: new CapturingIdentityRepository(null) },
      { header: `Bearer ${VALID_TOKEN}`, repository: new CapturingIdentityRepository(record([])) },
      {
        header: `Bearer ${VALID_TOKEN}`,
        repository: new CapturingIdentityRepository({ ...record(), tenantId: "not-a-uuid" }),
      },
    ];

    for (const testCase of cases) {
      await expectSecurityError(
        () => authenticateBearer(testCase.header, testCase.repository),
        { statusCode: 401, code: "unauthorized", message: "Authentication required" }
      );
    }
  });

  it("combines memberships while preserving least-privilege checks", () => {
    const combined = principal(["researcher", "procedure_author"]);
    assert.ok(combined.permissions.includes("procedure:draft"));
    assert.ok(combined.permissions.includes("case:read"));
    assert.ok(!combined.permissions.includes("procedure:approve"));
    requirePermission(combined, "procedure:draft");
  });

  it("uses the same non-leaking 403 for permission and tenant denials", async () => {
    const viewer = principal(["viewer"]);
    const platformAdmin = principal(["platform_admin"]);

    for (const run of [
      () => requirePermission(viewer, "procedure:approve"),
      () => requireTenantMatch(viewer, TENANT_B),
      () => requireTenantMatch(viewer, "malformed-tenant"),
      () => requireTenantMatch(platformAdmin, TENANT_B),
    ]) {
      await expectSecurityError(run, {
        statusCode: 403,
        code: "forbidden",
        message: "Access denied",
      });
    }

    requireTenantMatch(viewer, TENANT_A.toUpperCase());
    requirePermission(platformAdmin, "platform:admin");
  });

  it("sets tenant context transaction-locally and always releases the client", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    let released = false;
    const client: TenantTransactionClient = {
      async query(sql, values) {
        calls.push({ sql, ...(values ? { values } : {}) });
        return {};
      },
      release() {
        released = true;
      },
    };
    const pool: TenantTransactionPool = { async connect() { return client; } };

    const result = await withTenantTransaction(pool, TENANT_A.toUpperCase(), async (transaction) => {
      await transaction.query("SELECT protected_data");
      return "ok";
    });

    assert.equal(result, "ok");
    assert.deepEqual(calls, [
      { sql: "BEGIN" },
      { sql: "SELECT set_config('app.tenant_id', $1, true)", values: [TENANT_A] },
      { sql: "SELECT protected_data" },
      { sql: "COMMIT" },
    ]);
    assert.equal(released, true);
  });

  it("rolls back tenant work without replacing the original error", async () => {
    const calls: string[] = [];
    let released = false;
    const failure = new Error("repository failed");
    const client: TenantTransactionClient = {
      async query(sql) {
        calls.push(sql);
        return {};
      },
      release() { released = true; },
    };
    const pool: TenantTransactionPool = { async connect() { return client; } };

    await assert.rejects(
      () => withTenantTransaction(pool, TENANT_A, async () => { throw failure; }),
      (error) => error === failure
    );
    assert.deepEqual(calls, [
      "BEGIN",
      "SELECT set_config('app.tenant_id', $1, true)",
      "ROLLBACK",
    ]);
    assert.equal(released, true);
  });

  it("destroys the pooled client when rollback cleanup fails", async () => {
    const operationFailure = new Error("operation failed");
    const rollbackFailure = new Error("rollback failed");
    let releaseError: Error | boolean | undefined;
    const client: TenantTransactionClient = {
      async query(sql) {
        if (sql === "ROLLBACK") throw rollbackFailure;
        return {};
      },
      release(error) {
        releaseError = error;
      },
    };
    const pool: TenantTransactionPool = { async connect() { return client; } };

    await assert.rejects(
      () => withTenantTransaction(pool, TENANT_A, async () => { throw operationFailure; }),
      (error) => error === operationFailure
    );
    assert.equal(releaseError, rollbackFailure);
  });

  it("builds only allowlisted, bounded security audit data", () => {
    const event = buildSecurityAuditEvent({
      tenantId: TENANT_A,
      principalId: PRINCIPAL_ID,
      eventType: "identity.authorization_denied",
      outcome: "blocked",
      reasonCode: "permission_denied",
      requestId: "req:01-safe",
      route: "/api/v1/procedure-queries",
      permission: "procedure:approve",
    });

    assert.equal(event.tenantId, TENANT_A);
    assert.equal(event.actorExternalId, PRINCIPAL_ID);
    assert.deepEqual(event.details, {
      reasonCode: "permission_denied",
      requestId: "req:01-safe",
      route: "/api/v1/procedure-queries",
      permission: "procedure:approve",
    });
    assert.ok(!JSON.stringify(event).includes(VALID_TOKEN));
  });

  it("rejects arbitrary event types, outcomes, permissions, query strings, and controls uniformly", () => {
    const base = {
      tenantId: TENANT_A,
      eventType: "identity.authentication_failed" as const,
      outcome: "blocked" as const,
      reasonCode: "credential_rejected" as const,
    };
    const invalidInputs = [
      { ...base, eventType: "arbitrary.event" as never },
      { ...base, outcome: "maybe" as never },
      { ...base, permission: "secret:dump" as SecurityPermission },
      { ...base, route: "/api/v1/documents?token=secret" },
      { ...base, requestId: "request\nforged" },
    ];

    for (const input of invalidInputs) {
      assert.throws(() => buildSecurityAuditEvent(input), (error: unknown) => {
        assert.ok(error instanceof SecurityAuditValidationError);
        assert.equal(error.message, "Invalid security audit event");
        return true;
      });
    }
  });
});
