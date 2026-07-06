import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("security review and Pages hardening", () => {
  it("sanitizes configured API URLs in the Pages demo bridge", async () => {
    const bridge = await readSource("public/pages-demo-api.js");

    assert.match(bridge, /const sanitizeApiBaseUrl/);
    assert.match(bridge, /parsed\.protocol !== "https:" && parsed\.protocol !== "http:"/);
    assert.match(bridge, /parsed\.protocol === "http:" && !isLocalhost/);
    assert.match(bridge, /parsed\.username = ""/);
    assert.match(bridge, /parsed\.password = ""/);
    assert.match(bridge, /parsed\.hash = ""/);
    assert.match(bridge, /parsed\.search = ""/);
  });

  it("does not forward credentials or follow redirects through the Pages bridge", async () => {
    const bridge = await readSource("public/pages-demo-api.js");

    assert.match(bridge, /const safeProxyInit/);
    assert.match(bridge, /credentials: "omit"/);
    assert.match(bridge, /redirect: "error"/);
    assert.match(bridge, /nativeFetch\(targetUrl, safeProxyInit\(init\)\)/);
  });

  it("adds a Pages source-link security guard", async () => {
    const guard = await readSource("public/pages-security-guard.js");

    assert.match(guard, /isSafeHttpHref/);
    assert.match(guard, /parsed\.protocol === "https:" \|\| parsed\.protocol === "http:"/);
    assert.match(guard, /removeAttribute\("href"\)/);
    assert.match(guard, /rel", "noopener noreferrer"/);
    assert.match(guard, /target", "_blank"/);
  });

  it("requires the security guard in the Pages artifact", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /pages-security-guard\.js/);
    assert.match(verifyScript, /pages-security-guard\.js/);
    assert.match(verifyScript, /missing the source-link security guard/);
  });

  it("documents findings and residual security risks", async () => {
    const review = await readSource("docs/security-review.md");
    const requirements = await readSource("specs/035-security-review-and-pages-hardening/requirements.md");
    const design = await readSource("specs/035-security-review-and-pages-hardening/design.md");

    assert.match(review, /This review does not claim to be a penetration test/);
    assert.match(review, /A future public API still needs rate limiting/);
    assert.match(requirements, /No penetration test claim/);
    assert.match(design, /Residual Risk/);
  });
});
