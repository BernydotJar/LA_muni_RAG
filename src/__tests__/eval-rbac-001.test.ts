import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  ROLE_PERMISSIONS,
  SECURITY_ROLES,
  permissionsForRoles,
} from "../security/rbac.js";

describe("EVAL-RBAC-001 — server-side role and tenant enforcement", () => {
  it("defines exactly the ten product roles with closed permissions", () => {
    assert.deepEqual([...SECURITY_ROLES].sort(), [
      "case_operator",
      "document_manager",
      "integration_client",
      "platform_admin",
      "procedure_approver",
      "procedure_author",
      "procedure_reviewer",
      "researcher",
      "tenant_admin",
      "viewer",
    ]);
    for (const role of SECURITY_ROLES) {
      assert.ok(ROLE_PERMISSIONS[role].length > 0, `${role} must have explicit permissions`);
      assert.equal(new Set(ROLE_PERMISSIONS[role]).size, ROLE_PERMISSIONS[role].length);
    }
    assert.ok(!ROLE_PERMISSIONS.tenant_admin.includes("procedure:approve"));
    assert.ok(ROLE_PERMISSIONS.procedure_approver.includes("procedure:approve"));
    assert.ok(ROLE_PERMISSIONS.case_operator.includes("case:write"));
    assert.ok(!ROLE_PERMISSIONS.case_operator.includes("procedure:review"));
    assert.ok(ROLE_PERMISSIONS.integration_client.includes("integration:query"));
  });

  it("unions multiple roles without manufacturing permissions", () => {
    const combined = permissionsForRoles(["procedure_author", "case_operator"]);
    assert.ok(combined.includes("procedure:draft"));
    assert.ok(combined.includes("case:read"));
    assert.ok(combined.includes("case:write"));
    assert.ok(!combined.includes("procedure:approve"));
    assert.ok(!combined.includes("procedure:review"));
  });

  it("binds tenant context transaction-locally and always commits or rolls back", async () => {
    const tenant = await readFile("src/security/tenant.ts", "utf8");
    assert.match(tenant, /SELECT set_config\('app\.tenant_id', \$1, true\)/);
    assert.match(tenant, /BEGIN/);
    assert.match(tenant, /COMMIT/);
    assert.match(tenant, /ROLLBACK/);
    assert.match(tenant, /client\.release/);
    assert.doesNotMatch(tenant, /set_config\('app\.tenant_id', \$1, false\)/);
  });

  it("uses authenticated credential tenant identity and uniform denial semantics", async () => {
    const [authentication, authorization, caseHandler, workflowHandler] = await Promise.all([
      readFile("src/security/authentication.ts", "utf8").catch(() => readFile("src/security/auth.ts", "utf8")),
      readFile("src/security/authorization.ts", "utf8").catch(() => readFile("src/security/rbac.ts", "utf8")),
      readFile("src/api/v1/procedureCaseHandler.ts", "utf8"),
      readFile("src/api/v1/workflowLifecycleHandler.ts", "utf8"),
    ]);
    assert.match(authentication, /credential/i);
    assert.match(caseHandler, /authenticateBearer/);
    assert.match(caseHandler, /requireTenantMatch/);
    assert.match(caseHandler, /requirePermission/);
    assert.match(workflowHandler, /authenticateBearer/);
    assert.match(workflowHandler, /requireTenantMatch/);
    assert.match(authorization, /forbidden|permission/i);
  });

  it("keeps documentary validation separate from ordinary case operation", async () => {
    const handler = await readFile("src/api/v1/procedureCaseHandler.ts", "utf8");
    assert.match(handler, /action\.type === "set_validation_state"/);
    assert.match(handler, /requirePermission\(principal, "procedure:review"\)/);
    assert.match(handler, /requirePermission\(principal, "case:write"\)/);
  });

  it("requires forced RLS and a non-owner runtime role in executable gates", async () => {
    const [identityMigration, caseMigration, tenantGate, caseGate] = await Promise.all([
      readFile("db/migrations/003_identity_tenancy_rbac.sql", "utf8"),
      readFile("db/migrations/013_procedure_cases.sql", "utf8"),
      readFile("db/tests/tenant_ingestion_runtime_gate.sql", "utf8"),
      readFile("db/tests/procedure_case_runtime_gate.sql", "utf8"),
    ]);
    assert.match(identityMigration, /FORCE ROW LEVEL SECURITY/g);
    assert.match(caseMigration, /FORCE ROW LEVEL SECURITY/g);
    assert.match(tenantGate, /rolsuper|NOBYPASSRLS|rolbypassrls/i);
    assert.match(caseGate, /rolsuper OR rolbypassrls/);
    assert.match(caseGate, /tenant B saw .*tenant A procedure cases/i);
  });

  it("documents the remaining human identity and access-review boundary", async () => {
    const [state, decision] = await Promise.all([
      readFile("program/current-state.md", "utf8"),
      readFile("docs/decisions/063-public-training-before-authenticated-saas.md", "utf8"),
    ]);
    assert.match(state, /browser authentication\/session architecture/i);
    assert.match(state, /role-aware navigation/i);
    assert.match(decision, /OIDC|session|BFF/i);
    assert.match(decision, /Integration[\s\S]*credentials/i);
  });
});
