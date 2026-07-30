import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  EPHEMERAL_STAGING_PLAN_PATH,
  verifyEphemeralStagingPlan,
} from "../staging/ephemeralStagingPlan.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const copyContracts = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "la-muni-staging-plan-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "contracts"), { recursive: true });
  await cp(join(process.cwd(), "contracts", "staging"), join(root, "contracts", "staging"), {
    recursive: true,
  });
  await cp(join(process.cwd(), "contracts", "openapi"), join(root, "contracts", "openapi"), {
    recursive: true,
  });
  return root;
};

const mutateJson = async (
  root: string,
  relativePath: string,
  mutate: (value: Record<string, unknown>) => void
): Promise<void> => {
  const path = join(root, relativePath);
  const value = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  mutate(value);
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
};

const issueCodes = (result: Awaited<ReturnType<typeof verifyEphemeralStagingPlan>>): string[] =>
  result.issues.map((issue) => issue.code);

describe("ephemeral staging and E2E architecture v1", () => {
  it("validates the canonical plan and emits a deterministic execution summary", async () => {
    const result = await verifyEphemeralStagingPlan(process.cwd());
    assert.equal(result.status, "valid", JSON.stringify(result.issues));
    assert.deepEqual(result.summary, {
      planVersion: "1.0.0",
      tenants: 2,
      principals: 11,
      roles: 10,
      fixtures: 13,
      apiJourneys: 20,
      browserJourneys: 12,
      blockedBrowserJourneys: 12,
      mocks: 6,
      resetSteps: 10,
      externalConsumersVerified: false,
      browserE2eRunnable: false,
      phases: [
        "preflight",
        "create_environment",
        "migrate_database",
        "seed_identity",
        "seed_domain_fixtures",
        "verify_api_system_journeys",
        "assert_browser_blockers",
        "collect_sanitized_artifacts",
        "destroy_environment",
      ],
    });
  });

  it("fails closed on RBAC set, permission and persona coverage drift", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const roles = plan.role_matrix as Array<Record<string, unknown>>;
      const viewer = roles.find((entry) => entry.role === "viewer")!;
      viewer.role = "platform_admin";
      const researcher = roles.find((entry) => entry.role === "researcher")!;
      researcher.permissions = (researcher.permissions as string[]).filter(
        (permission) => permission !== "evidence:query"
      );
      plan.principals = (plan.principals as Array<Record<string, unknown>>).filter(
        (principal) => !(principal.roles as string[]).includes("procedure_approver")
      );
    });
    const result = await verifyEphemeralStagingPlan(root);
    const codes = issueCodes(result);
    assert.equal(result.status, "invalid");
    assert.ok(codes.includes("role_set_drift"));
    assert.ok(codes.includes("role_permission_drift"));
    assert.ok(codes.includes("required_role_principal_missing"));
    assert.ok(codes.includes("required_browser_role_principal_missing"));
    assert.ok(codes.includes("required_role_journey_missing"));
    assert.ok(codes.includes("required_browser_role_journey_missing"));
  });

  it("rejects committed secrets and production-like endpoints", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const principals = plan.principals as Array<Record<string, unknown>>;
      principals[0]!.credential_ref = "ghp_" + "x".repeat(32);
      const mocks = plan.mocks as Array<Record<string, unknown>>;
      mocks[0]!.endpoint = "https://api.production.example/v1";
    });
    const result = await verifyEphemeralStagingPlan(root);
    const codes = issueCodes(result);
    assert.equal(result.status, "invalid");
    assert.ok(codes.includes("secret_like_material_forbidden"));
    assert.ok(codes.includes("production_endpoint_forbidden"));
  });

  it("requires tenant isolation and complete deterministic reset safety", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      plan.journeys = (plan.journeys as Array<Record<string, unknown>>).filter(
        (journey) => journey.id !== "api-cross-tenant-search-denied"
      );
      const fixtures = plan.fixtures as Array<Record<string, unknown>>;
      fixtures.push({
        id: "88888888-8888-4888-8888-888888888888",
        key: "tenant-a-extra-audit",
        tenant_id: "11111111-1111-4111-8111-111111111111",
        resource_type: "audit_event",
        mutability: "mutable",
        synthetic: true,
        authoritative: false,
      });
      const reset = plan.reset as Record<string, unknown>;
      const steps = reset.steps as string[];
      reset.steps = [steps[0]!, steps[1]!, steps[3]!, steps[2]!, ...steps.slice(4)];
      reset.postconditions = (reset.postconditions as string[]).filter(
        (item) => item !== "sanitized_artifacts_only"
      );
    });
    const result = await verifyEphemeralStagingPlan(root);
    const codes = issueCodes(result);
    assert.equal(result.status, "invalid");
    assert.ok(codes.includes("tenant_isolation_journey_missing"));
    assert.ok(codes.includes("reset_resource_coverage_missing"));
    assert.ok(codes.includes("reset_order_invalid"));
    assert.ok(codes.includes("reset_postcondition_drift"));
  });

  it("keeps API concerns out of browser journeys and preserves identity blockers", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const journeys = plan.journeys as Array<Record<string, unknown>>;
      const browser = journeys.find((journey) => journey.id === "browser-viewer-search-evidence")!;
      browser.concerns = ["tenant_isolation", "role_navigation"];
      browser.status = "runnable";
      browser.blocker_ids = [];
      const identity = plan.identity as Record<string, unknown>;
      identity.browser_blocker_ids = ["BLK-HUMAN-IDP-BFF-001", "BLK-UNRELATED-001"];
      const policy = plan.layer_policy as Record<string, unknown>;
      policy.browser_prerequisites = (policy.browser_prerequisites as string[]).filter(
        (item) => item !== "csrf_and_logout"
      );
    });
    const result = await verifyEphemeralStagingPlan(root);
    const codes = issueCodes(result);
    assert.equal(result.status, "invalid");
    assert.ok(codes.includes("browser_layer_policy_violation"));
    assert.ok(codes.includes("browser_identity_blocker_missing"));
    assert.ok(codes.includes("browser_blocker_set_drift"));
    assert.ok(codes.includes("browser_prerequisite_drift"));
  });

  it("rejects external consumer interoperability overclaims", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const mocks = plan.mocks as Array<Record<string, unknown>>;
      const consumer = mocks.find((mock) => mock.target === "os_electoral")!;
      consumer.verification_status = "externally_verified";
    });
    const result = await verifyEphemeralStagingPlan(root);
    assert.equal(result.status, "invalid");
    assert.ok(issueCodes(result).includes("external_consumer_verification_overclaim"));
  });

  it("rejects OpenAPI route and status drift", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const journeys = plan.journeys as Array<Record<string, unknown>>;
      const search = journeys.find((entry) => entry.id === "api-viewer-search-success")!;
      search.route = "/api/v1/not-implemented";
      const review = journeys.find((entry) => entry.id === "api-procedure-reviewer-review")!;
      review.expected_statuses = [201];
    });
    const result = await verifyEphemeralStagingPlan(root);
    const codes = issueCodes(result);
    assert.equal(result.status, "invalid");
    assert.ok(codes.includes("openapi_route_missing"));
    assert.ok(codes.includes("openapi_status_missing"));
  });

  it("rejects actor and route permission contract drift", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const journeys = plan.journeys as Array<Record<string, unknown>>;
      const sourceCreate = journeys.find(
        (entry) => entry.id === "api-document-manager-source-create"
      )!;
      sourceCreate.actor_principal_id = "a0000000-0000-4000-8000-000000000009";
      const search = journeys.find((entry) => entry.id === "api-viewer-search-success")!;
      search.required_permission = "source:write";
    });
    const result = await verifyEphemeralStagingPlan(root);
    const codes = issueCodes(result);
    assert.equal(result.status, "invalid");
    assert.ok(codes.includes("journey_permission_mismatch"));
    assert.ok(codes.includes("journey_permission_contract_drift"));
  });

  it("rejects duplicate fixture identifiers", async () => {
    const root = await copyContracts();
    await mutateJson(root, EPHEMERAL_STAGING_PLAN_PATH, (plan) => {
      const fixtures = plan.fixtures as Array<Record<string, unknown>>;
      fixtures[1]!.id = fixtures[0]!.id;
    });
    const result = await verifyEphemeralStagingPlan(root);
    assert.equal(result.status, "invalid");
    assert.ok(issueCodes(result).includes("duplicate_fixture_id"));
  });
});
