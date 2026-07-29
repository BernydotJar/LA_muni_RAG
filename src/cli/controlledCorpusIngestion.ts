import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import pg from "pg";
import { LocalEvaluationEmbeddingProvider } from "../embeddings/localEvaluationEmbeddingProvider.js";
import { PostgresArtifactAcceptanceRepository } from "../ingestion/artifactAcceptance.js";
import { JsonFileCorpusManifestStore, type CorpusManifestRecord } from "../ingestion/corpusManifest.js";
import { extractByPath } from "../ingestion/registry.js";
import { PostgresIngestionJobService } from "../ingestion/ingestionJobService.js";
import { LocalImmutableArtifactReader, type LocalImmutableArtifactBinding } from "../ingestion/localImmutableArtifactReader.js";
import { PersistedAcceptedArtifactResolver } from "../ingestion/persistedAcceptedArtifactResolver.js";
import { TenantIngestionWorker } from "../ingestion/ingestionWorker.js";
import { withTenantTransaction } from "../security/index.js";
import {
  createClamAvScannerFromEnv,
  inspectArtifactContent,
  loadArtifactSafetyPolicy,
} from "../sources/artifactSafety.js";
import { scanVerifiedArtifactSnapshot } from "../sources/scanVerifiedArtifact.js";
import {
  reconcileSourceInventoryWithCorpusManifest,
  type SourceInventoryManifestFile,
} from "../sources/sourceInventoryManifest.js";
import { validateSourceInventory, type SourceInventoryRecord } from "../sources/sourceInventory.js";

const { Pool } = pg;
const SAFE_ROLE = /^[a-z][a-z0-9_]{0,62}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;

interface ControlledSource {
  sourceId: string;
  documentId: string;
  documentVersionId: string;
  documentKey: string;
  documentVersion: string;
  title: string;
  relativePath: string;
  originalFilename: string;
  expectedSha256: string;
  expectedByteLength: number;
}
interface ControlledConfig {
  schemaVersion: 1;
  tenantId: string;
  principalId: string;
  sources: ControlledSource[];
}
interface AcceptedIds { artifactObjectId: string; artifactScanId: string; }
interface ReceiptSource {
  sourceId: string;
  documentKey: string;
  documentVersion: string;
  documentVersionId: string;
  contentSha256: string;
  byteLength: number;
  structuralSignature: string;
  scanner: { engine: string; version: string; definitionsVersion: string; inspectedAt: string };
  acceptance: AcceptedIds;
  jobId: string;
  ingestionStatus: "ingested" | "blocked_no_text";
  sectionCount: number;
  chunkCount: number;
  indexedAt: string | null;
  failureCode: string | null;
}

const argValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const sha256 = (content: Buffer): string => createHash("sha256").update(content).digest("hex");
const isoNow = (): string => new Date().toISOString();
const atomicJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
};
const parseConfig = (value: unknown): ControlledConfig => {
  if (!value || typeof value !== "object" || (value as ControlledConfig).schemaVersion !== 1) {
    throw new Error("Controlled corpus config is invalid.");
  }
  const config = value as ControlledConfig;
  if (!UUID.test(config.tenantId) || !UUID.test(config.principalId) || !Array.isArray(config.sources) || config.sources.length !== 2) {
    throw new Error("Controlled corpus config must declare one tenant, one principal and exactly two sources.");
  }
  const ids = new Set<string>();
  for (const source of config.sources) {
    if (
      !source || typeof source !== "object" || ids.has(source.sourceId) ||
      !UUID.test(source.documentId) || !UUID.test(source.documentVersionId) ||
      !SHA256.test(source.expectedSha256) || !Number.isSafeInteger(source.expectedByteLength) ||
      source.expectedByteLength < 1 || source.expectedByteLength > 100 * 1024 * 1024 ||
      !source.sourceId || !source.documentKey || !source.documentVersion || !source.title ||
      !source.relativePath || isAbsolute(source.relativePath) || !source.originalFilename.endsWith(".pdf")
    ) throw new Error("Controlled corpus source configuration is invalid.");
    ids.add(source.sourceId);
  }
  return config;
};

