import pg from "pg";
import { STAGING_DATABASES } from "../staging/ephemeralStagingRunner.js";
import {
  assertSafeCloudSqlProxyUrl,
  validateCloudSqlPreflightRows,
} from "../gcp/cloudSqlStaging.js";

const { Client } = pg;
const confirmation = process.env.GCP_CLOUDSQL_CONFIRM_STAGING;
const rawUrl = process.env.STAGING_ADMIN_DATABASE_URL;

if (confirmation !== "true") throw new Error("GCP_CLOUDSQL_CONFIRM_STAGING=true is required");
if (!rawUrl) throw new Error("STAGING_ADMIN_DATABASE_URL is required");
const url = assertSafeCloudSqlProxyUrl(rawUrl);

const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  const result = await client.query(
    `SELECT
       current_database() AS database_name,
       current_user AS user_name,
       current_setting('server_version_num')::integer AS version_num,
       EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS vector_available,
       (SELECT rolcreatedb AND rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_admin,
       current_setting('cloudsql.iam_authentication', true) AS cloudsql_marker,
       ARRAY(
         SELECT datname
         FROM pg_database
         WHERE datistemplate = false
           AND datname <> 'postgres'
           AND datname <> ALL($1::text[])
         ORDER BY datname
       ) AS unrelated_databases`,
    [[...STAGING_DATABASES]]
  );
  const summary = validateCloudSqlPreflightRows(result.rows[0] ?? {});
  process.stdout.write(`${JSON.stringify({ status: "ready", ...summary }, null, 2)}\n`);
} finally {
  await client.end();
}
