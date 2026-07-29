import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LocalImmutableArtifactReader } from "../ingestion/localImmutableArtifactReader.js";
import { readBoundedImmutableObject, type ArtifactObjectReference } from "../ingestion/artifactObjectStore.js";

const digest = (content: Buffer): string => createHash("sha256").update(content).digest("hex");
const reference: ArtifactObjectReference = {
  storeName: "local_eval_store",
  objectNamespace: "controlled-antigua-corpus",
  objectKey: "source/hash.pdf",
  objectVersion: `sha256:${"a".repeat(64)}`,
};

test("local immutable artifact reader", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "local-artifact-reader-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const filePath = join(root, "artifact.pdf");
  const content = Buffer.from("%PDF-1.4\ncontrolled\n%%EOF", "ascii");
  await writeFile(filePath, content);

  await t.test("returns only the exact allowlisted immutable bytes", async () => {
    const reader = new LocalImmutableArtifactReader(root, [{
      reference,
      filePath,
      expectedSha256: digest(content),
      expectedByteLength: content.byteLength,
    }]);
    const resolved = await readBoundedImmutableObject(reader, reference, { maxBytes: 1024, timeoutMs: 2_000 });
    assert.deepEqual(resolved, content);
  });

  await t.test("rejects unknown references and changed bytes", async () => {
    const reader = new LocalImmutableArtifactReader(root, [{
      reference,
      filePath,
      expectedSha256: "b".repeat(64),
      expectedByteLength: content.byteLength,
    }]);
    await assert.rejects(readBoundedImmutableObject(reader, reference, { maxBytes: 1024, timeoutMs: 2_000 }), /digest/i);
    await assert.rejects(readBoundedImmutableObject(reader, { ...reference, objectKey: "other.pdf" }, { maxBytes: 1024, timeoutMs: 2_000 }), /allowlisted/i);
  });

  await t.test("rejects a symlink that escapes the configured root", async () => {
    const outside = join(tmpdir(), `outside-artifact-${process.pid}.pdf`);
    const link = join(root, "escape.pdf");
    await writeFile(outside, content);
    await symlink(outside, link);
    t.after(async () => rm(outside, { force: true }));
    const reader = new LocalImmutableArtifactReader(root, [{
      reference,
      filePath: link,
      expectedSha256: digest(content),
      expectedByteLength: content.byteLength,
    }]);
    await assert.rejects(readBoundedImmutableObject(reader, reference, { maxBytes: 1024, timeoutMs: 2_000 }), /escaped/i);
  });
});
