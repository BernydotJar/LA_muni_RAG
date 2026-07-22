import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";
import type { FormatsPlugin } from "ajv-formats";
import {
  ROLE_PERMISSIONS,
  SECURITY_ROLES,
  type SecurityPermission,
  type SecurityRole,
} from "../security/rbac.js";

const addFormats = (
  (addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule
) as FormatsPlugin;

export const EPHEMERAL_STAGING_PLAN_PATH =
  "contracts/staging/v1/ephemeral-staging-plan.json";
export const EPHEMERAL_STAGING_SCHEMA_PATH =
  "contracts/staging/v1/ephemeral-staging-plan.schema.json";
const OPENAPI_PATH = "contracts/openapi/v1/openapi.json";

const EXPECTED_RESET_ORDER = [
  "preflight_no_production_inputs",
  "create_isolated_database",
  "apply_migrations",
  "seed_identity",
  "seed_domain_fixtures",
  "verify_tenant_isolation",
  "run_api_system_journeys",
  "assert_browser_blockers",
  "collect_sanitized_artifacts",
  "destroy_environment",
] as const;

const EXECUTION_PHASES = [
  "preflight",
  "create_environment",
  "migrate_database",
  "seed_identity",
  "seed_domain_fixtures",
  "verify_api_system_journeys",
  "assert_browser_blockers",
  "collect_sanitized_artifacts",
  "destroy_environment",
] as const;

const EXPECTED_MOCK_TARGETS = [
  "query_embedding_provider",
  "object_storage",
  "malware_scanner",
  "os_electoral",
  "content_agency",
  "human_idp",
] as const;

const REQUIRED_API_CONCERNS = [
  "schema_validation",
  "authentication_header",
  "authorization",
  "tenant_isolation",
  "rls",
  "idempotency",
  "replay_conflict",
  "persistence",
  "provider_failure",
  "contract_boundary",
  "reset_integrity",
  "separation_of_duties",
] as const;

const REQUIRED_BROWSER_CONCERNS = [
  "session_cookie",
  "csrf",
  "role_navigation",
  "user_feedback",
  "accessibility",
  "critical_journey",
] as const;

const REQUIRED_BROWSER_BLOCKERS = [
  "BLK-HUMAN-IDP-BFF-001",
  "BLK-AUTHENTICATED-UI-001",
] as const;

const REQUIRED_BROWSER_PREREQUISITES = [
  "human_idp_decision",
  "bff_session_implementation",
  "deterministic_fixtures",
  "ephemeral_services_deployed",
  "role_aware_ui",
  "csrf_and_logout",
] as const;

const REQUIRED_RESET_POSTCONDITIONS = [
  "no_cross_tenant_rows",
  "no_raw_credentials",
  "no_orphan_artifacts",
  "database_destroyed",
  "sanitized_artifacts_only",
] as const;

const EXPECTED_ROUTE_PERMISSIONS: Readonly<Record<string, SecurityPermission>> = Object.freeze({
  "POST /api/v1/search": "evidence:query",
  "POST /api/v1/sources": "source:write",
  "GET /api/v1/sources": "source:read",
  "POST /api/v1/documents": "document:write",
  "POST /api/v1/ingestion-jobs": "document:ingest",
  "POST /api/v1/procedure-queries": "integration:query",
  "POST /api/v1/claim-packs": "integration:query",
  "POST /api/v1/workflow-drafts": "procedure:draft",
  "POST /api/v1/workflow-reviews": "procedure:review",
  "POST /api/v1/workflow-approvals": "procedure:approve",
  "POST /api/v1/procedure-cases": "case:write",
});

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}\b/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
];

type JsonObject = Record<string, unknown>;
type JourneyLayer = "api" | "browser";
type JourneyStatus = "runnable" | "blocked";

interface TenantPlan {
  id: string;
  slug: string;
  classification: "synthetic_test";
  authoritative: false;
}

interface PrincipalPlan {
  id: string;
  key: string;
  tenant_id: string;
  roles: SecurityRole[];
  credential_ref: string;
  credential_kind: "ephemeral_bearer_digest_reference";
  surface: "api" | "api_and_planned_browser";
}

interface RolePlan {
  role: SecurityRole;
  permissions: SecurityPermission[];
  api_required: boolean;
  browser_required: boolean;
}

interface FixturePlan {
  id: string;
  key: string;
  tenant_id: string;
  resource_type: string;
  mutability: "mutable" | "immutable_snapshot";
  synthetic: true;
  authoritative: false;
}

