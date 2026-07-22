import type { EphemeralStagingPlan } from "./ephemeralStagingPlan.js";
import { loadEphemeralStagingPlan } from "./ephemeralStagingPlan.js";

export const STAGING_DATABASES = [
  "la_muni_rag_test",
  "la_muni_rag_catalog_test",
  "la_muni_rag_search_test",
  "la_muni_rag_ingestion_test",
] as const;

export const STAGING_RUNTIME_ROLES = [
  "la_muni_ingestion_runtime_test",
  "la_muni_search_runtime_test",
  "la_muni_runtime_test",
] as const;

const MIGRATIONS = (last: number): string[] =>
  Array.from({ length: last }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    const names: Record<string, string> = {
      "001": "initial_rag_schema",
      "002": "procedure_feedback",
      "003": "identity_tenancy_rbac",
      "004": "procedure_query_api",
      "005": "tenant_ingestion_runtime",
      "006": "ingestion_api_runtime",
      "007": "persisted_artifact_acceptance",
      "008": "claim_pack_api",
      "009": "workflow_lifecycle",
      "010": "workflow_lifecycle_api",
      "011": "artifact_vector_runtime_hardening",
      "012": "evidence_gap_requests",
      "013": "procedure_cases",
      "014": "catalog_api",
      "015": "search_evidence_api",
      "016": "public_query_gateway",
    };
    return `db/migrations/${number}_${names[number]}.sql`;
  });

export interface StagingSmoke {
  id: string;
  script: string;
  database: (typeof STAGING_DATABASES)[number];
  runtimeRole: (typeof STAGING_RUNTIME_ROLES)[number];
  runtimePassword: string;
  journeyIds: string[];
  adminDatabaseUrlRequired?: boolean;
}

export interface StagingResetScenario {
  sqlFiles: string[];
  smoke: StagingSmoke;
}

export interface StagingDatabaseScenario {
  id: string;
  database: (typeof STAGING_DATABASES)[number];
  sqlFiles: string[];
  smokes: StagingSmoke[];
  reset?: StagingResetScenario;
}

const smoke = (
  id: string,
  script: string,
  database: StagingSmoke["database"],
  runtimeRole: StagingSmoke["runtimeRole"],
  runtimePassword: string,
  journeyIds: string[],
  adminDatabaseUrlRequired = false
): StagingSmoke => ({
  id,
  script,
  database,
  runtimeRole,
  runtimePassword,
  journeyIds,
  ...(adminDatabaseUrlRequired ? { adminDatabaseUrlRequired } : {}),
});

const RUNTIME_PASSWORD = "disposable-runtime-password-20260718";
const SEARCH_PASSWORD = "disposable-search-runtime-password-20260721";
const INGESTION_PASSWORD = "disposable-ingestion-runtime-password-20260719";

