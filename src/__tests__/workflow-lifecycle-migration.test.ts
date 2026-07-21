import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL("../../db/migrations/009_workflow_lifecycle.sql", import.meta.url);

describe("workflow lifecycle migration", () => {
  it("creates tenant-owned procedure versions, reviews, and approvals with forced RLS", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const table of [
      "rag.procedures",
      "rag.procedure_versions",
      "rag.workflow_reviews",
      "rag.workflow_approvals",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
      assert.match(
        sql,
        new RegExp(`ALTER TABLE ${table.replace(".", "\\.")} FORCE ROW LEVEL SECURITY`)
      );
    }
    assert.equal((sql.match(/tenant_id = identity\.current_tenant_id\(\)/g) ?? []).length, 8);
    assert.match(sql, /FOREIGN KEY \(created_by_principal_id, tenant_id\)/);
    assert.match(sql, /FOREIGN KEY \(reviewer_principal_id, tenant_id\)/);
    assert.match(sql, /FOREIGN KEY \(approver_principal_id, tenant_id\)/);
    assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*rag\.workflow_approvals[\s\S]*FROM PUBLIC/);
  });

  it("requires every newly created workflow version to start as draft", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /generation_source IN \('ai', 'human', 'import'\)/);
    assert.match(sql, /IF TG_OP = 'INSERT'[\s\S]*NEW\.lifecycle_status <> 'draft'/);
    assert.match(sql, /new workflow versions must start as draft/);
    assert.match(sql, /new workflow drafts cannot include lifecycle decisions/);
  });

  it("enforces the full lifecycle and approved-content immutability", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(
      sql,
      /lifecycle_status IN \('draft', 'in_review', 'approved', 'superseded', 'archived'\)/
    );
    assert.match(sql, /invalid draft workflow transition/);
    assert.match(sql, /invalid review workflow transition/);
    assert.match(sql, /invalid approved workflow transition/);
    assert.match(sql, /invalid superseded workflow transition/);
    assert.match(sql, /archived workflow versions are terminal/);
    assert.match(sql, /approved, superseded, and archived workflow content is immutable/);
    assert.match(sql, /replacement workflow must belong to the same procedure/);
    assert.match(
      sql,
      /CREATE UNIQUE INDEX procedure_versions_one_approved_idx[\s\S]*WHERE lifecycle_status = 'approved'/
    );
  });

  it("requires a recommended human review and three distinct principals before approval", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /approval requires a recommended human review/);
    assert.match(sql, /creator, reviewer, and approver must be distinct/);
    assert.match(sql, /workflow creator cannot review the same version/);
    assert.match(sql, /workflow approval requires a recommended in_review version/);
    assert.match(sql, /submitted_by_principal_id IS NULL AND submitted_at IS NULL/);
    assert.match(sql, /approved_by_principal_id IS NULL AND approved_at IS NULL/);
  });

  it("keeps review and approval evidence append-only", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /CREATE FUNCTION rag\.prevent_workflow_governance_mutation\(\)/);
    assert.match(sql, /workflow review and approval evidence is append-only/);
    assert.match(
      sql,
      /CREATE TRIGGER workflow_reviews_append_only[\s\S]*BEFORE UPDATE OR DELETE/
    );
    assert.match(
      sql,
      /CREATE TRIGGER workflow_approvals_append_only[\s\S]*BEFORE UPDATE OR DELETE/
    );
  });

  it("does not add campaign, voter, content-production, or publication state", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const tableBodies = [
      ...sql.matchAll(/CREATE TABLE rag\.(?:procedures|procedure_versions|workflow_reviews|workflow_approvals) \(([\s\S]*?)\n\);/g),
    ].map((match) => match[1]).join("\n");
    assert.doesNotMatch(
      tableBodies,
      /campaign|voter|electoral_segment|message_house|content_brief|copy|asset|channel|publication_task|media_spend/i
    );
  });
});