interface JourneyPlan {
  id: string;
  layer: JourneyLayer;
  status: JourneyStatus;
  actor_principal_id: string;
  target_tenant_id?: string;
  method: "GET" | "POST" | "PATCH";
  route: string;
  concerns: string[];
  expected_statuses: number[];
  blocker_ids: string[];
  auth_mode: "authenticated" | "credential_omitted";
  required_permission: SecurityPermission | null;
  permission_expectation: "allow" | "deny" | "not_applicable";
}

interface MockPlan {
  target: (typeof EXPECTED_MOCK_TARGETS)[number];
  mode:
    | "deterministic_local_stub"
    | "boundary_stub_only"
    | "contract_stub_only"
    | "not_implemented_blocker";
  endpoint: string | null;
  verification_status:
    | "local_stub"
    | "provider_contract_only"
    | "not_implemented"
    | "externally_verified";
  external_verification_claimed: boolean;
  production_equivalent: false;
}

export interface EphemeralStagingPlan {
  schema_version: "v1";
  plan_version: string;
  environment: {
    kind: "ephemeral_staging";
    isolation: "per_run";
    ttl_minutes: number;
    destroy_after_run: true;
    production_credentials_allowed: false;
    production_data_allowed: false;
    network_mode: "loopback_only" | "isolated_allowlist";
    database_strategy: "fresh_database_per_run" | "fresh_schema_per_run";
    browser_e2e_enabled: false;
  };
  identity: {
    strategy: "service_credentials_only_until_human_idp_approved";
    browser_session_status: "blocked_pending_human_idp_bff";
    credential_material_source: "runtime_injected_ephemeral";
    raw_secrets_in_manifest: false;
    secret_persistence: "forbidden";
    browser_blocker_ids: string[];
  };
  tenants: TenantPlan[];
  principals: PrincipalPlan[];
  role_matrix: RolePlan[];
  fixtures: FixturePlan[];
  reset: {
    mode: "recreate_and_verify_empty";
    steps: string[];
    mutable_resource_types: string[];
    postconditions: string[];
  };
  journeys: JourneyPlan[];
  mocks: MockPlan[];
  layer_policy: {
    api_owned_concerns: string[];
    browser_owned_concerns: string[];
    browser_prerequisites: string[];
    browser_suite_budget: number;
  };
  limitations: string[];
}

export interface EphemeralStagingIssue {
  artifact: string;
  code: string;
  message: string;
  subject?: string;
}

export interface EphemeralStagingExecutionSummary {
  planVersion: string;
  tenants: number;
  principals: number;
  roles: number;
  fixtures: number;
  apiJourneys: number;
  browserJourneys: number;
  blockedBrowserJourneys: number;
  mocks: number;
  resetSteps: number;
  externalConsumersVerified: boolean;
  browserE2eRunnable: boolean;
  phases: string[];
}

export interface EphemeralStagingValidationResult {
  status: "valid" | "invalid";
  issues: EphemeralStagingIssue[];
  plan: EphemeralStagingPlan | null;
  summary: EphemeralStagingExecutionSummary | null;
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonObject = async (path: string): Promise<JsonObject> => {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isObject(parsed)) throw new Error(`JSON artifact must contain an object: ${path}`);
  return parsed;
};

