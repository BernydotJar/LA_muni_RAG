import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_SECTION_PROJECTION,
  projectPublicSections,
} from "../ingestion/publicSectionProjection.js";
import type { TenantTransactionClient } from "../security/index.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";

class ProjectionClient implements TenantTransactionClient {
  readonly calls: Array<{ sql: string; values?: unknown[] }> = [];
  private index = 0;
  async query(sql: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    this.calls.push({ sql, ...(values ? { values } : {}) });
    this.index += 1;
    if (this.index === 1) return { rows: [{ vector_count: 2, job_count: 1 }], rowCount: 1 };
    if (this.index === 2) return { rows: [{ non_projected_count: 0 }], rowCount: 1 };
    if (this.index === 3) return { rows: [], rowCount: 2 };
    if (this.index === 4) return { rows: [], rowCount: 2 };
    if (this.index === 5) return { rows: [{ section_count: 2 }], rowCount: 1 };
    throw new Error("unexpected query");
  }
  release(): void {}
}

describe("public corpus section projection", () => {
  it("projects exactly one accepted processed vector generation without replacing curated sections", async () => {
    const client = new ProjectionClient();
    const result = await projectPublicSections(client, { tenantId: TENANT, documentVersionId: VERSION });
    assert.deepEqual(result, {
      tenantId: TENANT,
      documentVersionId: VERSION,
      vectorCount: 2,
      sectionCount: 2,
      deletedProjectionCount: 2,
    });
    const source = client.calls.map((call) => call.sql).join("\n");
    assert.match(source, /artifact\.status = 'accepted'/);
    assert.match(source, /scan\.verdict = 'clean'/);
    assert.match(source, /job\.status = 'processed'/);
    assert.match(source, /document\.confidentiality = 'public'/);
    assert.match(source, /source\.retrieval_state = 'indexed'/);
    assert.match(source, /metadata ->> 'projection' IS DISTINCT FROM/);
    assert.match(source, /vector\.chunk_text/);
    assert.ok(client.calls.every((call) => !JSON.stringify(call.values).includes("password")));
    assert.equal(PUBLIC_SECTION_PROJECTION, "embedding_vectors_to_document_sections_v1");
  });

  it("rejects non-canonical scope before database access", async () => {
    const client = new ProjectionClient();
    await assert.rejects(
      projectPublicSections(client, { tenantId: "not-a-uuid", documentVersionId: VERSION }),
      /canonical tenant and document-version UUIDs/
    );
    assert.equal(client.calls.length, 0);
  });
});
