import pg from "pg";
import { projectPublicSections } from "../ingestion/publicSectionProjection.js";
import { withTenantTransaction } from "../security/index.js";

const { Pool } = pg;

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const main = async (): Promise<void> => {
  if (process.env.PUBLIC_CORPUS_CONFIRM_PROJECTION !== "true") {
    throw new Error("PUBLIC_CORPUS_CONFIRM_PROJECTION=true is required.");
  }
  const databaseUrl = required("PUBLIC_CORPUS_ADMIN_DATABASE_URL");
  const tenantId = required("PUBLIC_CORPUS_TENANT_ID");
  const documentVersionIds = required("PUBLIC_CORPUS_DOCUMENT_VERSION_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (documentVersionIds.length < 1 || documentVersionIds.length > 32) {
    throw new Error("PUBLIC_CORPUS_DOCUMENT_VERSION_IDS must contain between 1 and 32 values.");
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5_000 });
  try {
    const results = [];
    for (const documentVersionId of documentVersionIds) {
      results.push(await withTenantTransaction(pool, tenantId, (client) =>
        projectPublicSections(client, { tenantId, documentVersionId })
      ));
    }
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      projection: "embedding_vectors_to_document_sections_v1",
      results,
    }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Public section projection failed."}\n`);
  process.exitCode = 1;
});
