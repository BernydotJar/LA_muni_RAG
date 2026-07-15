import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DomainBootstrapError,
  initializeDomainPack,
  parseDomainInitArgs,
  renderDomainPackScaffold,
  runStarterEvaluation,
  validateDomainPackScaffold,
} from "../domain/bootstrap.js";

const expectCode = async (action: () => unknown | Promise<unknown>, code: string) => {
  await assert.rejects(action, (error: unknown) => error instanceof DomainBootstrapError && error.code === code);
};

test("domain pack bootstrap parses supported flags and defaults language", () => {
  assert.deepEqual(parseDomainInitArgs(["--id", "legal", "--name", "Legal Assistant"]), {
    id: "legal",
    name: "Legal Assistant",
    language: "en",
    dryRun: false,
  });
  assert.equal(parseDomainInitArgs(["--id", "legal", "--name", "Legal Assistant", "--language", "es", "--dry-run"]).dryRun, true);
});

test("domain pack bootstrap rejects unsafe, reserved, duplicate, and unsupported arguments", async () => {
  await expectCode(() => parseDomainInitArgs(["--id", "../legal", "--name", "Legal"]), "invalid_id");
  await expectCode(() => parseDomainInitArgs(["--id", "municipal-antigua", "--name", "Legal"]), "reserved_id");
  await expectCode(() => parseDomainInitArgs(["--id", "legal", "--id", "other", "--name", "Legal"]), "invalid_arguments");
  await expectCode(() => parseDomainInitArgs(["--output", "/tmp", "--id", "legal", "--name", "Legal"]), "invalid_arguments");
});

test("domain pack bootstrap renders deterministic draft-only content", () => {
  const options = { id: "legal", name: "Legal Procedure Assistant", language: "es", dryRun: true };
  const first = renderDomainPackScaffold(options);
  const second = renderDomainPackScaffold(options);
  assert.deepEqual(first, second);
  assert.equal(first.manifest.status, "draft");
  assert.equal(first.manifest.authoritative, false);
  assert.deepEqual(first.templates.templates, []);
  assert.deepEqual(first.files.map((file) => file.path), ["README.md", "domain-pack.json", "starter.test.ts", "workflow-templates.json"]);
  validateDomainPackScaffold(first);
  const text = first.files.map((file) => file.content).join("\n").toLowerCase();
  assert.match(text, /draft/);
  assert.match(text, /placeholder/);
  assert.doesNotMatch(text, /statute|deadline|approver|responsible ministry/);
});

test("domain pack bootstrap starter evaluation passes without registering a pack", () => {
  const scaffold = renderDomainPackScaffold({ id: "legal", name: "Legal Procedure Assistant", language: "es", dryRun: true });
  const result = runStarterEvaluation(scaffold);
  assert.equal(result.summary.totalCases, 1);
  assert.equal(result.summary.passedCases, 1);
  assert.equal(result.summary.failedCases, 0);
});

test("domain pack bootstrap dry-run performs no writes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "domain-bootstrap-dry-"));
  try {
    const result = await initializeDomainPack(
      { id: "legal", name: "Legal Procedure Assistant", language: "es", dryRun: true },
      { workspaceRoot: root }
    );
    assert.equal(result.status, "dry_run");
    await assert.rejects(stat(path.join(root, "domain-packs")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("domain pack bootstrap clean-room initialization validates files and refuses overwrite", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "domain-bootstrap-create-"));
  try {
    const options = { id: "legal", name: "Legal Procedure Assistant", language: "es", dryRun: false };
    const result = await initializeDomainPack(options, { workspaceRoot: root });
    assert.equal(result.status, "created");
    assert.equal(result.target, "domain-packs/legal");
    assert.equal(result.fileCount, 4);

    const manifest = JSON.parse(await readFile(path.join(root, "domain-packs/legal/domain-pack.json"), "utf8"));
    const templates = JSON.parse(await readFile(path.join(root, "domain-packs/legal/workflow-templates.json"), "utf8"));
    assert.equal(manifest.status, "draft");
    assert.equal(manifest.authoritative, false);
    assert.deepEqual(templates.templates, []);

    await expectCode(() => initializeDomainPack(options, { workspaceRoot: root }), "target_exists");
    assert.equal(JSON.parse(await readFile(path.join(root, "domain-packs/legal/domain-pack.json"), "utf8")).name, "Legal Procedure Assistant");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
