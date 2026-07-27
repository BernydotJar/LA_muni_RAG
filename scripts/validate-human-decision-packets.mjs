#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const INDEX_PATH = "contracts/decision-packets/v1/human-gated-decision-packets.json";
const RECEIPT_SCHEMA_PATH = "contracts/decision-packets/v1/human-decision-receipt.schema.json";
const REQUIRED_PACKETS = new Map([
  ["HDP-IDP-001", "productive_human_identity_provider"],
  ["HDP-CORPUS-001", "real_municipal_corpus"],
  ["HDP-CLOUDSQL-001", "cloud_sql_lifecycle"],
  ["HDP-PRODUCTION-001", "production_controls_and_release"],
]);
const REQUIRED_HEADINGS = [
  "## Decision required",
  "## Current evidence",
  "## Options",
  "## Preconditions",
  "## Prohibited until approval",
  "## Decision receipt",
];
const FORBIDDEN_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
];

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const exactKeys = (value, expected, context) => {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${context} keys changed`);
};

const index = await readJson(INDEX_PATH);
assert.equal(index.schema_version, "1.0.0");
assert.equal(index.project, "LA Muni RAG");
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
assert.equal(index.current_state.productive_idp_selected, false);
assert.equal(index.current_state.productive_telemetry_exporter_selected, false);
assert.equal(index.current_state.protected_merge_completed, false);
assert.equal(index.current_state.production_release_completed, false);
assert.equal(index.receipt_schema, RECEIPT_SCHEMA_PATH);
assert.equal(index.packets.length, REQUIRED_PACKETS.size);
assert.equal(new Set(index.packets.map((packet) => packet.packet_id)).size, REQUIRED_PACKETS.size);

const validatedDocuments = [];
for (const packet of index.packets) {
  assert.equal(REQUIRED_PACKETS.get(packet.packet_id), packet.topic, `${packet.packet_id} topic mismatch`);
  assert.equal(packet.decision_status, "pending_human_decision");
  assert.equal(packet.selected_option, null);
  assert.deepEqual(packet.authorized_actions, []);
  assert.ok(packet.required_authorities.length >= 4);
  assert.ok(packet.prohibited_until_receipt.length >= 4);
  assert.match(packet.document, /^docs\/decision-packets\/080-[a-z0-9-]+\.md$/);
  const document = await readFile(packet.document, "utf8");
  assert.match(document, /^# /);
  assert.match(document, /Status: pending human decision/);
  assert.match(document, new RegExp(`Packet ID: \\`${packet.packet_id}\\``));
  for (const heading of REQUIRED_HEADINGS) assert.ok(document.includes(heading), `${packet.packet_id} missing ${heading}`);
  assert.match(document, /No action is authorized by this packet alone\./);
  assert.match(document, /human-decision-receipt\.schema\.json/);
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) assert.doesNotMatch(document, pattern);
  validatedDocuments.push(packet.document);
}

const requiredGlobalActions = [
  "select_or_provision_productive_idp",
  "create_or_use_productive_idp_credentials",
  "ingest_real_corpus",
  "restart_cloud_sql",
  "apply_or_destroy_cloud_sql",
  "mutate_terraform",
  "change_billing",
  "merge_protected_branch",
  "publish_or_release_to_production",
  "claim_production_readiness",
];
assert.deepEqual(index.global_prohibited_actions_without_receipt, requiredGlobalActions);

const schema = await readJson(RECEIPT_SCHEMA_PATH);
assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.type, "object");
assert.equal(schema.additionalProperties, false);
assert.deepEqual(schema.properties.packet_id.enum.sort(), [...REQUIRED_PACKETS.keys()].sort());
assert.deepEqual(schema.properties.decision_status.enum, ["approved", "rejected", "deferred"]);
assert.ok(schema.required.includes("decision_authority_roles"));
assert.ok(schema.required.includes("decision_record_ref"));
assert.ok(schema.required.includes("approved_actions"));
assert.ok(schema.required.includes("scope"));
assert.ok(schema.required.includes("constraints"));
assert.ok(schema.required.includes("evidence_refs"));
exactKeys(schema.properties.scope.properties, ["environment", "bounded_description"], "receipt scope");

console.log(JSON.stringify({
  status: "human_decision_packets_valid",
  packetCount: index.packets.length,
  packetIds: index.packets.map((packet) => packet.packet_id),
  documents: validatedDocuments,
  selectedOptions: 0,
  authorizedActions: 0,
  productionReadinessClaim: false,
}));
