import type { DomainPack } from "../../domain/registry.js";
import { loadActiveDomainPack } from "../../domain/registry.js";
import { buildProcedureWorkflowWithDependencies } from "../../procedure/index.js";
import { createTenantScopedSearches, type ScopedSearchResult } from "../../search.js";
import { bindScopedEvidenceRecord } from "./evidenceIdentity.js";
import type { ProcedureWorkflowCompiler } from "./types.js";

/**
 * v1 intentionally supports only transaction-client keyword/phrase retrieval.
 * Deep dives use the existing hybrid ranker with those two candidate sources;
 * no vector repository or global database pool is supplied.
 */
export const createDefaultProcedureWorkflowCompiler = (
  domainPack: DomainPack = loadActiveDomainPack()
): ProcedureWorkflowCompiler =>
  async (request, client) => {
    const evidenceRecords: ScopedSearchResult[] = [];
    const searches = createTenantScopedSearches(client, request.tenant_id, (records) => {
      evidenceRecords.push(...records);
    });
    // node-postgres clients represent one transaction-bound connection and do
    // not support concurrent query execution. The legacy retriever fans out
    // with Promise.all, so serialize only this v1 client's database closures.
    let searchTail: Promise<void> = Promise.resolve();
    const onTransactionClient = <T>(operation: () => Promise<T>): Promise<T> => {
      const result = searchTail.then(operation);
      searchTail = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    };
    const mode = request.requested_depth === "deep_dive" ? "hybrid" : "keyword";
    const workflow = await buildProcedureWorkflowWithDependencies(
      request.question,
      mode,
      8,
      {
        keywordSearch: async (query, limit) =>
          (
            await onTransactionClient(() => searches.keywordSearch(query, limit))
          ).map(bindScopedEvidenceRecord),
        phraseSearch: async (query, limit) =>
          (
            await onTransactionClient(() => searches.phraseSearch(query, limit))
          ).map(bindScopedEvidenceRecord),
      },
      domainPack,
      request.requested_depth
    );
    return { workflow, evidenceRecords };
  };