export const STAGING_DATABASE_SCENARIOS: readonly StagingDatabaseScenario[] = [
  {
    id: "integration",
    database: "la_muni_rag_test",
    sqlFiles: [
      ...MIGRATIONS(4),
      "db/tests/procedure_query_runtime_gate.sql",
      "db/migrations/008_claim_pack_api.sql",
      "db/tests/claim_pack_runtime_gate.sql",
      "db/migrations/009_workflow_lifecycle.sql",
      "db/migrations/010_workflow_lifecycle_api.sql",
      "db/tests/workflow_lifecycle_runtime_gate.sql",
      "db/migrations/012_evidence_gap_requests.sql",
      "db/tests/evidence_gap_runtime_gate.sql",
      "db/migrations/013_procedure_cases.sql",
      "db/tests/procedure_case_runtime_gate.sql",
    ],
    smokes: [
      smoke("procedure-query", "scripts/procedure-query-postgres-smoke.mjs", "la_muni_rag_test", "la_muni_runtime_test", RUNTIME_PASSWORD, [
        "api-integration-procedure-query-success",
        "api-idempotency-exact-replay",
        "api-idempotency-conflict",
      ]),
      smoke("claim-pack", "scripts/claim-pack-postgres-smoke.mjs", "la_muni_rag_test", "la_muni_runtime_test", RUNTIME_PASSWORD, [
        "api-integration-claim-pack-success",
        "api-content-boundary-denied",
      ]),
      smoke("workflow-lifecycle", "scripts/workflow-lifecycle-postgres-smoke.mjs", "la_muni_rag_test", "la_muni_runtime_test", RUNTIME_PASSWORD, [
        "api-procedure-author-draft",
        "api-procedure-reviewer-review",
        "api-procedure-approver-approve",
      ]),
      smoke("procedure-case", "scripts/procedure-case-postgres-smoke.mjs", "la_muni_rag_test", "la_muni_runtime_test", RUNTIME_PASSWORD, [
        "api-case-operator-create",
      ]),
      smoke("evidence-gap", "scripts/evidence-gap-postgres-smoke.mjs", "la_muni_rag_test", "la_muni_runtime_test", RUNTIME_PASSWORD, []),
    ],
  },
  {
    id: "catalog",
    database: "la_muni_rag_catalog_test",
    sqlFiles: [...MIGRATIONS(14), "db/tests/catalog_api_runtime_gate.sql"],
    smokes: [
      smoke("catalog", "scripts/catalog-api-postgres-smoke.mjs", "la_muni_rag_catalog_test", "la_muni_runtime_test", RUNTIME_PASSWORD, [
        "api-document-manager-source-create",
        "api-document-manager-document-create",
        "api-platform-admin-source-list",
        "api-tenant-admin-source-list",
      ]),
    ],
    reset: {
      sqlFiles: [...MIGRATIONS(14), "db/tests/staging_reset_runtime_gate.sql"],
      smoke: smoke("reset-integrity", "scripts/staging-reset-postgres-smoke.mjs", "la_muni_rag_catalog_test", "la_muni_runtime_test", RUNTIME_PASSWORD, [
        "api-reset-verify-empty",
      ]),
    },
  },
  {
    id: "search",
    database: "la_muni_rag_search_test",
    sqlFiles: [
      ...MIGRATIONS(16),
      "db/tests/search_evidence_api_runtime_gate.sql",
      "db/tests/public_query_gateway_runtime_gate.sql",
    ],
    smokes: [
      smoke("search-evidence", "scripts/search-evidence-postgres-smoke.mjs", "la_muni_rag_search_test", "la_muni_search_runtime_test", SEARCH_PASSWORD, [
        "api-unauthenticated-search-denied",
        "api-viewer-search-success",
        "api-cross-tenant-search-denied",
        "api-semantic-provider-failure",
      ]),
      smoke("public-query", "scripts/public-query-postgres-smoke.mjs", "la_muni_rag_search_test", "la_muni_search_runtime_test", SEARCH_PASSWORD, [], true),
    ],
  },
  {
    id: "ingestion",
    database: "la_muni_rag_ingestion_test",
    sqlFiles: [
      ...MIGRATIONS(7),
      "db/migrations/011_artifact_vector_runtime_hardening.sql",
      "db/tests/tenant_ingestion_runtime_gate.sql",
      "db/tests/artifact_vector_runtime_hardening_gate.sql",
    ],
    smokes: [
      smoke("tenant-ingestion", "scripts/tenant-ingestion-postgres-smoke.mjs", "la_muni_rag_ingestion_test", "la_muni_ingestion_runtime_test", INGESTION_PASSWORD, []),
      smoke("ingestion-api", "scripts/ingestion-api-postgres-smoke.mjs", "la_muni_rag_ingestion_test", "la_muni_ingestion_runtime_test", INGESTION_PASSWORD, [
        "api-viewer-ingestion-denied",
        "api-document-manager-ingestion-enqueue",
      ]),
    ],
  },
] as const;

export interface StagingJourneyCoverage {
  apiJourneyCount: number;
  browserJourneyCount: number;
  mappedJourneyCount: number;
  missingJourneyIds: string[];
  duplicateJourneyIds: string[];
  browserJourneyIds: string[];
}

const allSmokes = (scenarios: readonly StagingDatabaseScenario[]): StagingSmoke[] =>
  scenarios.flatMap((scenario) => [
    ...scenario.smokes,
    ...(scenario.reset ? [scenario.reset.smoke] : []),
  ]);

