import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultProcedureWorkflowCompiler } from "../api/v1/index.js";
import { createTenantScopedSearches } from "../search.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

describe("procedure query tenant-scoped retrieval", () => {
  it("uses the same injected client and explicit tenant predicates for keyword and phrase SQL", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      async query(sql: string, values?: unknown[]) {
        calls.push({ sql, ...(values ? { values } : {}) });
        return {
          rows: [
            {
              document_id: "22222222-2222-4222-8222-222222222222",
              document_version_id: "33333333-3333-4333-8333-333333333333",
              section_id: "44444444-4444-4444-8444-444444444444",
              document_title: "Documento oficial",
              document_type: "law",
              document_scope: "national",
              document_status: "active",
              version_extraction_status: "processed",
              official_source: true,
              document_metadata: { confidentiality: "public" },
              content_sha256: "a".repeat(64),
              citation_label: "Artículo 1",
              page_start: 1,
              source_url: "https://example.invalid/document",
              keyword_score: 0.8,
              snippet: "Resultado keyword",
              preview: "Resultado phrase",
              municipality_name: null,
              municipality_slug: null,
            },
          ],
        };
      },
    };
    const collected: unknown[] = [];
    const searches = createTenantScopedSearches(client, TENANT_ID, (rows) => {
      collected.push(...rows);
    });

    const keyword = await searches.keywordSearch("agua", 5);
    const phrase = await searches.phraseSearch("agua potable", 4);

    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.deepEqual(call.values?.slice(-1), [TENANT_ID]);
      assert.match(call.sql, /s\.tenant_id\s*=\s*\$3::uuid/);
      assert.match(call.sql, /v\.tenant_id\s*=\s*\$3::uuid/);
      assert.match(call.sql, /d\.tenant_id\s*=\s*\$3::uuid/);
      assert.match(call.sql, /municipality\.tenant_id\s*=\s*\$3::uuid/);
      assert.match(call.sql, /d\.status\s*=\s*'active'/);
      assert.match(call.sql, /v\.extraction_status\s*=\s*'processed'/);
      assert.match(call.sql, /d\.metadata\s*->>\s*'confidentiality'\s*=\s*'public'/);
      assert.doesNotMatch(call.sql, /embedding|vector/i);
    }
    assert.equal(keyword[0]?.documentId, "22222222-2222-4222-8222-222222222222");
    assert.equal(phrase[0]?.sectionId, "44444444-4444-4444-8444-444444444444");
    assert.equal(collected.length, 2);
  });

  it("keeps default deep-dive hybrid compilation on the supplied transaction client", async () => {
    const calls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const client = {
      async query(sql: string) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        calls.push(sql);
        await new Promise<void>((resolve) => setImmediate(resolve));
        inFlight -= 1;
        return { rows: [] };
      },
      release() {},
    };
    const compiler = createDefaultProcedureWorkflowCompiler();
    await compiler(
      {
        tenant_id: TENANT_ID,
        question: "¿Qué procedimiento documental aplica a una solicitud comunitaria?",
        requested_depth: "deep_dive",
      },
      client
    );

    assert.ok(calls.length >= 2);
    assert.equal(maxInFlight, 1);
    assert.ok(calls.some((sql) => /content_tsv/.test(sql)));
    assert.ok(calls.some((sql) => /content ILIKE/.test(sql)));
    for (const sql of calls) {
      assert.match(sql, /d\.tenant_id\s*=\s*\$3::uuid/);
      assert.match(sql, /d\.status\s*=\s*'active'/);
      assert.match(sql, /v\.extraction_status\s*=\s*'processed'/);
      assert.match(sql, /d\.metadata\s*->>\s*'confidentiality'\s*=\s*'public'/);
      assert.doesNotMatch(sql, /embedding|vector/i);
    }
  });
});
