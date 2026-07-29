import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const project = JSON.parse(readFileSync("program/graph-harness/project.json", "utf8"));
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const verifier = readFileSync("scripts/verify-graph-harness-runtime.sh", "utf8");
const readme = readFileSync("program/graph-harness/README.md", "utf8");

const frameworkCommit = "1bebce3db35303072049233786464bb01163c98b";
const runtimeCommit = "fef364bc66849b98c08d3c1dcb91caf9701027cd";

test("EVAL-GRAPH-HARNESS-RUNTIME-PIN-001", async (t) => {
  await t.test("pins the published framework merge and executable runtime commits", () => {
    const node = project.nodes.find((candidate: { id?: string }) => candidate.id === "PRG-GRAPH-HARNESS-PIN-002");
    assert.equal(node?.metadata?.framework_commit, frameworkCommit);
    assert.equal(node?.metadata?.runtime_commit, runtimeCommit);
    assert.match(verifier, new RegExp(frameworkCommit));
    assert.match(verifier, new RegExp(runtimeCommit));
  });

  await t.test("executes the immutable runtime verification in backend CI", () => {
    assert.match(workflow, /Verify immutable Graph Harness runtime/);
    assert.match(workflow, /npm run graph-harness:verify/);
    assert.match(workflow, /Run EVAL-GRAPH-HARNESS-RUNTIME-PIN-001/);
  });

  await t.test("does not copy framework runtime source into the application", () => {
    assert.equal(existsSync("graph_harness"), false);
    assert.match(verifier, /application must not copy framework runtime source/);
    assert.match(readme, /immutable published pin/i);
  });
});