export const assertStagingJourneyCoverage = (
  plan: EphemeralStagingPlan,
  scenarios: readonly StagingDatabaseScenario[]
): StagingJourneyCoverage => {
  const apiIds = plan.journeys.filter((journey) => journey.layer === "api" && journey.status === "runnable").map((journey) => journey.id);
  const browserSet = new Set(plan.journeys.filter((journey) => journey.layer === "browser").map((journey) => journey.id));
  const mapped = allSmokes(scenarios).flatMap((item) => item.journeyIds);
  const counts = new Map<string, number>();
  mapped.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  const result: StagingJourneyCoverage = {
    apiJourneyCount: apiIds.length,
    browserJourneyCount: browserSet.size,
    mappedJourneyCount: new Set(mapped).size,
    missingJourneyIds: apiIds.filter((id) => !counts.has(id)).sort(),
    duplicateJourneyIds: [...counts].filter(([, count]) => count > 1).map(([id]) => id).sort(),
    browserJourneyIds: [...new Set(mapped.filter((id) => browserSet.has(id)))].sort(),
  };
  if (result.missingJourneyIds.length || result.duplicateJourneyIds.length || result.browserJourneyIds.length || result.mappedJourneyCount !== apiIds.length) {
    throw new Error("Staging journey coverage is incomplete or ambiguous");
  }
  return result;
};

export const assertSafeStagingAdminUrl = (value: string): URL => {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("STAGING_ADMIN_DATABASE_URL must be a URL"); }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("Staging admin URL must use PostgreSQL");
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname.toLowerCase())) throw new Error("Staging admin URL must be loopback-only");
  if (!url.username || !url.password) throw new Error("Staging admin URL requires ephemeral credentials");
  if (url.pathname !== "/postgres" || url.search || url.hash) throw new Error("Staging admin URL must target the postgres admin database without parameters");
  return url;
};

export interface EphemeralStagingExecutor {
  preflight(): Promise<void>;
  environmentExists(): Promise<boolean>;
  cleanKnownEnvironment(): Promise<void>;
  build(): Promise<void>;
  createDatabase(name: string): Promise<void>;
  recreateDatabase(name: string): Promise<void>;
  applySql(database: string, file: string): Promise<void>;
  runSmoke(smoke: StagingSmoke): Promise<void>;
  dropDatabase(name: string): Promise<boolean>;
  dropRole(name: string): Promise<boolean>;
}

type PhaseName = "preflight" | "create_environment" | "migrate_database" | "seed_identity" | "seed_domain_fixtures" | "verify_api_system_journeys" | "assert_browser_blockers" | "collect_sanitized_artifacts" | "destroy_environment";
type ReceiptStatus = "passed" | "failed";

export interface EphemeralStagingReceipt {
  schema_version: "v1";
  run_id: string;
  plan_version: string;
  git_sha: string;
  status: ReceiptStatus;
  started_at: string;
  finished_at: string;
  phases: Array<{ name: PhaseName; status: ReceiptStatus | "not_run" }>;
  journeys: Array<{ id: string; status: ReceiptStatus | "not_run"; verified_by: string }>;
  browser: { total: number; blocked: number; blocker_ids: string[] };
  cleanup: { databases_destroyed: number; roles_destroyed: number; complete: boolean };
  failure?: { phase: PhaseName; subject: string; code: string };
}

const PHASES: PhaseName[] = [
  "preflight", "create_environment", "migrate_database", "seed_identity", "seed_domain_fixtures",
  "verify_api_system_journeys", "assert_browser_blockers", "collect_sanitized_artifacts", "destroy_environment",
];

export interface RunEphemeralStagingOptions {
  executor: EphemeralStagingExecutor;
  projectRoot: string;
  runId: string;
  gitSha: string;
  cleanExisting?: boolean;
  now?: () => Date;
}

