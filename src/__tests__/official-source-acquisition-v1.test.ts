import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { MalwareScanner } from "../sources/artifactSafety.js";
import { acquireSourcePackHtml } from "../sources/htmlAcquisition.js";
import {
  isPublicNetworkAddress,
  parseHtmlAcquisitionPlan,
  type HtmlAcquisitionPlan,
} from "../sources/htmlAcquisitionPolicy.js";
import type { SourceInventoryManifestFile } from "../sources/sourceInventoryManifest.js";
import type { SourceInventoryRecord } from "../sources/sourceInventory.js";
import type { SourcePackManifest } from "../sources/sourcePack.js";

const cleanScanner: MalwareScanner = {
  scan: async () => ({ verdict: "clean", engine: "clamav", engineVersion: "1.4.3", definitionsVersion: "27654/20260801" }),
};

const source = (id: string, url = `https://official.example/${id}`): SourceInventoryRecord => ({
  sourceId: id,
  documentKey: id,
  documentVersion: "verified-2026-08-01",
  title: `Official ${id}`,
  category: "public_portal",
  status: "verified",
  targetJurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  sourceJurisdiction: "República de Guatemala",
  authorityClass: "official_national",
  authorityLevel: "national",
  officialSource: true,
  officialForTargetJurisdiction: true,
  publicUrl: url,
  verifiedAt: "2026-08-01T00:00:00Z",
  limitations: ["Discovery record only."],
  provenanceNotes: ["Official endpoint."],
  tags: ["verified", "acquisition-pending"],
});

const fixture = (ids: string[]): { plan: HtmlAcquisitionPlan; pack: SourcePackManifest; inventory: SourceInventoryManifestFile } => ({
  plan: parseHtmlAcquisitionPlan({
    schemaVersion: 1,
    acquisitionId: "test-official-html",
    sourcePackId: "test-national-pack",
    snapshotDate: "2026-08-01",
    maxArtifactBytes: 4096,
    requestTimeoutMs: 5000,
    maxRedirects: 1,
    minimumExtractedCharacters: 20,
    minimumSectionCount: 1,
    minimumSuccessfulSources: ids.length,
    sourceIds: ids,
  }),
  pack: {
    schemaVersion: 1,
    packId: "test-national-pack",
    displayName: "Test National Pack",
    organizationType: "government_agency",
    isTemplate: false,
    jurisdiction: "República de Guatemala",
    allowedHosts: ["official.example"],
    requiredCoverageTags: ["official"],
    connectors: [{
      connectorId: "official-pages",
      type: "html_page",
      title: "Official pages",
      discoveryUrl: "https://official.example/",
      allowedHosts: ["official.example"],
      sourceInventoryIds: ids,
      coverageTags: ["official"],
      acceptedMediaTypes: ["text/html"],
      refresh: { cadence: "monthly", maximumAgeDays: 45 },
      enabled: true,
    }],
  },
  inventory: {
    schemaVersion: 1,
    targetJurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
    generatedAt: "2026-08-01T00:00:00Z",
    records: ids.map((id) => source(id)),
  },
});

const publicDns = async (): Promise<string[]> => ["8.8.8.8"];
const html = (title: string, text: string): string =>
  `<!doctype html><html><head><title>${title}</title><script>steal()</script></head><body><h1>${title}</h1><p>${text}</p></body></html>`;

const withRoot = async <T>(run: (root: string) => Promise<T>): Promise<T> => {
  const root = await mkdtemp(join(tmpdir(), "la-muni-acquisition-test-"));
  try { return await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
};

describe("official HTML acquisition policy", () => {
  it("parses a bounded plan and rejects duplicate sources", () => {
    assert.equal(fixture(["one"]).plan.minimumSuccessfulSources, 1);
    assert.throws(() => parseHtmlAcquisitionPlan({
      ...fixture(["one"]).plan,
      sourceIds: ["one", "one"],
      minimumSuccessfulSources: 1,
    }), /unique/);
    assert.throws(() => parseHtmlAcquisitionPlan({
      ...fixture(["one"]).plan,
      snapshotDate: "2026-02-30",
    }), /calendar date/);
  });

  it("rejects private, loopback, documentation, link-local and multicast addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.1.1", "192.0.2.1", "203.0.113.1", "::1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1"]) {
      assert.equal(isPublicNetworkAddress(address), false, address);
    }
    assert.equal(isPublicNetworkAddress("8.8.8.8"), true);
    assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true);
  });
});

