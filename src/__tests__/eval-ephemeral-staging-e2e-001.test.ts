import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { SECURITY_ROLES } from "../security/rbac.js";
import { verifyEphemeralStagingPlan } from "../staging/ephemeralStagingPlan.js";

describe("EVAL-EPHEMERAL-STAGING-E2E-001", () => {
  it("publishes one valid deterministic provider-side staging plan", async () => {
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

  it("keeps exact RBAC, synthetic tenant ownership and deterministic reset", async () => {
    const result = await verifyEphemeralStagingPlan(process.cwd());
    assert.ok(result.plan);
    assert.deepEqual(
      result.plan.role_matrix.map((entry) => entry.role).sort(),
      [...SECURITY_ROLES].sort()
    );
    assert.equal(result.plan.tenants.length, 2);
    assert.ok(result.plan.tenants.every((tenant) => tenant.classification === "synthetic_test"));
    assert.ok(result.plan.fixtures.every((fixture) => fixture.synthetic && !fixture.authoritative));
    assert.equal(result.plan.reset.steps.at(-1), "destroy_environment");
    assert.ok(result.plan.reset.postconditions.includes("database_destroyed"));
    assert.ok(result.plan.reset.postconditions.includes("no_cross_tenant_rows"));
  });

  it("assigns lower-layer concerns to API/system and blocks every browser journey", async () => {
    const result = await verifyEphemeralStagingPlan(process.cwd());
    assert.ok(result.plan);
    const api = result.plan.journeys.filter((journey) => journey.layer === "api");
    const browser = result.plan.journeys.filter((journey) => journey.layer === "browser");
    assert.equal(api.length, 20);
    assert.ok(api.every((journey) => journey.status === "runnable"));
    assert.equal(browser.length, 12);
    assert.ok(browser.every((journey) => journey.status === "blocked"));
    assert.ok(browser.every((journey) => journey.blocker_ids.includes("BLK-HUMAN-IDP-BFF-001")));
    assert.equal(result.plan.environment.browser_e2e_enabled, false);
  });

  it("documents that external consumers, human identity, deployed staging and browser E2E remain unproved", async () => {
    const [architecture, decision, risk] = await Promise.all([
      readFile("docs/testing/ephemeral-staging-e2e-architecture.md", "utf8"),
      readFile("docs/decisions/070-ephemeral-staging-e2e-architecture-v1.md", "utf8"),
      readFile("docs/risks/070-ephemeral-staging-e2e-risk-register.md", "utf8"),
    ]);
    assert.match(architecture, /no deployed staging or browser E2E is claimed/i);
    assert.match(architecture, /repositories are not modified/i);
    assert.match(architecture, /browser E2E remains blocked/i);
    assert.match(decision, /service Bearer credentials are never repurposed as browser credentials/i);
    assert.match(risk, /external consumer repository suites remain absent/i);
    assert.doesNotMatch(architecture, /production-ready demonstrable/i);
  });
});
