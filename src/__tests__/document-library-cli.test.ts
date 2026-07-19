import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDocumentLibraryArgs, usage } from "../cli/documentLibrary.js";

describe("document library CLI", () => {
  it("parses the explicit inspection and quarantine roots", () => {
    const parsed = parseDocumentLibraryArgs([
      "inspect",
      "--inventory", ".rag/source-inventory.json",
      "--source-id", "antigua-mnp-dmp-v3-2026",
      "--library-root", ".rag/library",
      "--quarantine-root", ".rag/quarantine",
      "--dry-run",
    ]);

    assert.equal(parsed.command, "inspect");
    assert.equal(parsed.inventoryPath, ".rag/source-inventory.json");
    assert.equal(parsed.libraryRoot, ".rag/library");
    assert.equal(parsed.quarantineRoot, ".rag/quarantine");
    assert.equal(parsed.dryRun, true);
  });

  it("documents required MIME declaration and the scanner gate", () => {
    assert.match(usage, /--media-type TYPE/);
    assert.match(usage, /--quarantine-root/);
    assert.match(usage, /scanner evidence is clean, matching, and current/i);
  });

  it("rejects unknown commands and flags", () => {
    assert.throws(() => parseDocumentLibraryArgs(["scan"]), /Unsupported document library command/);
    assert.throws(() => parseDocumentLibraryArgs(["inspect", "--shell-command", "rm"]), /Unknown argument/);
  });
});