export const runEphemeralStaging = async (options: RunEphemeralStagingOptions): Promise<EphemeralStagingReceipt> => {
  const now = options.now ?? (() => new Date());
  const plan = await loadEphemeralStagingPlan(options.projectRoot);
  assertStagingJourneyCoverage(plan, STAGING_DATABASE_SCENARIOS);
  const startedAt = now().toISOString();
  const phaseStatus = new Map<PhaseName, ReceiptStatus | "not_run">(PHASES.map((name) => [name, "not_run"]));
  const mapped = new Map<string, { id: string; status: ReceiptStatus | "not_run"; verified_by: string }>();
  for (const item of allSmokes(STAGING_DATABASE_SCENARIOS)) {
    item.journeyIds.forEach((id) => mapped.set(id, { id, status: "not_run", verified_by: item.id }));
  }
  const browserJourneys = plan.journeys.filter((journey) => journey.layer === "browser");
  let failure: EphemeralStagingReceipt["failure"];
  let currentPhase: PhaseName = "preflight";
  let subject = "runner";
  let environmentOwned = false;
  const destroyedDatabases = new Set<string>();
  const destroyedRoles = new Set<string>();

  try {
    await options.executor.preflight();
    const exists = await options.executor.environmentExists();
    if (exists) {
      if (!options.cleanExisting) throw new Error("environment_not_clean");
      environmentOwned = true;
      await options.executor.cleanKnownEnvironment();
    } else {
      environmentOwned = true;
    }
    phaseStatus.set("preflight", "passed");

    currentPhase = "create_environment";
    await options.executor.build();
    for (const scenario of STAGING_DATABASE_SCENARIOS) {
      subject = scenario.database;
      await options.executor.createDatabase(scenario.database);
    }
    phaseStatus.set(currentPhase, "passed");

    currentPhase = "migrate_database";
    for (const scenario of STAGING_DATABASE_SCENARIOS) {
      subject = scenario.id;
      for (const file of scenario.sqlFiles) await options.executor.applySql(scenario.database, file);
    }
    phaseStatus.set(currentPhase, "passed");
    phaseStatus.set("seed_identity", "passed");
    phaseStatus.set("seed_domain_fixtures", "passed");

    currentPhase = "verify_api_system_journeys";
    for (const scenario of STAGING_DATABASE_SCENARIOS) {
      for (const item of scenario.smokes) {
        subject = item.id;
        await options.executor.runSmoke(item);
        item.journeyIds.forEach((id) => mapped.set(id, { id, status: "passed", verified_by: item.id }));
      }
      if (scenario.reset) {
        subject = `${scenario.id}-reset`;
        await options.executor.recreateDatabase(scenario.database);
        for (const file of scenario.reset.sqlFiles) await options.executor.applySql(scenario.database, file);
        await options.executor.runSmoke(scenario.reset.smoke);
        scenario.reset.smoke.journeyIds.forEach((id) => mapped.set(id, { id, status: "passed", verified_by: scenario.reset!.smoke.id }));
      }
    }
    phaseStatus.set(currentPhase, "passed");

    currentPhase = "assert_browser_blockers";
    if (browserJourneys.some((journey) => journey.status !== "blocked" || journey.blocker_ids.length === 0)) throw new Error("browser_blocker_missing");
    phaseStatus.set(currentPhase, "passed");
    phaseStatus.set("collect_sanitized_artifacts", "passed");
  } catch (error) {
    const code = error instanceof Error && /^[a-z][a-z0-9_]{0,63}$/.test(error.message) ? error.message : currentPhase === "verify_api_system_journeys" ? "smoke_failed" : "runner_failed";
    failure = { phase: currentPhase, subject, code };
    phaseStatus.set(currentPhase, "failed");
    const failedSmoke = allSmokes(STAGING_DATABASE_SCENARIOS).find((item) => item.id === subject);
    failedSmoke?.journeyIds.forEach((id) => mapped.set(id, { id, status: "failed", verified_by: subject }));
  } finally {
    currentPhase = "destroy_environment";
    let complete = !environmentOwned;
    if (environmentOwned) {
      for (const database of [...STAGING_DATABASES].reverse()) {
        try { if (await options.executor.dropDatabase(database)) destroyedDatabases.add(database); } catch { /* verified below */ }
      }
      for (const role of STAGING_RUNTIME_ROLES) {
        try { if (await options.executor.dropRole(role)) destroyedRoles.add(role); } catch { /* verified below */ }
      }
      try { complete = !(await options.executor.environmentExists()); }
      catch { complete = false; }
    }
    phaseStatus.set("destroy_environment", complete ? "passed" : "failed");
  }

  const cleanupComplete = phaseStatus.get("destroy_environment") === "passed";
  if (!cleanupComplete && !failure) failure = { phase: "destroy_environment", subject: "environment", code: "cleanup_incomplete" };
  const status: ReceiptStatus = failure ? "failed" : "passed";
  return {
    schema_version: "v1",
    run_id: options.runId,
    plan_version: plan.plan_version,
    git_sha: options.gitSha,
    status,
    started_at: startedAt,
    finished_at: now().toISOString(),
    phases: PHASES.map((name) => ({ name, status: phaseStatus.get(name) ?? "not_run" })),
    journeys: [...mapped.values()].sort((left, right) => left.id.localeCompare(right.id)),
    browser: {
      total: browserJourneys.length,
      blocked: browserJourneys.filter((journey) => journey.status === "blocked").length,
      blocker_ids: [...new Set(browserJourneys.flatMap((journey) => journey.blocker_ids))].sort(),
    },
    cleanup: {
      databases_destroyed: destroyedDatabases.size,
      roles_destroyed: destroyedRoles.size,
      complete: cleanupComplete,
    },
    ...(failure ? { failure } : {}),
  };
};
