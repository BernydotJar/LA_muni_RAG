import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import http, { type Server } from "node:http";
import { readFile } from "node:fs/promises";
import type { KeywordSearchResult } from "../search.js";
import {
  DEFAULT_DOMAIN_PACK_ID,
  DomainPackConfigError,
  listDomainPacks,
  loadDomainPack,
} from "../domain/registry.js";
import { hrDomainPack } from "../domain/packs/hr.js";
import { buildProcedureWorkflowWithDependencies } from "../procedure/index.js";
import { createApiServer } from "../server.js";

const result = (
  documentTitle: string,
  documentType: string,
  citationLabel: string,
  snippet: string,
  score = 0.08
): KeywordSearchResult => ({
  documentTitle,
  documentType,
  citationLabel,
  pageStart: 1,
  keywordScore: score,
  snippet,
  sourceUrl: null,
});

const getJson = async (server: Server, path: string): Promise<Record<string, unknown>> => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server is not listening");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as Record<string, unknown>);
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
};

describe("domain pack template foundation", () => {
  const servers: Server[] = [];

  after(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  it("loads and validates the required starter domain packs", () => {
    const packs = listDomainPacks();
    const ids = packs.map((pack) => pack.id);

    assert.deepEqual(ids.sort(), ["custom", "finance", "hr", "municipal-antigua", "sales-sop"].sort());
    assert.equal(DEFAULT_DOMAIN_PACK_ID, "municipal-antigua");
    assert.equal(loadDomainPack(undefined).id, "municipal-antigua");
    assert.equal(loadDomainPack("hr").branding.assistantName, "HR Workflow Advisor");
    assert.equal(loadDomainPack("finance").branding.primaryLabel, "Control-first");
    assert.equal(loadDomainPack("sales-sop").branding.primaryLabel, "Playbook-first");
  });

  it("fails closed for an unsupported configured domain pack", () => {
    assert.throws(
      () => loadDomainPack("does-not-exist"),
      (error) => error instanceof DomainPackConfigError && error.code === "invalid_domain_pack"
    );
  });

  it("defines domain-aware document metadata for future ingestion/admin work", async () => {
    const types = await readFile("src/domain/types.ts", "utf-8");

    assert.match(types, /interface DomainDocumentMetadata/);
    assert.match(types, /domainPackId: string/);
    assert.match(types, /sourceAuthorityClass: string/);
    assert.match(types, /confidentiality\?: DomainDocumentConfidentiality/);
  });

  it("exposes safe active domain pack identity through health", async () => {
    const server = createApiServer({
      evidenceDependencies: {},
      domainPack: hrDomainPack,
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port: 0, host: "127.0.0.1" }, () => {
        server.off("error", reject);
        resolve();
      });
    });

    const body = await getJson(server, "/health");
    const domainPack = body.domainPack as Record<string, unknown>;

    assert.equal(domainPack.id, "hr");
    assert.equal(domainPack.name, "HR Procedure Assistant");
    assert.deepEqual(Object.keys(domainPack).sort(), ["branding", "id", "language", "name"].sort());
    assert.doesNotMatch(JSON.stringify(domainPack), /DATABASE_URL|PROCEDURE_FEEDBACK_API_TOKEN|Bearer/i);
  });

  it("exposes safe domain pack UI metadata without runtime secrets", async () => {
    const server = createApiServer({
      evidenceDependencies: {},
      domainPack: hrDomainPack,
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port: 0, host: "127.0.0.1" }, () => {
        server.off("error", reject);
        resolve();
      });
    });

    const body = await getJson(server, "/api/domain-pack");

    assert.equal(body.id, "hr");
    assert.equal(body.name, "HR Procedure Assistant");
    assert.equal(body.defaultQuery, "How do we onboard a new employee?");
    assert.ok(Array.isArray(body.workflowTypes));
    assert.ok(Array.isArray(body.exampleQueries));
    assert.doesNotMatch(JSON.stringify(body), /DATABASE_URL|PROCEDURE_FEEDBACK_API_TOKEN|Bearer|postgres/i);
  });

  it("uses a non-municipal domain pack for neutral workflow classification and templates", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "How do we onboard a new employee?",
      "keyword",
      4,
      {
        keywordSearch: async () => [
          result(
            "Employee Handbook",
            "handbook",
            "Employee Handbook, section 3",
            "The employee handbook describes new hire onboarding, benefits enrollment, and required forms."
          ),
        ],
      },
      hrDomainPack
    );

    assert.equal(workflow.metadata.domainPackId, "hr");
    assert.equal(workflow.procedureType, "employee_onboarding");
    assert.equal(workflow.jurisdiction, "HR");
    assert.ok(workflow.steps.some((step) => step.title === "Confirm hiring trigger"));
    assert.doesNotMatch(workflow.validationWarning, /Antigua|Municipal|Concejo|COCODE/);
    assert.equal(workflow.metadata.hasAntiguaEvidence, false);
    assert.equal(workflow.metadata.hasLocalEvidence, true);
  });
});
