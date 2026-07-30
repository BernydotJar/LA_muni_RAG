import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const INDEX_PATH = "contracts/decision-packets/v1/human-gated-decision-packets.json";
const SCHEMA_PATH = "contracts/decision-packets/v1/human-decision-receipt.schema.json";
const read = (path: string): Promise<string> => readFile(path, "utf8");
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await read(path)) as T;

interface Packet {
  packet_id: string;
  topic: string;
  document: string;
  decision_status: string;
  selected_option: null;
  authorized_actions: string[];
  required_authorities: string[];
  prohibited_until_receipt: string[];
}
interface PacketIndex {
  schema_version: string;
  status: string;
  production_readiness_claim: boolean;
  current_state: Record<string, unknown> & {
    real_documents_ingested: number;
    real_corpus_retrieval_evaluation: number;
    productive_authenticated_browser_journeys: { passed: number; total: number };
    managed_gcp_staging_receipt_present: boolean;
    cloud_sql: Record<string, unknown>;
  };
  global_prohibited_actions_without_receipt: string[];
  packets: Packet[];
  receipt_schema: string;
}

describe("EVAL-HUMAN-DECISION-PACKETS-001", () => {
  it("preserves the known blocked baseline and rejects readiness", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    assert.equal(index.schema_version, "1.0.0");
    assert.equal(index.status, "human_decision_required");
    assert.equal(index.production_readiness_claim, false);
    assert.equal(index.current_state.real_documents_ingested, 0);
    assert.equal(index.current_state.real_corpus_retrieval_evaluation, 0);
    assert.deepEqual(index.current_state.productive_authenticated_browser_journeys, { passed: 0, total: 12 });
    assert.equal(index.current_state.managed_gcp_staging_receipt_present, false);
    assert.deepEqual(index.current_state.cloud_sql, {
      state: "STOPPED",
      activation_policy: "NEVER",
      restart_authorized: false,
      apply_authorized: false,
      destroy_authorized: false,
    });
  });

  it("keeps every decision pending with no selected option or action", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    assert.deepEqual(index.packets.map((packet) => packet.packet_id), [
      "HDP-IDP-001",
      "HDP-CORPUS-001",
      "HDP-CLOUDSQL-001",
      "HDP-PRODUCTION-001",
    ]);
    assert.ok(index.packets.every((packet) => packet.decision_status === "pending_human_decision"));
    assert.ok(index.packets.every((packet) => packet.selected_option === null));
    assert.ok(index.packets.every((packet) => packet.authorized_actions.length === 0));
    assert.ok(index.packets.every((packet) => packet.required_authorities.length >= 4));
  });

  it("requires consistent decision, evidence, prohibition and receipt sections", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    const headings = [
      "## Decision required",
      "## Current evidence",
      "## Options",
      "## Preconditions",
      "## Prohibited until approval",
      "## Decision receipt",
    ];
    for (const packet of index.packets) {
      const document = await read(packet.document);
      assert.match(document, /Status: pending human decision/);
      assert.ok(document.includes(`Packet ID: \`${packet.packet_id}\``));
      for (const heading of headings) assert.ok(document.includes(heading), `${packet.packet_id}: ${heading}`);
      assert.match(document, /No action is authorized by this packet alone\./);
      assert.match(document, /human-decision-receipt\.schema\.json/);
    }
  });

  it("keeps productive identity provider selection and credentials human-gated", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    const packet = index.packets.find((item) => item.packet_id === "HDP-IDP-001");
    assert.ok(packet);
    const document = await read(packet.document);
    assert.match(document, /No productive provider, client registration, credential/);
    assert.match(document, /creating a provider tenant\/account, client registration or credential/);
    assert.match(document, /Service Bearer credentials cannot be repurposed as human browser identity/);
    assert.doesNotMatch(document, /Status: approved|selected_option/i);
  });

  it("keeps real corpus acquisition at zero until rights and governance approval", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    const packet = index.packets.find((item) => item.packet_id === "HDP-CORPUS-001");
    assert.ok(packet);
    const document = await read(packet.document);
    assert.match(document, /Real documents ingested: `0`/);
    assert.match(document, /Real-corpus retrieval evaluation: `0`/);
    assert.match(document, /crawling, downloading or ingesting real documents/);
    assert.match(document, /rights and use restrictions per source/);
  });

  it("separates Cloud SQL restart, apply, destroy, billing and deletion authority", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    const packet = index.packets.find((item) => item.packet_id === "HDP-CLOUDSQL-001");
    assert.ok(packet);
    const document = await read(packet.document);
    assert.match(document, /Managed Cloud SQL state: `STOPPED`/);
    assert.match(document, /Activation policy: `NEVER`/);
    assert.match(document, /Approval of one action never implies approval of another/);
    for (const phrase of [
      "restarting the instance",
      "Terraform apply or destroy",
      "changing billing",
      "deleting data/backups",
    ]) assert.match(document, new RegExp(phrase));
  });

  it("keeps production evidence collection separate from go-live authority", async () => {
    const index = await readJson<PacketIndex>(INDEX_PATH);
    const packet = index.packets.find((item) => item.packet_id === "HDP-PRODUCTION-001");
    assert.ok(packet);
    const document = await read(packet.document);
    assert.match(document, /Productive authenticated browser journeys: `0\/12`/);
    assert.match(document, /evidence program only/);
    assert.match(document, /separate final go-live receipt remains required/);
    assert.match(document, /production SLO commitment or readiness declaration/);
    assert.match(document, /OS Electoral or Content Agency/);
  });

  it("defines a strict separate receipt without pretending to authenticate authority", async () => {
    const schema = await readJson<Record<string, any>>(SCHEMA_PATH);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.packet_id.enum, [
      "HDP-IDP-001",
      "HDP-CORPUS-001",
      "HDP-CLOUDSQL-001",
      "HDP-PRODUCTION-001",
    ]);
    assert.deepEqual(schema.properties.decision_status.enum, ["approved", "rejected", "deferred"]);
    for (const field of [
      "decision_authority_roles",
      "decision_record_ref",
      "approved_actions",
      "scope",
      "constraints",
      "evidence_refs",
    ]) assert.ok(schema.required.includes(field));
    const adr = await read("docs/decisions/080-human-gated-decision-receipts.md");
    assert.match(adr, /repository cannot authenticate the human decision maker/);
    assert.match(adr, /execution remains a separate/);
  });

  it("wires deterministic validation, named EVAL and backend CI", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    assert.match(packageJson.scripts["decision-packets:validate"] ?? "", /validate-human-decision-packets/);
    assert.match(packageJson.scripts["eval:human-decision-packets"] ?? "", /eval-human-decision-packets-001/);
    const validator = await read("scripts/validate-human-decision-packets.mjs");
    assert.match(validator, /global_prohibited_actions_without_receipt/);
    assert.match(validator, /FORBIDDEN_SECRET_PATTERNS/);
    assert.match(validator, /selectedOptions: 0/);
    assert.match(validator, /authorizedActions: 0/);
    const ci = await read(".github/workflows/ci.yml");
    assert.match(ci, /Validate human decision packets/);
    assert.match(ci, /EVAL-HUMAN-DECISION-PACKETS-001/);
  });
});
