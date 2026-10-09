import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it } from "node:test";

const fixtureUrl = "https://muniantigua.gob.gt/documento.pdf";
const textPage = (text: string, index: number) => ({
  sourceId: "adversarial-test", sourceUrl: fixtureUrl, title: "Documento de prueba",
  pageStart: index + 1, pageEnd: index + 1, text,
});

function loadStaticFallback() {
  const snapshot = {
    schemaVersion: 1, corpusKind: "public_official_municipal_static_projection_v1",
    sources: [{}, {}, {}],
    sections: Array.from({ length: 251 }, (_, index) => textPage("El aguacate es nutritivo.", index)),
  };
  const calls: string[] = [];
  const window = {
    location: { origin: "https://example.org", href: "https://example.org/index.html" },
    fetch: async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify(snapshot), {
        status: 200, headers: { "content-type": "application/json" },
      });
    },
  };
  vm.runInNewContext(readFileSync("public/public-corpus-fallback.js", "utf8"), {
    window, document: { currentScript: { src: "https://example.org/public-corpus-fallback.js" } },
    URL, Response, Date, Math,
  });
  const fallback = (window as typeof window & {
    __LA_MUNI_PUBLIC_FALLBACK__: {
      handle: (input: { targetPath: string; requestUrl: URL; method: string; body: string }) => Promise<Response>,
    },
  }).__LA_MUNI_PUBLIC_FALLBACK__;
  const ask = async (body: unknown) => {
    const response = await fallback.handle({
      targetPath: "/api/public/v1/query", requestUrl: new URL("https://example.org/api/public/v1/query"),
      method: "POST", body: JSON.stringify(body),
    });
    return { status: response.status, payload: await response.json() as { citations?: unknown[]; error?: {code: string} } };
  };
  return { ask, calls };
}

function loadBridge() {
  const calls: string[] = [];
  const window = {
    location: { origin: "https://example.org" },
    fetch: async (input: string, _init?: RequestInit) => {
      calls.push(input);
      return new Response(JSON.stringify({ nativeUrl: input }), { status: 200, headers: { "content-type": "application/json" } });
    },
  };
  const document = {
    currentScript: {
      getAttribute: (name: string) => name === "data-api-url" ? "https://api.example.org/" : "",
    },
  };
  vm.runInNewContext(readFileSync("public/pages-api-bridge.js", "utf8"), { window, document, URL, Response });
  return { window, calls };
}

describe("adversarial public query boundary", () => {
  it("does not claim a match for agua when documents only contain aguacate", async () => {
    const { ask } = loadStaticFallback();
    for (const mode of ["keyword", "phrase"]) {
      const result = await ask({ message: "agua", mode, limit: 5 });
      assert.equal(result.status, 200);
      assert.equal(result.payload.citations?.length, 0, mode);
    }
  });

  it("retains actual whole-word retrieval", async () => {
    const { ask } = loadStaticFallback();
    const result = await ask({ message: "aguacate", mode: "keyword", limit: 5 });
    assert.equal(result.status, 200);
    assert.ok((result.payload.citations?.length ?? 0) > 0);
  });

  it("rejects object-valued queries, coerced numeric limits and oversized queries", async () => {
    const { ask } = loadStaticFallback();
    const invalid = [
      { message: { text: "agua" }, mode: "keyword", limit: 5 },
      { message: "agua", mode: "keyword", limit: "5" },
      { message: "a".repeat(801), mode: "keyword", limit: 5 },
    ];
    for (const body of invalid) {
      const response = await ask(body);
      assert.equal(response.status, 400, JSON.stringify(body).slice(0, 100));
      assert.equal(response.payload.error?.code, "invalid_request");
    }
  });

  it("does not intercept external hosts with colliding API paths", async () => {
    const { window, calls } = loadBridge();
    const foreign = "https://unrelated.example.net/api/public/v1/query";
    const response = await window.fetch(foreign, { method: "POST", body: "{}" });
    assert.equal(response.status, 200);
    assert.equal(calls[0], foreign);
  });

  it("still proxies approved same-origin API calls to the configured backend", async () => {
    const { window, calls } = loadBridge();
    await window.fetch("/api/public/v1/query", { method: "POST", body: "{}" });
    assert.equal(calls[0], "https://api.example.org/api/public/v1/query");
  });
});