const findCurrentAcceptance = async (
  pool: InstanceType<typeof Pool>,
  tenantId: string,
  source: ControlledSource,
  object: LocalImmutableArtifactBinding["reference"]
): Promise<AcceptedIds | null> => withTenantTransaction(pool, tenantId, async (client) => {
  const result = await client.query(
    `SELECT id::text AS artifact_object_id, accepted_scan_id::text AS artifact_scan_id
       FROM rag.artifact_objects
      WHERE tenant_id = $1::uuid AND document_version_id = $2::uuid
        AND store_name = $3 AND object_namespace = $4 AND object_key = $5 AND object_version = $6
        AND expected_sha256 = decode($7, 'hex') AND status = 'accepted'
        AND accepted_scan_id IS NOT NULL AND accepted_until > statement_timestamp()
      LIMIT 1`,
    [tenantId, source.documentVersionId, object.storeName, object.objectNamespace, object.objectKey, object.objectVersion, source.expectedSha256]
  ) as { rows: Array<{ artifact_object_id: string; artifact_scan_id: string }> };
  return result.rows.length === 1 ? {
    artifactObjectId: String(result.rows[0].artifact_object_id),
    artifactScanId: String(result.rows[0].artifact_scan_id),
  } : null;
});

const main = async (): Promise<void> => {
  const configPath = argValue("--config") ?? "evals/real-corpus/controlled-ingestion-config.json";
  const inventoryPath = process.env.CONTROLLED_CORPUS_SOURCE_INVENTORY ?? ".rag/source-inventory.json";
  const operationalManifestPath = process.env.CONTROLLED_CORPUS_MANIFEST_PATH ?? ".rag/corpus-manifest.json";
  const evidenceManifestPath = process.env.CONTROLLED_CORPUS_EVIDENCE_MANIFEST_PATH ?? "evals/real-corpus/controlled-corpus-manifest.json";
  const receiptPath = process.env.CONTROLLED_CORPUS_RECEIPT_PATH ?? "evals/real-corpus/results/controlled-ingestion-receipt.json";
  const libraryRoot = requiredEnv("CONTROLLED_CORPUS_LIBRARY_ROOT");
  const acceptanceDatabaseUrl = requiredEnv("CONTROLLED_CORPUS_ACCEPTANCE_DATABASE_URL");
  const runtimeDatabaseUrl = requiredEnv("CONTROLLED_CORPUS_RUNTIME_DATABASE_URL");
  const runtimeRole = requiredEnv("CONTROLLED_CORPUS_RUNTIME_ROLE");
  if (!isAbsolute(libraryRoot) || !SAFE_ROLE.test(runtimeRole)) throw new Error("Controlled corpus runtime paths or role are invalid.");

  const config = parseConfig(JSON.parse(await readFile(configPath, "utf8")));
  const inventory = JSON.parse(await readFile(inventoryPath, "utf8")) as SourceInventoryManifestFile;
  const inventoryById = new Map(inventory.records.map((record) => [record.sourceId, record]));
  const root = resolve(libraryRoot);
  const scanner = createClamAvScannerFromEnv(process.env);
  if (!scanner) throw new Error("A real ClamAV scanner is required for controlled corpus ingestion.");
  const policy = loadArtifactSafetyPolicy(process.env);
  const provider = new LocalEvaluationEmbeddingProvider();

  const bindings: LocalImmutableArtifactBinding[] = [];
  const sourceBytes = new Map<string, Buffer>();
  for (const source of config.sources) {
    const inventoryRecord = inventoryById.get(source.sourceId);
    if (!inventoryRecord || inventoryRecord.documentKey !== source.documentKey || inventoryRecord.documentVersion !== source.documentVersion) {
      throw new Error(`Inventory identity mismatch for ${source.sourceId}.`);
    }
    const path = resolve(root, source.relativePath);
    const fromRoot = relative(root, path);
    if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error(`Artifact path escaped root for ${source.sourceId}.`);
    const content = await readFile(path);
    if (content.byteLength !== source.expectedByteLength || sha256(content) !== source.expectedSha256) {
      throw new Error(`Artifact identity mismatch for ${source.sourceId}.`);
    }
    sourceBytes.set(source.sourceId, content);
    bindings.push({
      filePath: path,
      expectedSha256: source.expectedSha256,
      expectedByteLength: source.expectedByteLength,
      reference: {
        storeName: "local_eval_store",
        objectNamespace: "controlled-antigua-corpus",
        objectKey: `${source.sourceId}/${source.expectedSha256}.pdf`,
        objectVersion: `sha256:${source.expectedSha256}`,
      },
    });
  }

  const acceptancePool = new Pool({ connectionString: acceptanceDatabaseUrl, max: 2, connectionTimeoutMillis: 5_000 });
  const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl, max: 4, connectionTimeoutMillis: 5_000 });
  const acceptanceAdmin = new PostgresArtifactAcceptanceRepository(acceptancePool);
  const acceptanceRuntime = new PostgresArtifactAcceptanceRepository(runtimePool);
  const service = new PostgresIngestionJobService(runtimePool);
  const objectReader = new LocalImmutableArtifactReader(root, bindings);
  const resolver = new PersistedAcceptedArtifactResolver(acceptanceRuntime, objectReader, { policy });
  const receiptSources: ReceiptSource[] = [];
  const manifestRecords: CorpusManifestRecord[] = [];

  try {
    const roleCheck = await acceptancePool.query(
      `SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = $1`, [runtimeRole]
    );
    if (roleCheck.rows.length !== 1 || roleCheck.rows[0].rolsuper || roleCheck.rows[0].rolbypassrls || roleCheck.rows[0].rolcreaterole || roleCheck.rows[0].rolcreatedb) {
      throw new Error("Controlled corpus runtime role is missing or privileged.");
    }
    const rlsCheck = await acceptancePool.query(
      `SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE (n.nspname, c.relname) IN (('rag','artifact_objects'),('rag','artifact_scans'),('rag','ingestion_jobs'),('rag','embedding_vectors'),('rag','document_versions'))`
    );
    if (rlsCheck.rows.length !== 5 || rlsCheck.rows.some((row) => !row.relrowsecurity || !row.relforcerowsecurity || row.owner === runtimeRole)) {
      throw new Error("Controlled corpus persistence is not fully protected by non-owner FORCE RLS.");
    }

    for (const source of config.sources) {
      const content = sourceBytes.get(source.sourceId)!;
      const binding = bindings.find((candidate) => candidate.expectedSha256 === source.expectedSha256)!;
      const structural = inspectArtifactContent({
        content,
        sourcePath: source.originalFilename,
        declaredMediaType: "application/pdf",
        maxArtifactBytes: policy.maxArtifactBytes,
      });
      const malware = await scanVerifiedArtifactSnapshot(content, source.originalFilename, scanner);
      if (malware.verdict !== "clean" || !malware.definitionsVersion) {
        throw new Error(`Malware scan did not produce complete clean evidence for ${source.sourceId}.`);
      }
      const inspectedAt = isoNow();
      const acceptedUntil = new Date(Date.now() + policy.malwareScanMaxAgeMs).toISOString();
      let accepted = await findCurrentAcceptance(acceptancePool, config.tenantId, source, binding.reference);
      if (!accepted) {
        const inspection = await acceptanceAdmin.beginInspection({
          tenantId: config.tenantId,
          principalId: config.principalId,
          documentVersionId: source.documentVersionId,
          artifactSha256: source.expectedSha256,
          originalFilename: source.originalFilename,
          mediaType: "application/pdf",
          object: binding.reference,
        });
        const completed = await acceptanceAdmin.completeInspection({
          inspection,
          outcome: {
            verdict: "clean",
            contentSha256: source.expectedSha256,
            byteLength: source.expectedByteLength,
            detectedMediaType: structural.detectedMediaType,
            structuralSignature: structural.signature,
            inspectedAt,
            scannerEngine: malware.engine,
            scannerEngineVersion: malware.engineVersion,
            scannerDefinitionsVersion: malware.definitionsVersion,
            acceptedUntil,
          },
        });
        if (completed.status !== "accepted" || completed.verdict !== "clean") throw new Error(`Artifact acceptance failed for ${source.sourceId}.`);
        accepted = { artifactObjectId: completed.artifactObjectId, artifactScanId: completed.artifactScanId };
      }

      const pipelineConfig = {
        contractVersion: "v1" as const,
        extractor: { name: "bounded_document_registry", version: "1.0.0" },
        chunkPlanner: { name: "section_text_v1" as const, maxChars: 1_800, overlapChars: 180 },
        embedding: { provider: provider.providerName, model: provider.model, dimension: provider.dimensions },
      };
      const queued = await service.enqueue({
        tenantId: config.tenantId,
        principalId: config.principalId,
        documentVersionId: source.documentVersionId,
        artifactSha256: source.expectedSha256,
        idempotencyKey: `controlled-corpus:${source.sourceId}:${source.expectedSha256}:${provider.model}`,
        pipelineConfig,
        maxAttempts: 1,
      });
      if (queued.kind === "conflict") throw new Error(`Idempotency conflict for ${source.sourceId}.`);
      let job = queued.job;
      if (job.status !== "processed") {
        const worker = new TenantIngestionWorker(service, resolver, provider, {
          tenantId: config.tenantId,
          workerId: `controlled-${source.sourceId}`,
          leaseDurationSeconds: 300,
          heartbeatIntervalMs: 30_000,
          policy,
          extract: (path, input) => extractByPath(path, { ...input, title: source.title }),
          failureObserver: (diagnostic) => {
            process.stderr.write(`controlled_worker_diagnostic=${JSON.stringify({ sourceId: source.sourceId, ...diagnostic })}\n`);
          },
          env: process.env,
        });
        const result = await worker.runOnce();
        if (result.kind === "failed" && result.errorCode === "pdf_no_extractable_text") {
          const refreshed = await service.get(config.tenantId, result.jobId);
          if (!refreshed || refreshed.status !== "failed") {
            throw new Error(`Blocked job evidence disappeared for ${source.sourceId}.`);
          }
          receiptSources.push({
            sourceId: source.sourceId,
            documentKey: source.documentKey,
            documentVersion: source.documentVersion,
            documentVersionId: source.documentVersionId,
            contentSha256: source.expectedSha256,
            byteLength: source.expectedByteLength,
            structuralSignature: structural.signature,
            scanner: { engine: malware.engine, version: malware.engineVersion, definitionsVersion: malware.definitionsVersion, inspectedAt },
            acceptance: accepted,
            jobId: refreshed.jobId,
            ingestionStatus: "blocked_no_text",
            sectionCount: 0,
            chunkCount: 0,
            indexedAt: null,
            failureCode: result.errorCode,
          });
          continue;
        }
        if (result.kind !== "processed") {
          const code = "errorCode" in result ? `:${result.errorCode}` : "";
          throw new Error(`Controlled worker did not process ${source.sourceId}: ${result.kind}${code}.`);
        }
        const refreshed = await service.get(config.tenantId, result.jobId);
        if (!refreshed) throw new Error(`Processed job disappeared for ${source.sourceId}.`);
        job = refreshed;
      }
      if (job.status !== "processed" || !job.artifactObjectId || !job.artifactScanId) {
        throw new Error(`Processed job evidence is incomplete for ${source.sourceId}.`);
      }
      if (job.artifactObjectId !== accepted.artifactObjectId || job.artifactScanId !== accepted.artifactScanId) {
        throw new Error(`Job acceptance binding mismatch for ${source.sourceId}.`);
      }
      const persisted = await withTenantTransaction(runtimePool, config.tenantId, async (client) => {
        const rows = await client.query(
          `SELECT count(*)::int AS chunk_count, count(DISTINCT page_start)::int AS section_count,
                  min(indexed_at) AS indexed_at
             FROM rag.embedding_vectors
            WHERE tenant_id = $1::uuid AND document_version_id = $2::uuid
              AND ingestion_job_id = $3::uuid`,
          [config.tenantId, source.documentVersionId, job.jobId]
        ) as { rows: Array<{ chunk_count: number; section_count: number; indexed_at: Date | string }> };
        const version = await client.query(
          `SELECT extraction_status FROM rag.document_versions WHERE tenant_id = $1::uuid AND id = $2::uuid`,
          [config.tenantId, source.documentVersionId]
        ) as { rows: Array<{ extraction_status: string }> };
        return { ...rows.rows[0], extractionStatus: version.rows[0]?.extraction_status };
      });
      const chunkCount = Number(persisted.chunk_count);
      const sectionCount = Number(persisted.section_count);
      if (persisted.extractionStatus !== "processed" || chunkCount < 1 || sectionCount < 1) {
        throw new Error(`Persisted ingestion evidence is incomplete for ${source.sourceId}.`);
      }
      const indexedAt = new Date(persisted.indexed_at).toISOString();
      manifestRecords.push({
        documentKey: source.documentKey,
        documentTitle: source.title,
        sourcePath: `.rag/library/${source.relativePath}`,
        sourceFormat: "pdf",
        documentVersion: source.documentVersion,
        contentSha256: source.expectedSha256,
        chunkCount,
        embeddingProvider: provider.providerName,
        embeddingModel: provider.model,
        embeddingDimension: provider.dimensions,
        status: "indexed",
        indexedAt,
        failureCount: 0,
        failureCodes: [],
      });
      receiptSources.push({
        sourceId: source.sourceId,
        documentKey: source.documentKey,
        documentVersion: source.documentVersion,
        documentVersionId: source.documentVersionId,
        contentSha256: source.expectedSha256,
        byteLength: source.expectedByteLength,
        structuralSignature: structural.signature,
        scanner: { engine: malware.engine, version: malware.engineVersion, definitionsVersion: malware.definitionsVersion, inspectedAt },
        acceptance: accepted,
        jobId: job.jobId,
        ingestionStatus: "ingested",
        sectionCount,
        chunkCount,
        indexedAt,
        failureCode: null,
      });
    }

    const manifestStore = new JsonFileCorpusManifestStore(operationalManifestPath);
    for (const record of manifestRecords) await manifestStore.put(record);
    const operational = await manifestStore.list();
    const updatedRecords = inventory.records.map((record): SourceInventoryRecord => {
      const source = config.sources.find((candidate) => candidate.sourceId === record.sourceId);
      if (!source) return record;
      const evidence = receiptSources.find((item) => item.sourceId === source.sourceId)!;
      const baseEvidence = {
        acquisition: {
          acquiredAt: evidence.scanner.inspectedAt,
          artifactPath: `.rag/library/${source.relativePath}`,
          contentSha256: source.expectedSha256,
          mediaType: "application/pdf",
          byteLength: source.expectedByteLength,
        },
        artifactSafety: {
          inspectedAt: evidence.scanner.inspectedAt,
          artifactPath: `.rag/library/${source.relativePath}`,
          contentSha256: source.expectedSha256,
          byteLength: source.expectedByteLength,
          observedContentSha256: source.expectedSha256,
          observedByteLength: source.expectedByteLength,
          declaredMediaType: "application/pdf",
          detectedMediaType: "application/pdf",
          signature: evidence.structuralSignature,
          scannerEngine: evidence.scanner.engine,
          scannerVersion: evidence.scanner.version,
          scannerDefinitionsVersion: evidence.scanner.definitionsVersion,
          verdict: "clean" as const,
          failureCodes: [],
        },
      };
      if (evidence.ingestionStatus === "blocked_no_text") {
        return {
          ...record,
          ...baseEvidence,
          status: "failed",
          extraction: undefined,
          indexing: undefined,
          failureCodes: [evidence.failureCode ?? "pdf_no_extractable_text"],
          limitations: [
            ...record.limitations.filter((item) => !/inspección segura|pending/i.test(item)),
            "El PDF oficial es un escaneo de 170 páginas sin capa de texto extraíble; el extractor acotado falló cerrado con pdf_no_extractable_text.",
            "No se ejecutó OCR jurídico en español sin un gate separado de exactitud y revisión humana.",
            "La adquisición y el scan limpio no equivalen a ingestión, vigencia, aplicabilidad jurídica ni aprobación institucional.",
          ],
          provenanceNotes: [
            ...record.provenanceNotes,
            "Feature 085 verificó bytes exactos y ClamAV, pero conservó el documento fuera del índice por ausencia de texto extraíble.",
          ],
          tags: [...new Set([...(record.tags ?? []).filter((tag) => tag !== "acquired"), "clean-scan", "extraction-blocked-no-text"])],
        };
      }
      return {
        ...record,
        ...baseEvidence,
        status: "ingested",
        failureCodes: undefined,
        extraction: {
          extractedAt: evidence.indexedAt!,
          extractor: "pdfjs_isolated_process_v1",
          sectionCount: evidence.sectionCount,
        },
        indexing: {
          indexedAt: evidence.indexedAt!,
          indexer: `${provider.providerName}/${provider.model}`,
          chunkCount: evidence.chunkCount,
          manifestDocumentKey: source.documentKey,
        },
        limitations: [
          ...record.limitations.filter((item) => !/pending|no se trasladó|deben importarse|inspección segura/i.test(item)),
          "Ingestión acreditada en un PostgreSQL/pgvector local desechable con FORCE RLS; no acredita almacenamiento de objetos, retención ni operación productiva.",
          "Los embeddings local-eval-hashing son una representación léxica determinista de evaluación, no un modelo semántico productivo.",
          "La ingestión no demuestra vigencia, aplicabilidad jurídica, completitud del corpus ni aprobación institucional.",
        ],
        provenanceNotes: [
          ...record.provenanceNotes,
          `Feature 085 verificó bytes exactos, ClamAV, extracción acotada y ${evidence.chunkCount} chunks tenant-scoped.`,
        ],
        tags: [...new Set([...(record.tags ?? []).filter((tag) => tag !== "feature-054-reconciliation-pending" && tag !== "acquired"), "ingested", "controlled-real-corpus-v1"])],
      };
    });
    const updatedInventory: SourceInventoryManifestFile = { ...inventory, generatedAt: isoNow(), records: updatedRecords };
    const validation = validateSourceInventory(updatedRecords);
    const reconciliation = reconcileSourceInventoryWithCorpusManifest(updatedRecords, operational);
    if (!validation.valid || !reconciliation.valid) {
      throw new Error(`Inventory reconciliation failed: ${JSON.stringify([...validation.failures, ...reconciliation.failures])}`);
    }

    const dbIdentity = await acceptancePool.query(
      `SELECT current_setting('server_version') AS postgres_version,
              (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector_version`
    );
    const receipt = {
      schemaVersion: 1,
      generatedAt: isoNow(),
      corpusKind: "controlled_real_public_municipal_v1",
      tenantId: config.tenantId,
      sources: receiptSources,
      database: {
        postgresVersion: dbIdentity.rows[0].postgres_version,
        pgvectorVersion: dbIdentity.rows[0].pgvector_version,
        runtimeRole,
        runtimeRoleNonOwner: true,
        runtimeRoleNoBypassRls: true,
        forcedRlsTables: 5,
        disposable: true,
      },
      embedding: { provider: provider.providerName, model: provider.model, dimension: provider.dimensions, semanticClaim: false },
      rawBytesCommittedToGit: false,
      productionObjectStoreClaim: false,
      legalValidityClaim: false,
      corpusCompletenessClaim: false,
    };
    await atomicJson(evidenceManifestPath, { schemaVersion: 1, records: manifestRecords });
    await atomicJson(receiptPath, receipt);
    await atomicJson(inventoryPath, updatedInventory);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    await Promise.allSettled([acceptancePool.end(), runtimePool.end()]);
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Controlled corpus ingestion failed."}\n`);
  process.exitCode = 1;
});
