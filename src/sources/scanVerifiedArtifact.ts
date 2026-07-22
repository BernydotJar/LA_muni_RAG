import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import {
  ArtifactSafetyError,
  type MalwareScanner,
  type MalwareScanResult,
} from "./artifactSafety.js";

const sha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

/**
 * Give the scanner a mode-0600 snapshot and prove it did not change the bytes.
 * The original object coordinate and provider credentials never cross this
 * boundary, and the snapshot is removed regardless of scanner outcome.
 */
export const scanVerifiedArtifactSnapshot = async (
  content: Buffer,
  originalFilename: string,
  scanner: MalwareScanner
): Promise<MalwareScanResult> => {
  const directory = await mkdtemp(join(tmpdir(), "la-muni-artifact-scan-"));
  try {
    await chmod(directory, 0o700);
    const extension = extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const snapshotPath = join(directory, `artifact${extension}`);
    await writeFile(snapshotPath, content, { flag: "wx", mode: 0o600 });
    const expectedHash = sha256(content);
    const before = await readFile(snapshotPath);
    if (before.byteLength !== content.byteLength || sha256(before) !== expectedHash) {
      throw new ArtifactSafetyError(
        "artifact_scan_snapshot_mismatch",
        "Private malware-scan snapshot does not match the verified artifact bytes."
      );
    }
    const result = await scanner.scan(snapshotPath);
    const after = await readFile(snapshotPath);
    if (after.byteLength !== content.byteLength || sha256(after) !== expectedHash) {
      throw new ArtifactSafetyError(
        "artifact_scan_snapshot_changed",
        "Private malware-scan snapshot changed during inspection."
      );
    }
    return result;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
