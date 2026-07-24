export interface CloudSqlPreflightRow {
  database_name: unknown;
  user_name: unknown;
  version_num: unknown;
  vector_available: unknown;
  can_admin: unknown;
  cloudsql_marker: unknown;
  unrelated_databases: unknown;
}

export interface CloudSqlPreflightSummary {
  postgresMajor: number;
  vectorAvailable: boolean;
  adminCapabilities: boolean;
  cloudSqlDetected: boolean;
  unrelatedDatabases: number;
}

export interface CloudSqlStagingTarget {
  projectId: string;
  region: string;
  instanceName: string;
  connectionName: string;
  databaseVersion: string;
  connectivityMode: "PRIVATE" | "AUTH_PROXY_PUBLIC";
  deletionProtection: boolean;
}

export interface CloudSqlStagingSummary extends CloudSqlStagingTarget {
  readyForApply: false;
  requiresHumanApproval: true;
  executionMode: "plan_only";
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export const assertSafeCloudSqlProxyUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_cloud_sql_proxy_url");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("cloud_sql_proxy_requires_postgresql");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error("cloud_sql_proxy_must_be_loopback");
  if (url.pathname !== "/postgres") throw new Error("cloud_sql_proxy_must_target_postgres");
  if (!url.username) throw new Error("cloud_sql_proxy_username_required");
  if (url.search || url.hash) throw new Error("cloud_sql_proxy_url_options_forbidden");
  return url;
};

export const validateCloudSqlPreflightRows = (
  row: CloudSqlPreflightRow
): CloudSqlPreflightSummary => {
  const version = Number(row.version_num);
  const major = Math.floor(version / 10_000);
  const unrelated = Array.isArray(row.unrelated_databases)
    ? row.unrelated_databases.filter((value): value is string => typeof value === "string")
    : [];
  const cloudSqlDetected = typeof row.cloudsql_marker === "string";

  if (row.database_name !== "postgres") throw new Error("cloud_sql_preflight_wrong_database");
  if (typeof row.user_name !== "string" || row.user_name.length === 0) {
    throw new Error("cloud_sql_preflight_missing_user");
  }
  if (!Number.isInteger(version) || major < 16) throw new Error("cloud_sql_postgres_16_required");
  if (row.vector_available !== true) throw new Error("cloud_sql_pgvector_unavailable");
  if (row.can_admin !== true) throw new Error("cloud_sql_staging_admin_capabilities_required");
  if (!cloudSqlDetected) throw new Error("cloud_sql_marker_missing");
  if (unrelated.length > 0) throw new Error("cloud_sql_staging_instance_not_dedicated");

  return {
    postgresMajor: major,
    vectorAvailable: true,
    adminCapabilities: true,
    cloudSqlDetected: true,
    unrelatedDatabases: 0,
  };
};

export const buildCloudSqlStagingSummary = (
  target: CloudSqlStagingTarget
): CloudSqlStagingSummary => ({
  ...target,
  readyForApply: false,
  requiresHumanApproval: true,
  executionMode: "plan_only",
});