const formatErrors = (errors: ErrorObject[] | null | undefined): string =>
  (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`)
    .join("; ");

const sorted = <T extends string | number>(values: Iterable<T>): T[] =>
  [...values].sort((left, right) => String(left).localeCompare(String(right)));

const sameSet = <T extends string | number>(left: Iterable<T>, right: Iterable<T>): boolean =>
  JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

const duplicates = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return sorted(repeated);
};

const walkStrings = (
  value: unknown,
  visit: (path: string, value: string) => void,
  path = "$"
): void => {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) walkStrings(child, visit, `${path}.${key}`);
};

const endpointIsAllowed = (endpoint: string): boolean => {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
};

const openApiOperation = (
  openapi: JsonObject,
  route: string,
  method: string
): JsonObject | null => {
  const paths = isObject(openapi.paths) ? openapi.paths : {};
  const pathItem = paths[route];
  if (!isObject(pathItem)) return null;
  const operation = pathItem[method.toLowerCase()];
  return isObject(operation) ? operation : null;
};

const openApiStatuses = (operation: JsonObject): Set<number> => {
  const responses = isObject(operation.responses) ? operation.responses : {};
  return new Set(
    Object.keys(responses)
      .filter((status) => /^\d{3}$/.test(status))
      .map(Number)
  );
};

const principalPermissions = (principal: PrincipalPlan): Set<SecurityPermission> => {
  const permissions = new Set<SecurityPermission>();
  for (const role of principal.roles) {
    for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
  }
  return permissions;
};

const schemaValidatorCache = new Map<string, ValidateFunction>();

const compilePlanSchema = async (projectRoot: string): Promise<ValidateFunction> => {
  const schema = await readJsonObject(resolve(projectRoot, EPHEMERAL_STAGING_SCHEMA_PATH));
  const cacheKey = JSON.stringify(schema);
  const cached = schemaValidatorCache.get(cacheKey);
  if (cached) return cached;
  const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  schemaValidatorCache.set(cacheKey, validate);
  return validate;
};

export const buildEphemeralStagingExecutionSummary = (
  plan: EphemeralStagingPlan
): EphemeralStagingExecutionSummary => {
  const apiJourneys = plan.journeys.filter((journey) => journey.layer === "api");
  const browserJourneys = plan.journeys.filter((journey) => journey.layer === "browser");
  const externalConsumersVerified = plan.mocks
    .filter((mock) => mock.target === "os_electoral" || mock.target === "content_agency")
    .some(
      (mock) =>
        mock.external_verification_claimed || mock.verification_status === "externally_verified"
    );
  return {
    planVersion: plan.plan_version,
    tenants: plan.tenants.length,
    principals: plan.principals.length,
    roles: plan.role_matrix.length,
    fixtures: plan.fixtures.length,
    apiJourneys: apiJourneys.length,
    browserJourneys: browserJourneys.length,
    blockedBrowserJourneys: browserJourneys.filter((journey) => journey.status === "blocked")
      .length,
    mocks: plan.mocks.length,
    resetSteps: plan.reset.steps.length,
    externalConsumersVerified,
    browserE2eRunnable:
      plan.environment.browser_e2e_enabled &&
      browserJourneys.length > 0 &&
      browserJourneys.every((journey) => journey.status === "runnable"),
    phases: [...EXECUTION_PHASES],
  };
};

export const verifyEphemeralStagingPlan = async (
  projectRoot = process.cwd()
): Promise<EphemeralStagingValidationResult> => {
  const artifact = EPHEMERAL_STAGING_PLAN_PATH;
  const issues: EphemeralStagingIssue[] = [];
  const issue = (code: string, message: string, subject?: string): void => {
    issues.push({ artifact, code, message, ...(subject ? { subject } : {}) });
  };

  let raw: JsonObject;
  let validate: ValidateFunction;
  let openapi: JsonObject;
  try {
    [raw, validate, openapi] = await Promise.all([
      readJsonObject(resolve(projectRoot, EPHEMERAL_STAGING_PLAN_PATH)),
      compilePlanSchema(projectRoot),
      readJsonObject(resolve(projectRoot, OPENAPI_PATH)),
    ]);
  } catch (error) {
    issue("plan_artifact_load_failed", error instanceof Error ? error.message : String(error));
    return { status: "invalid", issues, plan: null, summary: null };
  }

  if (!validate(raw)) {
    issue("invalid_plan_manifest", formatErrors(validate.errors));
    return { status: "invalid", issues, plan: null, summary: null };
  }

  const plan = raw as unknown as EphemeralStagingPlan;

  walkStrings(raw, (path, value) => {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
      issue("secret_like_material_forbidden", `Secret-like material is forbidden at ${path}`, path);
    }
  });

  const roleNames = plan.role_matrix.map((entry) => entry.role);
  if (!sameSet(roleNames, SECURITY_ROLES)) {
    issue(
      "role_set_drift",
      `Expected roles ${sorted(SECURITY_ROLES).join(",")}; plan has ${sorted(roleNames).join(",")}`
    );
  }
  for (const roleEntry of plan.role_matrix) {
    const expected = ROLE_PERMISSIONS[roleEntry.role];
    if (!sameSet(roleEntry.permissions, expected)) {
      issue(
        "role_permission_drift",
        `${roleEntry.role} permissions differ from the canonical RBAC map`,
        roleEntry.role
      );
    }
  }

  const tenantIds = plan.tenants.map((tenant) => tenant.id);
  const tenantSet = new Set(tenantIds);
  for (const duplicate of duplicates(tenantIds)) {
    issue("duplicate_tenant_id", `Duplicate tenant id ${duplicate}`, duplicate);
  }

  const principalIds = plan.principals.map((principal) => principal.id);
  const principalKeys = plan.principals.map((principal) => principal.key);
  const credentialRefs = plan.principals.map((principal) => principal.credential_ref);
  for (const duplicate of duplicates(principalIds)) {
    issue("duplicate_principal_id", `Duplicate principal id ${duplicate}`, duplicate);
  }
  for (const duplicate of duplicates(principalKeys)) {
    issue("duplicate_principal_key", `Duplicate principal key ${duplicate}`, duplicate);
  }
  for (const duplicate of duplicates(credentialRefs)) {
    issue("duplicate_credential_ref", `Duplicate credential reference ${duplicate}`, duplicate);
  }
  for (const principal of plan.principals) {
    if (!tenantSet.has(principal.tenant_id)) {
      issue(
        "principal_tenant_missing",
        `${principal.key} references unknown tenant ${principal.tenant_id}`,
        principal.key
      );
    }
  }
  const principalById = new Map(plan.principals.map((principal) => [principal.id, principal]));
  for (const roleEntry of plan.role_matrix) {
    const apiCovered = plan.principals.some(
      (principal) => principal.roles.includes(roleEntry.role)
    );
    const browserCovered = plan.principals.some(
      (principal) =>
        principal.roles.includes(roleEntry.role) &&
        principal.surface === "api_and_planned_browser"
    );
    if (roleEntry.api_required && !apiCovered) {
      issue(
        "required_role_principal_missing",
        `No API/system principal covers required role ${roleEntry.role}`,
        roleEntry.role
      );
    }
    if (roleEntry.browser_required && !browserCovered) {
      issue(
        "required_browser_role_principal_missing",
        `No planned browser principal covers required role ${roleEntry.role}`,
        roleEntry.role
      );
    }
  }

  const fixtureIds = plan.fixtures.map((fixture) => fixture.id);
  const fixtureKeys = plan.fixtures.map((fixture) => fixture.key);
  for (const duplicate of duplicates(fixtureIds)) {
    issue("duplicate_fixture_id", `Duplicate fixture id ${duplicate}`, duplicate);
  }
  for (const duplicate of duplicates(fixtureKeys)) {
    issue("duplicate_fixture_key", `Duplicate fixture key ${duplicate}`, duplicate);
  }
  for (const fixture of plan.fixtures) {
    if (!tenantSet.has(fixture.tenant_id)) {
      issue(
        "fixture_tenant_missing",
        `${fixture.key} references unknown tenant ${fixture.tenant_id}`,
        fixture.key
      );
    }
  }

  if (!sameSet(plan.reset.steps, EXPECTED_RESET_ORDER)) {
    issue("reset_step_set_drift", "Reset steps do not match the required closed set");
  }
  if (JSON.stringify(plan.reset.steps) !== JSON.stringify(EXPECTED_RESET_ORDER)) {
    issue("reset_order_invalid", "Reset steps must execute in the required deterministic order");
  }
  const mutableFixtureTypes = new Set(
    plan.fixtures
      .filter((fixture) => fixture.mutability === "mutable")
      .map((fixture) => fixture.resource_type)
  );
  for (const resourceType of mutableFixtureTypes) {
    if (!plan.reset.mutable_resource_types.includes(resourceType)) {
      issue(
        "reset_resource_coverage_missing",
        `Reset plan does not cover mutable resource type ${resourceType}`,
        resourceType
      );
    }
  }
  if (!sameSet(plan.reset.postconditions, REQUIRED_RESET_POSTCONDITIONS)) {
    issue(
      "reset_postcondition_drift",
      "Reset postconditions differ from the required safety baseline"
    );
  }

  if (!sameSet(plan.layer_policy.api_owned_concerns, REQUIRED_API_CONCERNS)) {
    issue("api_layer_policy_drift", "API-owned concern set differs from the required baseline");
  }
  if (!sameSet(plan.layer_policy.browser_owned_concerns, REQUIRED_BROWSER_CONCERNS)) {
    issue(
      "browser_layer_policy_drift",
      "Browser-owned concern set differs from the required baseline"
    );
  }
  if (!sameSet(plan.identity.browser_blocker_ids, REQUIRED_BROWSER_BLOCKERS)) {
    issue(
      "browser_blocker_set_drift",
      "Browser blocker set differs from the required identity/UI baseline"
    );
  }
  if (!sameSet(plan.layer_policy.browser_prerequisites, REQUIRED_BROWSER_PREREQUISITES)) {
    issue(
      "browser_prerequisite_drift",
      "Browser prerequisite set differs from the required baseline"
    );
  }
  const apiOwned = new Set(plan.layer_policy.api_owned_concerns);
  const browserOwned = new Set(plan.layer_policy.browser_owned_concerns);

  const journeyIds = plan.journeys.map((journey) => journey.id);
  for (const duplicate of duplicates(journeyIds)) {
    issue("duplicate_journey_id", `Duplicate journey id ${duplicate}`, duplicate);
  }
  for (const journey of plan.journeys) {
    const principal = principalById.get(journey.actor_principal_id);
    if (!principal) {
      issue(
        "journey_principal_missing",
        `${journey.id} references unknown principal ${journey.actor_principal_id}`,
        journey.id
      );
      continue;
    }
    if (journey.target_tenant_id && !tenantSet.has(journey.target_tenant_id)) {
      issue(
        "journey_target_tenant_missing",
        `${journey.id} references unknown target tenant ${journey.target_tenant_id}`,
        journey.id
      );
    }

    if (journey.layer === "api") {
      if (journey.status !== "runnable" || journey.blocker_ids.length !== 0) {
        issue("api_journey_not_runnable", `${journey.id} must be runnable without blockers`, journey.id);
      }
      for (const concern of journey.concerns) {
        if (!apiOwned.has(concern)) {
          issue(
            "api_layer_policy_violation",
            `${journey.id} assigns non-API concern ${concern} to the API layer`,
            journey.id
          );
        }
      }
      const operation = openApiOperation(openapi, journey.route, journey.method);
      if (!operation) {
        issue(
          "openapi_route_missing",
          `${journey.method} ${journey.route} is absent from canonical OpenAPI`,
          journey.id
        );
      } else {
        const advertisedStatuses = openApiStatuses(operation);
        for (const status of journey.expected_statuses) {
          if (!advertisedStatuses.has(status)) {
            issue(
              "openapi_status_missing",
              `${journey.method} ${journey.route} does not advertise ${status}`,
              journey.id
            );
          }
        }
      }

      const permissionKey = `${journey.method} ${journey.route}`;
      const expectedPermission = EXPECTED_ROUTE_PERMISSIONS[permissionKey];
      if (!expectedPermission || journey.required_permission !== expectedPermission) {
        issue(
          "journey_permission_contract_drift",
          `${journey.id} must declare ${expectedPermission ?? "a known route permission"}`,
          journey.id
        );
      }
      const granted = principalPermissions(principal);
      if (journey.auth_mode === "credential_omitted") {
        if (
          journey.permission_expectation !== "not_applicable" ||
          !journey.expected_statuses.includes(401)
        ) {
          issue(
            "unauthenticated_journey_contract_invalid",
            `${journey.id} must expect a 401 before permission evaluation`,
            journey.id
          );
        }
      } else if (journey.required_permission !== null) {
        const hasPermission = granted.has(journey.required_permission);
        if (
          (journey.permission_expectation === "allow" && !hasPermission) ||
          (journey.permission_expectation === "deny" && hasPermission) ||
          journey.permission_expectation === "not_applicable"
        ) {
          issue(
            "journey_permission_mismatch",
            `${journey.id} actor does not match permission expectation ${journey.permission_expectation}`,
            journey.id
          );
        }
      }
    } else {
      if (
        journey.auth_mode !== "authenticated" ||
        journey.required_permission !== null ||
        journey.permission_expectation !== "not_applicable"
      ) {
        issue(
          "browser_permission_contract_invalid",
          `${journey.id} must defer permission enforcement to its backing APIs`,
          journey.id
        );
      }
      if (principal.surface !== "api_and_planned_browser") {
        issue(
          "browser_principal_surface_invalid",
          `${journey.id} actor is not a planned browser persona`,
          journey.id
        );
      }
      if (!journey.route.startsWith("/app/")) {
        issue("browser_route_invalid", `${journey.id} must target a planned /app route`, journey.id);
      }
      const missingBlockers = plan.identity.browser_blocker_ids.filter(
        (blocker) => !journey.blocker_ids.includes(blocker)
      );
      if (journey.status !== "blocked" || missingBlockers.length > 0) {
        issue(
          "browser_identity_blocker_missing",
          `${journey.id} must remain blocked by all human identity/UI blockers`,
          journey.id
        );
      }
      for (const concern of journey.concerns) {
        if (apiOwned.has(concern) || !browserOwned.has(concern)) {
          issue(
            "browser_layer_policy_violation",
            `${journey.id} assigns API-owned or unknown concern ${concern} to the browser`,
            journey.id
          );
        }
      }
    }
  }

  for (const roleEntry of plan.role_matrix) {
    const apiJourneyCovered = plan.journeys.some((journey) => {
      if (journey.layer !== "api") return false;
      return principalById.get(journey.actor_principal_id)?.roles.includes(roleEntry.role) === true;
    });
    const browserJourneyCovered = plan.journeys.some((journey) => {
      if (journey.layer !== "browser") return false;
      return principalById.get(journey.actor_principal_id)?.roles.includes(roleEntry.role) === true;
    });
    if (roleEntry.api_required && !apiJourneyCovered) {
      issue(
        "required_role_journey_missing",
        `No API/system journey exercises required role ${roleEntry.role}`,
        roleEntry.role
      );
    }
    if (roleEntry.browser_required && !browserJourneyCovered) {
      issue(
        "required_browser_role_journey_missing",
        `No planned browser journey exercises required role ${roleEntry.role}`,
        roleEntry.role
      );
    }
  }

  const crossTenantJourney = plan.journeys.find((journey) => {
    if (journey.layer !== "api" || !journey.concerns.includes("tenant_isolation")) return false;
    const principal = principalById.get(journey.actor_principal_id);
    return (
      principal !== undefined &&
      journey.target_tenant_id !== undefined &&
      journey.target_tenant_id !== principal.tenant_id &&
      journey.expected_statuses.includes(403)
    );
  });
  if (!crossTenantJourney) {
    issue(
      "tenant_isolation_journey_missing",
      "At least one API journey must prove uniform cross-tenant 403 denial"
    );
  }

  const browserJourneys = plan.journeys.filter((journey) => journey.layer === "browser");
  if (browserJourneys.length > plan.layer_policy.browser_suite_budget) {
    issue(
      "browser_suite_budget_exceeded",
      `Browser journey count ${browserJourneys.length} exceeds budget ${plan.layer_policy.browser_suite_budget}`
    );
  }

  const mockTargets = plan.mocks.map((mock) => mock.target);
  if (!sameSet(mockTargets, EXPECTED_MOCK_TARGETS)) {
    issue("mock_target_set_drift", "Mock target set differs from the required closed baseline");
  }
  for (const duplicate of duplicates(mockTargets)) {
    issue("duplicate_mock_target", `Duplicate mock target ${duplicate}`, duplicate);
  }
  for (const mock of plan.mocks) {
    if (mock.endpoint !== null && !endpointIsAllowed(mock.endpoint)) {
      issue(
        "production_endpoint_forbidden",
        `${mock.target} endpoint must be loopback, .test, or .invalid`,
        mock.target
      );
    }
    if (mock.target === "os_electoral" || mock.target === "content_agency") {
      if (
        mock.mode !== "contract_stub_only" ||
        mock.verification_status !== "provider_contract_only" ||
        mock.external_verification_claimed
      ) {
        issue(
          "external_consumer_verification_overclaim",
          `${mock.target} must remain provider-contract-only`,
          mock.target
        );
      }
    }
    if (mock.target === "human_idp") {
      if (
        mock.mode !== "not_implemented_blocker" ||
        mock.verification_status !== "not_implemented" ||
        mock.endpoint !== null
      ) {
        issue("human_idp_overclaim", "Human IdP must remain an explicit blocker", mock.target);
      }
    }
  }

  const joinedLimitations = plan.limitations.join(" ").toLowerCase();
  for (const [code, phrase] of [
    ["external_consumer_limitation_missing", "repositories have not executed"],
    ["browser_e2e_limitation_missing", "browser e2e remains blocked"],
    ["production_readiness_limitation_missing", "not production readiness"],
  ] as const) {
    if (!joinedLimitations.includes(phrase)) {
      issue(code, `Limitations must explicitly state: ${phrase}`);
    }
  }

  const summary = buildEphemeralStagingExecutionSummary(plan);
  return {
    status: issues.length === 0 ? "valid" : "invalid",
    issues,
    plan,
    summary,
  };
};
