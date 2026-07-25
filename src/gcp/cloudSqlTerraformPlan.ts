export interface CloudSqlPlanExpectations {
  projectId: string;
  ownerLabel: string;
  expectedComputeUsd: number;
  instanceName?: string;
  region?: string;
}

export interface CloudSqlPlanVerification {
  status: "valid" | "invalid";
  issues: string[];
  summary: {
    addresses: string[];
    projectId: string | null;
    instanceName: string | null;
    region: string | null;
    ownerLabel: string | null;
    estimatedComputeUsd: number | null;
    deletionProtection: boolean | null;
  };
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const asObject = (value: unknown): JsonObject => isObject(value) ? value : {};

const firstObject = (value: unknown): JsonObject => {
  const first = asArray(value)[0];
  return asObject(first);
};

const outputValue = (plan: JsonObject, name: string): unknown => {
  const plannedValues = asObject(plan.planned_values);
  const outputs = asObject(plannedValues.outputs);
  return asObject(outputs[name]).value;
};

const equalJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export function verifyCloudSqlTerraformPlan(
  planValue: unknown,
  expectations: CloudSqlPlanExpectations,
): CloudSqlPlanVerification {
  const issues: string[] = [];
  const plan = asObject(planValue);
  const resourceChanges = asArray(plan.resource_changes).map(asObject);
  const addresses = resourceChanges
    .map((change) => typeof change.address === "string" ? change.address : "")
    .filter(Boolean)
    .sort();
  const expectedAddresses = [
    "google_project_service.sqladmin[0]",
    "google_sql_database_instance.staging[0]",
  ];

  if (!equalJson(addresses, expectedAddresses)) {
    issues.push(`resource address set drifted: ${JSON.stringify(addresses)}`);
  }

  const findChange = (address: string): JsonObject =>
    resourceChanges.find((change) => change.address === address) ?? {};

  const serviceChange = findChange(expectedAddresses[0]);
  const instanceChange = findChange(expectedAddresses[1]);
  const serviceActions = asArray(asObject(serviceChange.change).actions);
  const instanceActions = asArray(asObject(instanceChange.change).actions);
  if (!equalJson(serviceActions, ["create"])) issues.push("SQL Admin API action must be create only");
  if (!equalJson(instanceActions, ["create"])) issues.push("Cloud SQL instance action must be create only");

  const serviceAfter = asObject(asObject(serviceChange.change).after);
  const instanceAfter = asObject(asObject(instanceChange.change).after);
  const settings = firstObject(instanceAfter.settings);
  const backup = firstObject(settings.backup_configuration);
  const backupRetention = firstObject(backup.backup_retention_settings);
  const flag = firstObject(settings.database_flags);
  const insights = firstObject(settings.insights_config);
  const ip = firstObject(settings.ip_configuration);
  const maintenance = firstObject(settings.maintenance_window);
  const labels = asObject(settings.user_labels);

  const instanceName = expectations.instanceName ?? "la-muni-rag-staging";
  const region = expectations.region ?? "us-central1";

  const expectEqual = (actual: unknown, expected: unknown, label: string): void => {
    if (!equalJson(actual, expected)) issues.push(`${label} must be ${JSON.stringify(expected)}`);
  };

  expectEqual(serviceAfter.project, expectations.projectId, "SQL Admin API project");
  expectEqual(serviceAfter.service, "sqladmin.googleapis.com", "enabled service");
  expectEqual(serviceAfter.disable_on_destroy, false, "disable_on_destroy");
  expectEqual(instanceAfter.project, expectations.projectId, "Cloud SQL project");
  expectEqual(instanceAfter.name, instanceName, "Cloud SQL instance name");
  expectEqual(instanceAfter.region, region, "Cloud SQL region");
  expectEqual(instanceAfter.database_version, "POSTGRES_16", "database version");
  expectEqual(instanceAfter.deletion_protection, true, "Terraform deletion protection");
  expectEqual(instanceAfter.root_password, null, "root password");
  expectEqual(instanceAfter.root_password_wo, null, "write-only root password");

  expectEqual(settings.activation_policy, "ALWAYS", "activation policy");
  expectEqual(settings.availability_type, "ZONAL", "availability type");
  expectEqual(settings.connector_enforcement, "REQUIRED", "connector enforcement");
  expectEqual(settings.data_api_access, "DISALLOW_DATA_API", "Data API access");
  expectEqual(settings.deletion_protection_enabled, true, "Cloud SQL deletion protection");
  expectEqual(settings.disk_autoresize, true, "disk autoresize");
  expectEqual(settings.disk_autoresize_limit, 100, "disk autoresize limit");
  expectEqual(settings.disk_size, 20, "disk size");
  expectEqual(settings.disk_type, "PD_SSD", "disk type");
  expectEqual(settings.edition, "ENTERPRISE", "edition");
  expectEqual(settings.pricing_plan, "PER_USE", "pricing plan");
  expectEqual(settings.tier, "db-custom-1-3840", "tier");

  const requiredLabels: Record<string, string> = {
    application: "la-muni-rag",
    environment: "staging",
    "managed-by": "terraform",
    "data-class": "synthetic-only",
    owner: expectations.ownerLabel,
  };
  for (const [key, value] of Object.entries(requiredLabels)) {
    expectEqual(labels[key], value, `label ${key}`);
  }

  expectEqual(backup.enabled, true, "backup enabled");
  expectEqual(backup.point_in_time_recovery_enabled, true, "PITR enabled");
  expectEqual(backup.start_time, "03:00", "backup start time");
  expectEqual(backup.transaction_log_retention_days, 3, "transaction log retention");
  expectEqual(backupRetention.retained_backups, 7, "retained backups");
  expectEqual(backupRetention.retention_unit, "COUNT", "backup retention unit");

  expectEqual(flag.name, "cloudsql.iam_authentication", "database flag name");
  expectEqual(flag.value, "on", "IAM database authentication");
  expectEqual(insights.query_insights_enabled, true, "Query Insights");
  expectEqual(insights.query_string_length, 1024, "query string length");
  expectEqual(insights.record_application_tags, true, "application tag recording");
  expectEqual(insights.record_client_address, false, "client address recording");

  expectEqual(ip.authorized_networks, [], "authorized networks");
  expectEqual(ip.enable_private_path_for_google_cloud_services, false, "private Google path");
  expectEqual(ip.ipv4_enabled, true, "public proxy IPv4");
  expectEqual(ip.private_network, null, "private network");
  expectEqual(ip.ssl_mode, "ENCRYPTED_ONLY", "SSL mode");

  expectEqual(maintenance.day, 7, "maintenance day");
  expectEqual(maintenance.hour, 6, "maintenance hour");
  expectEqual(maintenance.update_track, "stable", "maintenance update track");

  expectEqual(outputValue(plan, "connectivity_mode"), "AUTH_PROXY_PUBLIC", "connectivity output");
  expectEqual(outputValue(plan, "declared_pilot_budget_usd"), 1, "pilot budget output");
  expectEqual(outputValue(plan, "deletion_protection_enabled"), true, "deletion output");
  expectEqual(outputValue(plan, "estimated_pilot_compute_usd"), expectations.expectedComputeUsd, "compute estimate output");
  expectEqual(outputValue(plan, "max_pilot_runtime_hours"), 4, "runtime output");
  expectEqual(outputValue(plan, "resources_enabled"), true, "resource gate output");

  return {
    status: issues.length === 0 ? "valid" : "invalid",
    issues,
    summary: {
      addresses,
      projectId: typeof instanceAfter.project === "string" ? instanceAfter.project : null,
      instanceName: typeof instanceAfter.name === "string" ? instanceAfter.name : null,
      region: typeof instanceAfter.region === "string" ? instanceAfter.region : null,
      ownerLabel: typeof labels.owner === "string" ? labels.owner : null,
      estimatedComputeUsd: typeof outputValue(plan, "estimated_pilot_compute_usd") === "number"
        ? outputValue(plan, "estimated_pilot_compute_usd") as number
        : null,
      deletionProtection: typeof instanceAfter.deletion_protection === "boolean"
        ? instanceAfter.deletion_protection
        : null,
    },
  };
}
