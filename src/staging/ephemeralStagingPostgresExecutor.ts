import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import pg from "pg";
import {
  STAGING_DATABASES,
  STAGING_RUNTIME_ROLES,
  assertSafeStagingAdminUrl,
  type EphemeralStagingExecutor,
  type StagingSmoke,
} from "./ephemeralStagingRunner.js";

const execFileAsync = promisify(execFile);
const { Client } = pg;
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

const quoteIdentifier = (value: string): string => {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error("unsafe_staging_identifier");
  return `"${value}"`;
};

const minimalProcessEnv = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH,
  TMPDIR: process.env.TMPDIR,
  LANG: process.env.LANG ?? "C.UTF-8",
  CI: process.env.CI,
  NODE_ENV: "production",
  DOTENV_CONFIG_PATH: "/dev/null",
  DOTENV_CONFIG_QUIET: "true",
});

const stripPsqlMetaCommands = (sql: string): string =>
  sql.split(/\r?\n/).filter((line) => !line.trimStart().startsWith("\\")).join("\n");

export interface PostgresStagingExecutorOptions {
  projectRoot: string;
  adminDatabaseUrl: string;
}

export class PostgresEphemeralStagingExecutor implements EphemeralStagingExecutor {
  private readonly adminUrl: URL;

  constructor(private readonly options: PostgresStagingExecutorOptions) {
    this.adminUrl = assertSafeStagingAdminUrl(options.adminDatabaseUrl);
  }

  private databaseUrl(database: string, username?: string, password?: string): string {
    if (!SAFE_IDENTIFIER.test(database)) throw new Error("unsafe_staging_database");
    const url = new URL(this.adminUrl);
    url.pathname = `/${database}`;
    if (username !== undefined) url.username = username;
    if (password !== undefined) url.password = password;
    return url.toString();
  }

  private async adminQuery(sql: string, values: unknown[] = []): Promise<pg.QueryResult> {
    const client = new Client({ connectionString: this.adminUrl.toString() });
    await client.connect();
    try { return await client.query(sql, values); }
    finally { await client.end(); }
  }

  async preflight(): Promise<void> {
    const result = await this.adminQuery(`SELECT
      current_database() AS database_name,
      current_user AS user_name,
      current_setting('server_version_num')::integer AS version_num,
      EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS vector_available,
      (SELECT rolcreatedb AND rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_admin,
      ARRAY(SELECT datname FROM pg_database
        WHERE datistemplate = false AND datname <> 'postgres' AND datname <> ALL($1::text[])
        ORDER BY datname) AS unrelated_databases`, [[...STAGING_DATABASES]]);
    const row = result.rows[0];
    if (!row || row.database_name !== "postgres" || Number(row.version_num) < 150000 || row.vector_available !== true || row.can_admin !== true) {
      throw new Error("staging_postgres_preflight_failed");
    }
    if (Array.isArray(row.unrelated_databases) && row.unrelated_databases.length > 0) {
      throw new Error("staging_cluster_not_dedicated");
    }
  }

  async environmentExists(): Promise<boolean> {
    const result = await this.adminQuery(`SELECT
      EXISTS (SELECT 1 FROM pg_database WHERE datname = ANY($1::text[])) AS databases_exist,
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ANY($2::text[])) AS roles_exist`, [
      [...STAGING_DATABASES],
      [...STAGING_RUNTIME_ROLES],
    ]);
    return Boolean(result.rows[0]?.databases_exist || result.rows[0]?.roles_exist);
  }

  async cleanKnownEnvironment(): Promise<void> {
    for (const database of [...STAGING_DATABASES].reverse()) await this.dropDatabase(database);
    for (const role of STAGING_RUNTIME_ROLES) await this.dropRole(role);
  }

  async build(): Promise<void> {
    await execFileAsync(process.execPath, [resolve(this.options.projectRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], {
      cwd: this.options.projectRoot,
      env: minimalProcessEnv(),
      timeout: 180_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  }

  async createDatabase(name: string): Promise<void> {
    await this.adminQuery(`CREATE DATABASE ${quoteIdentifier(name)}`);
  }

  async recreateDatabase(name: string): Promise<void> {
    await this.dropDatabase(name);
    await this.createDatabase(name);
  }

  async applySql(database: string, file: string): Promise<void> {
    const filePath = resolve(this.options.projectRoot, file);
    if (!filePath.startsWith(resolve(this.options.projectRoot) + "/")) throw new Error("unsafe_staging_sql_path");
    const sql = stripPsqlMetaCommands(await readFile(filePath, "utf8"));
    const client = new Client({ connectionString: this.databaseUrl(database) });
    await client.connect();
    try { await client.query(sql); }
    finally { await client.end(); }
  }

  async runSmoke(smoke: StagingSmoke): Promise<void> {
    const env: NodeJS.ProcessEnv = {
      ...minimalProcessEnv(),
      DATABASE_URL: this.databaseUrl(smoke.database, smoke.runtimeRole, smoke.runtimePassword),
    };
    if (smoke.adminDatabaseUrlRequired) env.ADMIN_DATABASE_URL = this.databaseUrl(smoke.database);
    await execFileAsync(process.execPath, [resolve(this.options.projectRoot, smoke.script)], {
      cwd: this.options.projectRoot,
      env,
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
  }

  async dropDatabase(name: string): Promise<boolean> {
    const exists = Boolean((await this.adminQuery(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS present",
      [name]
    )).rows[0]?.present);
    if (exists) await this.adminQuery(`DROP DATABASE ${quoteIdentifier(name)} WITH (FORCE)`);
    return exists;
  }

  async dropRole(name: string): Promise<boolean> {
    const exists = Boolean((await this.adminQuery(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS present",
      [name]
    )).rows[0]?.present);
    if (exists) await this.adminQuery(`DROP ROLE ${quoteIdentifier(name)}`);
    return exists;
  }
}