describe("governed official HTML acquisition", () => {
  it("stores exact UTF-8 and Windows-1252 bytes, strips executable content and advances only to ingestion_pending", async () => withRoot(async (root) => {
    const data = fixture(["utf8-page", "latin-page"]);
    const latinText = "Información pública de gestión, requisitos, evaluación y certificación municipal.";
    const latin = Buffer.from(html("Guía oficial", latinText), "latin1");
    const fetchImpl: typeof fetch = async (request) => {
      const url = String(request);
      if (url.endsWith("latin-page")) return new Response(latin, { status: 200, headers: { "content-type": "text/html; charset=ISO-8859-1" } });
      return new Response(html("Normas oficiales", "Contenido público suficiente para extracción y cita verificable."), { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });
    };
    const result = await acquireSourcePackHtml({
      ...data,
      libraryRoot: root,
      dependencies: { scanner: cleanScanner, fetchImpl, resolveHost: publicDns, now: () => new Date("2026-08-01T05:00:00Z") },
    });
    assert.equal(result.receipt.result, "pass");
    assert.equal(result.receipt.successful, 2);
    assert.equal(result.receipt.sources.find((item) => item.sourceId === "latin-page")?.charset, "windows-1252");
    for (const record of result.inventory.records) {
      assert.equal(record.status, "ingestion_pending");
      assert.equal(record.indexing, undefined);
      assert.equal(record.artifactSafety?.verdict, "clean");
      assert.equal(record.extraction?.extractor, "html_heading_v1");
      const receipt = result.receipt.sources.find((item) => item.sourceId === record.sourceId)!;
      const raw = await readFile(join(root, receipt.artifactPath!.replace(".rag/library/", "")));
      assert.equal(raw.length, receipt.byteLength);
      const extraction = JSON.parse(await readFile(join(root, receipt.extractionPath!.replace(".rag/library/", "")), "utf8")) as { document: { text: string } };
      assert.doesNotMatch(extraction.document.text, /steal/);
      assert.equal((await stat(join(root, receipt.artifactPath!.replace(".rag/library/", "")))).mode & 0o777, 0o600);
    }
    const latinReceipt = result.receipt.sources.find((item) => item.sourceId === "latin-page")!;
    assert.deepEqual(await readFile(join(root, latinReceipt.artifactPath!.replace(".rag/library/", ""))), latin);
  }));

  it("blocks private DNS before fetch and leaves the inventory verified", async () => withRoot(async (root) => {
    const data = fixture(["private-page"]);
    let fetched = false;
    const result = await acquireSourcePackHtml({
      ...data,
      libraryRoot: root,
      dependencies: {
        scanner: cleanScanner,
        fetchImpl: async () => { fetched = true; return new Response(html("x", "enough text for extraction")); },
        resolveHost: async () => ["127.0.0.1"],
      },
    });
    assert.equal(fetched, false);
    assert.equal(result.receipt.sources[0]?.failureCode, "source_dns_private_address");
    assert.equal(result.receipt.sources[0]?.inventoryStatusBefore, "verified");
    assert.equal(result.receipt.sources[0]?.inventoryStatusAfter, "verified");
    assert.equal(result.inventory.records[0]?.status, "verified");
  }));

  it("blocks cross-host redirects, oversized bodies, bad media, malware and insufficient extraction without promoting records", async () => {
    const cases: Array<{ code: string; response: Response; scanner?: MalwareScanner }> = [
      { code: "source_redirect_rejected", response: new Response(null, { status: 302, headers: { location: "https://evil.example/page" } }) },
      { code: "source_body_too_large", response: new Response("x", { status: 200, headers: { "content-type": "text/html", "content-length": "999999" } }) },
      { code: "source_media_type_rejected", response: new Response("{}", { status: 200, headers: { "content-type": "application/json" } }) },
      { code: "source_malware_detected", response: new Response(html("Official", "enough official text for extraction"), { status: 200, headers: { "content-type": "text/html" } }), scanner: { scan: async () => ({ verdict: "infected", engine: "clamav", engineVersion: "1", definitionsVersion: "2", signature: "Eicar" }) } },
      { code: "source_extraction_insufficient", response: new Response("<html><body>x</body></html>", { status: 200, headers: { "content-type": "text/html" } }) },
    ];
    for (const item of cases) {
      await withRoot(async (root) => {
        const data = fixture(["blocked-page"]);
        if (item.code === "source_extraction_insufficient") data.plan.minimumExtractedCharacters = 500;
        const result = await acquireSourcePackHtml({
          ...data,
          libraryRoot: root,
          dependencies: { scanner: item.scanner ?? cleanScanner, fetchImpl: async () => item.response.clone(), resolveHost: publicDns },
        });
        assert.equal(result.receipt.sources[0]?.failureCode, item.code, item.code);
        assert.equal(result.inventory.records[0]?.status, "verified", item.code);
        assert.equal(result.inventory.records[0]?.acquisition, undefined, item.code);
      });
    }
  });

  it("rejects ineligible lifecycle states before network access", async () => withRoot(async (root) => {
    const data = fixture(["already-ingested"]);
    data.inventory.records[0]!.status = "ingested";
    let fetched = false;
    await assert.rejects(acquireSourcePackHtml({
      ...data,
      libraryRoot: root,
      dependencies: { scanner: cleanScanner, fetchImpl: async () => { fetched = true; return new Response(html("x", "enough text")); }, resolveHost: publicDns },
    }), /not eligible/);
    assert.equal(fetched, false);
  }));

  it("blocks a symlinked library component without writing outside the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "la-muni-acquisition-root-"));
    const outside = await mkdtemp(join(tmpdir(), "la-muni-acquisition-outside-"));
    try {
      await symlink(outside, join(root, "official"));
      const data = fixture(["symlink-page"]);
      const result = await acquireSourcePackHtml({
        ...data,
        libraryRoot: root,
        dependencies: { scanner: cleanScanner, fetchImpl: async () => new Response(html("Official", "enough official text for extraction"), { headers: { "content-type": "text/html" } }), resolveHost: publicDns },
      });
      assert.equal(result.receipt.sources[0]?.failureCode, "source_storage_conflict");
      assert.deepEqual(await import("node:fs/promises").then(({ readdir }) => readdir(outside)), []);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects a plan source that is not bound to an enabled HTML connector", async () => withRoot(async (root) => {
    const data = fixture(["unbound-page"]);
    data.pack.connectors[0]!.enabled = false;
    await assert.rejects(acquireSourcePackHtml({
      ...data,
      libraryRoot: root,
      dependencies: { scanner: cleanScanner, fetchImpl: async () => new Response(html("x", "enough text")), resolveHost: publicDns },
    }), /exactly one enabled HTML connector/);
  }));
});
