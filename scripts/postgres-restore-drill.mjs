import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

process.umask(0o077);

const SAFE_SERVICE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{5,95}$/;
const APP_SCHEMAS = ["agent", "audit", "identity", "integration", "rag"];
const REQUIRED_EXTENSIONS = ["pgcrypto", "vector"];

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const validateSecretFileMode = async (path, name) => {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`${name} must reference a non-symlink regular file`);
  }
  if ((info.mode & 0o077) !== 0) throw new Error(`${name} must not be group/world accessible`);
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) {
    throw new Error(`${name} must be owned by the restore process user`);
  }
};

const validateArtifactRoot = async (path) => {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error("LA_MUNI_RESTORE_ARTIFACT_DIR must be a non-symlink directory");
  }
  if ((info.mode & 0o077) !== 0) {
    throw new Error("LA_MUNI_RESTORE_ARTIFACT_DIR must not be group/world accessible");
  }
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) {
    throw new Error("LA_MUNI_RESTORE_ARTIFACT_DIR must be owned by the restore process user");
  }
};

const run = (command, args, options = {}) => new Promise((resolvePromise, rejectPromise) => {
  const child = spawn(command, args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.on("error", rejectPromise);
  child.on("close", (code) => {
    const result = {
      code,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    };
    if (code === 0) return resolvePromise(result);
    const error = new Error(`${command} failed with exit code ${code}`);
    error.result = result;
    rejectPromise(error);
  });
});

const psql = async (service, sql) => {
  const result = await run("psql", [
    "-X",
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=1",
    "--no-align",
    "--tuples-only",
    `--dbname=service=${service}`,
    "--command",
    sql,
  ]);
  return result.stdout.trim();
};

const sha256Buffer = (value) => createHash("sha256").update(value).digest("hex");
const sha256Text = (value) => sha256Buffer(Buffer.from(value, "utf8"));
const quoteIdent = (value) => `"${value.replaceAll('"', '""')}"`;

const databaseIdentity = async (service) => {
  const raw = await psql(service, `
    SELECT json_build_object(
      'database', current_database(),
      'server_version', current_setting('server_version'),
      'server_version_num', current_setting('server_version_num'),
      'current_user', current_user
    )::text;
  `);
  return JSON.parse(raw);
};

const listTables = async (service) => {
  const raw = await psql(service, `
    SELECT COALESCE(json_agg(json_build_object('schema', schemaname, 'table', tablename)
      ORDER BY schemaname, tablename), '[]'::json)::text
    FROM pg_tables
    WHERE schemaname = ANY (ARRAY['agent','audit','identity','integration','rag']);
  `);
  return JSON.parse(raw);
};

const tableFingerprint = async (service, table, deepHashMaxRows) => {
  const qualified = `${quoteIdent(table.schema)}.${quoteIdent(table.table)}`;
  const count = Number(await psql(service, `SELECT count(*)::bigint FROM ${qualified};`));
  let contentHash = null;
  if (count <= deepHashMaxRows) {
    contentHash = await psql(service, `
      SELECT encode(public.digest(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), ''), 'sha256'), 'hex')
      FROM (
        SELECT encode(public.digest(to_jsonb(t)::text, 'sha256'), 'hex') AS row_hash
        FROM ${qualified} AS t
      ) AS hashes;
    `);
  }
  return {
    schema: table.schema,
    table: table.table,
    row_count: count,
    content_hash: contentHash || null,
    deep_hash_applied: count <= deepHashMaxRows,
  };
};

const catalogSnapshot = async (service) => {
  const raw = await psql(service, `
    WITH table_state AS (
      SELECT n.nspname AS schema_name, c.relname AS object_name,
             c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ANY (ARRAY['agent','audit','identity','integration','rag'])
        AND c.relkind IN ('r','p','v','m','S')
    ), constraints AS (
      SELECT n.nspname AS schema_name, c.relname AS object_name,
             con.conname AS item_name, pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ANY (ARRAY['agent','audit','identity','integration','rag'])
    ), policies AS (
      SELECT schemaname AS schema_name, tablename AS object_name,
             policyname AS item_name,
             concat_ws('|', permissive, roles::text, cmd, qual, with_check) AS definition
      FROM pg_policies
      WHERE schemaname = ANY (ARRAY['agent','audit','identity','integration','rag'])
    ), indexes AS (
      SELECT schemaname AS schema_name, tablename AS object_name,
             indexname AS item_name, indexdef AS definition
      FROM pg_indexes
      WHERE schemaname = ANY (ARRAY['agent','audit','identity','integration','rag'])
    ), functions AS (
      SELECT n.nspname AS schema_name, p.proname AS object_name,
             pg_get_function_identity_arguments(p.oid) AS item_name,
             pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = ANY (ARRAY['agent','audit','identity','integration','rag'])
    )
    SELECT json_build_object(
      'schemas', (SELECT COALESCE(json_agg(schema_name ORDER BY schema_name), '[]'::json)
                  FROM (SELECT nspname AS schema_name FROM pg_namespace
                        WHERE nspname = ANY (ARRAY['agent','audit','identity','integration','rag'])) s),
      'extensions', (SELECT COALESCE(json_agg(json_build_object('name', extname, 'version', extversion)
                    ORDER BY extname), '[]'::json) FROM pg_extension
                    WHERE extname IN ('pgcrypto','vector')),
      'tables', (SELECT COALESCE(json_agg(row_to_json(t) ORDER BY schema_name, object_name), '[]'::json)
                 FROM table_state t),
      'constraints', (SELECT COALESCE(json_agg(row_to_json(c) ORDER BY schema_name, object_name, item_name), '[]'::json)
                      FROM constraints c),
      'policies', (SELECT COALESCE(json_agg(row_to_json(p) ORDER BY schema_name, object_name, item_name), '[]'::json)
                   FROM policies p),
      'indexes', (SELECT COALESCE(json_agg(row_to_json(i) ORDER BY schema_name, object_name, item_name), '[]'::json)
                  FROM indexes i),
      'functions', (SELECT COALESCE(json_agg(row_to_json(f) ORDER BY schema_name, object_name, item_name), '[]'::json)
                    FROM functions f)
    )::text;
  `);
  return JSON.parse(raw);
};

const databaseFingerprint = async (service, deepHashMaxRows) => {
  const [identity, tables, catalog] = await Promise.all([
    databaseIdentity(service),
    listTables(service),
    catalogSnapshot(service),
  ]);
  const tableData = [];
  for (const table of tables) tableData.push(await tableFingerprint(service, table, deepHashMaxRows));
  const normalizedCatalog = JSON.stringify(catalog);
  const normalizedRows = JSON.stringify(tableData);
  return {
    identity,
    catalog,
    tables: tableData,
    catalog_sha256: sha256Text(normalizedCatalog),
    table_data_sha256: sha256Text(normalizedRows),
  };
};

const compareFingerprints = (source, target) => {
  const issues = [];
  if (source.catalog_sha256 !== target.catalog_sha256) issues.push("catalog_fingerprint_mismatch");
  if (source.table_data_sha256 !== target.table_data_sha256) issues.push("table_data_fingerprint_mismatch");
  const schemas = target.catalog.schemas ?? [];
  for (const expected of APP_SCHEMAS) if (!schemas.includes(expected)) issues.push(`missing_schema:${expected}`);
  const extensionNames = new Set((target.catalog.extensions ?? []).map((item) => item.name));
  for (const expected of REQUIRED_EXTENSIONS) if (!extensionNames.has(expected)) issues.push(`missing_extension:${expected}`);
  return issues;
};

const sourceService = requiredEnv("LA_MUNI_RESTORE_SOURCE_SERVICE");
const targetService = requiredEnv("LA_MUNI_RESTORE_TARGET_SERVICE");
const artifactRoot = resolve(requiredEnv("LA_MUNI_RESTORE_ARTIFACT_DIR"));
const workingTree = resolve(process.cwd());
if (artifactRoot === workingTree || artifactRoot.startsWith(`${workingTree}${sep}`)) {
  throw new Error("restore artifacts must remain outside the repository working tree");
}
const runId = requiredEnv("LA_MUNI_RESTORE_RUN_ID");
const deepHashMaxRows = Number.parseInt(process.env.LA_MUNI_RESTORE_DEEP_HASH_MAX_ROWS ?? "100000", 10);
if (!SAFE_SERVICE.test(sourceService) || !SAFE_SERVICE.test(targetService)) {
  throw new Error("restore service aliases must be safe libpq service names");
}
if (sourceService === targetService) throw new Error("source and target services must differ");
if (!SAFE_RUN_ID.test(runId)) throw new Error("LA_MUNI_RESTORE_RUN_ID is invalid");
if (!Number.isSafeInteger(deepHashMaxRows) || deepHashMaxRows < 0 || deepHashMaxRows > 1_000_000) {
  throw new Error("LA_MUNI_RESTORE_DEEP_HASH_MAX_ROWS must be between 0 and 1000000");
}
await validateSecretFileMode(requiredEnv("PGSERVICEFILE"), "PGSERVICEFILE");
if (process.env.PGPASSFILE) await validateSecretFileMode(process.env.PGPASSFILE, "PGPASSFILE");
await validateArtifactRoot(artifactRoot);

const runDir = join(artifactRoot, runId);
await mkdir(runDir, { recursive: false, mode: 0o700 });
const dumpFile = join(runDir, "database.dump");
const checksumFile = join(runDir, "database.dump.sha256");
const manifestFile = join(runDir, "database.dump.list");
const metadataFile = join(runDir, "metadata.json");
const resultFile = join(runDir, "result.json");
const startedAt = new Date();

const sourceIdentity = await databaseIdentity(sourceService);
const targetIdentity = await databaseIdentity(targetService);
if (sourceIdentity.database === targetIdentity.database) throw new Error("source and target databases must differ");
const targetTableCount = Number(await psql(targetService, `
  SELECT count(*) FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog','information_schema');
`));
if (targetTableCount !== 0) throw new Error("restore target must be empty");

const sourceFingerprint = await databaseFingerprint(sourceService, deepHashMaxRows);
await run("pg_dump", [
  `--dbname=service=${sourceService}`,
  "--format=custom",
  "--no-owner",
  "--no-acl",
  `--file=${dumpFile}`,
]);
await chmod(dumpFile, 0o600);
const dumpBytes = await readFile(dumpFile);
const dumpSha256 = sha256Buffer(dumpBytes);
await writeFile(checksumFile, `${dumpSha256}  ${basename(dumpFile)}\n`, { mode: 0o600 });
const manifest = (await run("pg_restore", ["--list", dumpFile])).stdout;
await writeFile(manifestFile, manifest, { mode: 0o600 });
for (const schema of APP_SCHEMAS) {
  if (!manifest.includes(`SCHEMA - ${schema}`)) throw new Error(`backup manifest missing schema ${schema}`);
}
const checksumAgain = sha256Buffer(await readFile(dumpFile));
if (checksumAgain !== dumpSha256) throw new Error("backup checksum changed before restore");

const backupCompletedAt = new Date();
await run("pg_restore", [
  `--dbname=service=${targetService}`,
  "--exit-on-error",
  "--single-transaction",
  "--no-owner",
  "--no-acl",
  dumpFile,
]);
const restoreCompletedAt = new Date();
const targetFingerprint = await databaseFingerprint(targetService, deepHashMaxRows);
const issues = compareFingerprints(sourceFingerprint, targetFingerprint);
const verifiedAt = new Date();

const metadata = {
  schema_version: "v1",
  run_id: runId,
  source_database: sourceIdentity.database,
  target_database: targetIdentity.database,
  source_server_version: sourceIdentity.server_version,
  target_server_version: targetIdentity.server_version,
  pg_dump_version: (await run("pg_dump", ["--version"])).stdout.trim(),
  pg_restore_version: (await run("pg_restore", ["--version"])).stdout.trim(),
  started_at: startedAt.toISOString(),
  backup_completed_at: backupCompletedAt.toISOString(),
  restore_completed_at: restoreCompletedAt.toISOString(),
  verified_at: verifiedAt.toISOString(),
  dump_bytes: dumpBytes.byteLength,
  dump_sha256: dumpSha256,
  source_catalog_sha256: sourceFingerprint.catalog_sha256,
  target_catalog_sha256: targetFingerprint.catalog_sha256,
  source_table_data_sha256: sourceFingerprint.table_data_sha256,
  target_table_data_sha256: targetFingerprint.table_data_sha256,
  deep_hash_max_rows: deepHashMaxRows,
};
await writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });

const result = {
  schema_version: "v1",
  result: issues.length === 0 ? "disposable_logical_database_restore_verified" : "restore_verification_failed",
  run_id: runId,
  issues,
  checks: {
    isolated_distinct_target: true,
    target_was_empty: true,
    checksum_verified_before_restore: checksumAgain === dumpSha256,
    custom_manifest_verified: true,
    transactional_restore_completed: true,
    required_schemas_present: issues.every((item) => !item.startsWith("missing_schema:")),
    required_extensions_present: issues.every((item) => !item.startsWith("missing_extension:")),
    catalog_fingerprint_equal: sourceFingerprint.catalog_sha256 === targetFingerprint.catalog_sha256,
    table_data_fingerprint_equal: sourceFingerprint.table_data_sha256 === targetFingerprint.table_data_sha256,
    external_object_restore_verified: false,
    point_in_time_recovery_verified: false,
    production_rpo_rto_verified: false,
    human_review_completed: false,
  },
  artifacts: {
    dump_file: basename(dumpFile),
    checksum_file: basename(checksumFile),
    manifest_file: basename(manifestFile),
    metadata_file: basename(metadataFile),
  },
};
await writeFile(resultFile, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(result)}\n`);
if (issues.length > 0) process.exitCode = 1;
