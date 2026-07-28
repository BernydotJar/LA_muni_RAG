import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  createHumanSessionBffDependencies,
  DeterministicHumanIdentityProvider,
  DeterministicTestSecretProtector,
} from "../humanSession/index.js";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-HUMAN-SESSION-BFF-001", () => {
  it("ships a disabled-by-default BFF and rejects incomplete enabled composition", () => {
    const disabled = createHumanSessionBffDependencies();
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.provider, null);
    assert.equal(disabled.publicOrigin, null);
    assert.throws(
      () => createHumanSessionBffDependencies({ enabled: true }),
      /explicitly approved/
    );
  });

  it("keeps deterministic provider and protector out of production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.throws(() => new DeterministicHumanIdentityProvider(), /test-only/);
      assert.throws(
        () => new DeterministicTestSecretProtector({ allowInsecureTestOnly: true }),
        /test-only/
      );
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it("binds login with state, browser cookie, nonce and PKCE while rejecting Bearer", async () => {
    const handler = await read("src/humanSession/handler.ts");
    const adapter = await read("src/humanSession/testAdapter.ts");
    assert.match(handler, /stateSha256: sha256Hex\(state\)/);
    assert.match(handler, /browserBindingSha256: sha256Hex\(browserBinding\)/);
    assert.match(handler, /pkceChallenge\(codeVerifier\)/);
    assert.match(handler, /timingSafeEqual\(actualNonce, expectedNonce\)/);
    assert.match(handler, /Browser session routes do not accept Authorization headers/);
    assert.match(adapter, /pkceChallenge\(request\.codeVerifier\) !== pending\.codeChallenge/);
  });

  it("rotates, revokes and CSRF-protects browser mutations", async () => {
    const handler = await read("src/humanSession/handler.ts");
    assert.match(handler, /HUMAN_SESSION_ROTATE_ROUTE/);
    assert.match(handler, /repository\.rotateSession/);
    assert.match(handler, /repository\.revokeSession/);
    assert.match(handler, /origin !== dependencies\.publicOrigin/);
    assert.match(handler, /x-csrf-token/);
    assert.match(handler, /clearCookie\(dependencies\.sessionCookieName/);
  });

  it("persists only digest/protected state behind forced RLS and fixed-search-path functions", async () => {
    const migration = await read("db/migrations/017_human_session_bff.sql");
    for (const token of [
      "state_sha256",
      "browser_binding_sha256",
      "code_sha256",
      "session_token_sha256",
      "csrf_sha256",
      "issuer_sha256",
      "subject_sha256",
    ]) {
      assert.match(migration, new RegExp(token));
    }
    assert.match(migration, /ALTER TABLE identity\.human_sessions FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /ALTER TABLE identity\.human_subjects FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog/);
    assert.match(migration, /REVOKE ALL ON TABLE[\s\S]*human_login_transactions/);
    assert.doesNotMatch(migration, /access_token|refresh_token|id_token|email_address/i);
  });

  it("derives roles from local memberships and not provider claims", async () => {
    const types = await read("src/humanSession/types.ts");
    const migration = await read("db/migrations/017_human_session_bff.sql");
    assert.match(types, /interface HumanProviderIdentity[\s\S]*issuer: string[\s\S]*subject: string[\s\S]*nonce: string/);
    const providerIdentity = types.slice(
      types.indexOf("export interface HumanProviderIdentity"),
      types.indexOf("export interface HumanIdentityProviderAdapter")
    );
    const declarationsOnly = providerIdentity.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(declarationsOnly, /role|tenant|permission|email|name/i);
    assert.match(migration, /JOIN identity\.memberships AS membership/);
    assert.match(migration, /principal\.principal_kind = 'user'/);
  });

  it("documents explicit productive IdP and browser-readiness limitations", async () => {
    const spec = await read("specs/077-provider-neutral-human-session-bff-v1/spec.md");
    const adr = await read("docs/decisions/077-provider-neutral-human-session-bff-foundation.md");
    const security = await read("docs/security/human-session-bff.md");
    assert.match(spec, /No productive IdP has been selected/);
    assert.match(spec, /No authenticated product shell/);
    assert.match(spec, /not production readiness/i);
    assert.match(adr, /productive provider decision pending/i);
    assert.match(security, /twelve productive authenticated browser journeys remain blocked/i);
  });

  it("keeps all twelve browser journeys blocked rather than substituting the test adapter", async () => {
    const plan = JSON.parse(await read("contracts/staging/v1/ephemeral-staging-plan.json")) as {
      journeys: Array<{ layer: string; status: string }>;
    };
    const browser = plan.journeys.filter((journey) => journey.layer === "browser");
    assert.equal(browser.length, 12);
    assert.ok(browser.every((journey) => journey.status === "blocked"));
  });

  it("provides focused, migration, SQL runtime, compiled smoke and independent review evidence", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    assert.match(packageJson.scripts["test:human-session-bff"] ?? "", /human-session-bff-v1/);
    assert.match(packageJson.scripts["test:human-session-bff"] ?? "", /human-session-bff-migration/);
    assert.match(packageJson.scripts["smoke:human-session-bff"] ?? "", /human-session-bff-postgres-smoke/);
    assert.match(await read("db/tests/human_session_bff_runtime_gate.sql"), /NOBYPASSRLS/);
    assert.match(await read("docs/reviews/077-human-session-bff-independent-review.md"), /Critic \/ Red Team/);
  });
});
