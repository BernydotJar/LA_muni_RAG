import "dotenv/config";
import { createServer, type RequestListener, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateQueryWithDependencies } from "./agent.js";
import { buildDeterministicAnswerWithDependencies } from "./answer.js";
import {
  CLAIM_PACK_ROUTE,
  createClaimPackV1Dependencies,
  handleClaimPackV1,
  type ClaimPackV1Options,
} from "./api/v1/claimPackIndex.js";
import {
  createEvidenceGapV1Dependencies,
  EVIDENCE_GAP_ROUTE,
  handleEvidenceGapV1,
  type EvidenceGapV1Options,
} from "./api/v1/evidenceGapIndex.js";
import {
  createIngestionJobV1Dependencies,
  handleIngestionJobV1,
  INGESTION_JOBS_ROUTE,
  type IngestionJobV1Options,
} from "./api/v1/ingestionIndex.js";
import {
  createProcedureQueryV1Dependencies,
  handleProcedureQueryV1,
  type ProcedureQueryV1Options,
} from "./api/v1/index.js";
import {
  createWorkflowLifecycleV1Dependencies,
  handleWorkflowLifecycleV1,
  WORKFLOW_APPROVALS_ROUTE,
  WORKFLOW_DRAFTS_ROUTE,
  WORKFLOW_REVIEWS_ROUTE,
  WORKFLOWS_ROUTE_PREFIX,
  type WorkflowLifecycleV1Options,
} from "./api/v1/workflowLifecycleIndex.js";
import { processChatWithDependencies } from "./chat.js";
import { closeDb } from "./db.js";
import {
  loadActiveDomainPack,
  summarizeDomainPack,
  summarizeDomainPackForUi,
  type DomainPack,
} from "./domain/registry.js";
import { type EvidenceDependencies, type EvidenceMode, findEvidenceWithDependencies } from "./evidence.js";
import {
  HttpError,
  handleCors,
  handleV1Cors,
  parseLimit,
  readJsonBody,
  requestUrl,
  requireQueryParam,
  sendError,
  sendJson,
  serveStatic,
} from "./http.js";
import { buildProcedureWorkflowWithDependencies, type ProcedureWorkflowDepth } from "./procedure/index.js";
import {
  createProcedureFeedback,
  createProcedureFeedbackDependencies,
  listProcedureFeedback,
  requireProcedureFeedbackAuth,
  type ProcedureFeedbackDependencies,
  validateProcedureFeedbackFilters,
  validateProcedureFeedbackInput,
} from "./procedureFeedback/index.js";
import { keywordSearch, phraseSearch } from "./search.js";
import {
  createRuntimeEvidenceDependencyContext,
  type RuntimeVectorStatus,
} from "./runtime/evidenceDependencies.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPublicDir = join(__dirname, "..", "public");

export interface ServerOptions {
  publicDir?: string;
  evidenceDependencies?: EvidenceDependencies;
  vectorRuntimeStatus?: RuntimeVectorStatus;
  procedureFeedbackDependencies?: ProcedureFeedbackDependencies;
  domainPack?: DomainPack;
  procedureQueryV1?: ProcedureQueryV1Options;
  claimPackV1?: ClaimPackV1Options;
  evidenceGapV1?: EvidenceGapV1Options;
  ingestionJobV1?: IngestionJobV1Options;
  workflowLifecycleV1?: WorkflowLifecycleV1Options;
  v1CorsAllowedOrigins?: readonly string[];
  legacyApiEnabled?: boolean;
  requestTimeoutMs?: number;
  headersTimeoutMs?: number;
  keepAliveTimeoutMs?: number;
  maxHeadersCount?: number;
}

const requireDatabaseUrl = (): void => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set your password.");
  }
};

const parseEvidenceMode = (value: string | null | undefined): EvidenceMode => {
  const mode = (value?.trim() || "keyword") as EvidenceMode;
  if (mode !== "keyword" && mode !== "phrase" && mode !== "hybrid") {
    throw new HttpError(400, "invalid_mode", "mode must be keyword, phrase, or hybrid");
  }
  return mode;
};

const parseProcedureDepth = (value: string | null | undefined): ProcedureWorkflowDepth => {
  const depth = value?.trim() || "overview";
  if (depth !== "overview" && depth !== "deep_dive") {
    throw new HttpError(400, "invalid_depth", "depth must be overview or deep_dive");
  }
  return depth;
};

export const createRequestHandler = (options: ServerOptions = {}): RequestListener => {
  const publicDir = options.publicDir ?? defaultPublicDir;
  const runtimeContext = options.evidenceDependencies
    ? {
        dependencies: options.evidenceDependencies,
        vectorStatus:
          options.vectorRuntimeStatus ?? {
            state: "enabled" as const,
            reasons: ["runtime_dependencies_ready" as const],
            queryEmbeddingProviderConfigured: Boolean(options.evidenceDependencies.queryEmbeddingProvider),
            vectorRepositoryConfigured: Boolean(options.evidenceDependencies.vectorRepository),
          },
      }
    : createRuntimeEvidenceDependencyContext();
  const evidenceDependencies = runtimeContext.dependencies;
  const vectorRuntimeStatus = options.vectorRuntimeStatus ?? runtimeContext.vectorStatus;
  const procedureFeedbackDependencies =
    options.procedureFeedbackDependencies ?? createProcedureFeedbackDependencies();
  const domainPack = options.domainPack ?? loadActiveDomainPack();
  const domainPackSummary = summarizeDomainPack(domainPack);
  const domainPackUiSummary = summarizeDomainPackForUi(domainPack);
  const procedureQueryV1Dependencies = createProcedureQueryV1Dependencies(
    options.procedureQueryV1,
    domainPack
  );
  const claimPackV1Dependencies = createClaimPackV1Dependencies(
    options.claimPackV1,
    domainPack
  );
  const evidenceGapV1Dependencies = createEvidenceGapV1Dependencies(
    options.evidenceGapV1
  );
  const ingestionJobV1Dependencies = createIngestionJobV1Dependencies(
    options.ingestionJobV1
  );
  const workflowLifecycleV1Dependencies = createWorkflowLifecycleV1Dependencies(
    options.workflowLifecycleV1
  );
  const v1CorsAllowedOrigins =
    options.v1CorsAllowedOrigins ??
    (process.env.V1_CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  const legacyApiEnabled =
    options.legacyApiEnabled ?? process.env.NODE_ENV !== "production";

  return async (req, res) => {
    try {
      const url = requestUrl(req);

      if (url.pathname === CLAIM_PACK_ROUTE) {
        if (handleV1Cors(req, res, v1CorsAllowedOrigins)) return;
        await handleClaimPackV1(req, res, claimPackV1Dependencies);
        return;
      }

      if (url.pathname === EVIDENCE_GAP_ROUTE) {
        if (handleV1Cors(req, res, v1CorsAllowedOrigins)) return;
        await handleEvidenceGapV1(req, res, evidenceGapV1Dependencies);
        return;
      }

      if (url.pathname === "/api/v1/procedure-queries") {
        if (handleV1Cors(req, res, v1CorsAllowedOrigins)) return;
        await handleProcedureQueryV1(req, res, procedureQueryV1Dependencies);
        return;
      }

      if (
        url.pathname === INGESTION_JOBS_ROUTE ||
        url.pathname.startsWith(`${INGESTION_JOBS_ROUTE}/`)
      ) {
        if (handleV1Cors(req, res, v1CorsAllowedOrigins, ["GET", "POST"])) return;
        await handleIngestionJobV1(req, res, ingestionJobV1Dependencies);
        return;
      }

      if (
        url.pathname === WORKFLOW_DRAFTS_ROUTE ||
        url.pathname === WORKFLOW_REVIEWS_ROUTE ||
        url.pathname === WORKFLOW_APPROVALS_ROUTE ||
        url.pathname.startsWith(WORKFLOWS_ROUTE_PREFIX)
      ) {
        const workflowMethods = url.pathname.startsWith(WORKFLOWS_ROUTE_PREFIX)
          ? (["GET"] as const)
          : (["POST"] as const);
        if (handleV1Cors(req, res, v1CorsAllowedOrigins, workflowMethods)) return;
        await handleWorkflowLifecycleV1(req, res, url, workflowLifecycleV1Dependencies);
        return;
      }

      // The pre-v1 API uses global-pool queries and demo-oriented wildcard
      // CORS. It is intentionally unavailable in production until every route
      // is migrated to authenticated tenant transactions and bounded abuse
      // controls. Keep this check before legacy CORS so a disabled route does
      // not advertise browser access.
      if (!legacyApiEnabled && url.pathname.startsWith("/api/")) {
        throw new HttpError(404, "not_found", "Route not found");
      }

      if (handleCors(req, res)) return;

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, {
          status: "ok",
          service: "la-muni-rag-api",
          vectorRuntime: vectorRuntimeStatus,
          procedureFeedbackApi: {
            enabled: Boolean(procedureFeedbackDependencies.apiToken?.trim()),
          },
          ingestionJobApi: {
            enabled: Boolean(ingestionJobV1Dependencies.pipelineConfig),
            workerConfigured: false,
          },
          claimPackApi: {
            enabled: true,
            validitySeconds: claimPackV1Dependencies.validitySeconds,
          },
          evidenceGapApi: {
            enabled: true,
            initialStatus: "open",
          },
          workflowLifecycleApi: {
            enabled: true,
            humanApprovalRequired: true,
          },
          domainPack: domainPackSummary,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/domain-pack") {
        sendJson(res, 200, domainPackUiSummary);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/search") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        if (mode === "keyword") {
          const results = await keywordSearch(query, limit);
          sendJson(res, 200, { mode, query, resultCount: results.length, results });
          return;
        }

        if (mode === "phrase") {
          const results = await phraseSearch(query, limit);
          sendJson(res, 200, { mode, query, resultCount: results.length, results });
          return;
        }

        const evidence = await findEvidenceWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, {
          mode,
          query,
          resultCount: evidence.evidenceCount,
          results: evidence.evidence,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/evidence") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));
        const evidence = await findEvidenceWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, evidence);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/procedure") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const depth = parseProcedureDepth(url.searchParams.get("depth"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));
        const workflow = await buildProcedureWorkflowWithDependencies(
          query,
          mode,
          limit,
          evidenceDependencies,
          domainPack,
          depth
        );
        sendJson(res, 200, workflow);
        return;
      }

      if (url.pathname === "/api/procedure-feedback") {
        requireProcedureFeedbackAuth(req, procedureFeedbackDependencies.apiToken);

        if (req.method === "POST") {
          const body = await readJsonBody<unknown>(req);
          const input = validateProcedureFeedbackInput(body);
          const clientKey = req.socket.remoteAddress || "unknown";
          const record = await createProcedureFeedback(input, clientKey, procedureFeedbackDependencies);
          sendJson(res, 201, { item: record });
          return;
        }

        if (req.method === "GET") {
          const filters = validateProcedureFeedbackFilters(url);
          const result = await listProcedureFeedback(filters, procedureFeedbackDependencies);
          sendJson(res, 200, result);
          return;
        }

        throw new HttpError(405, "feedback_method_not_allowed", "Only GET and POST are supported");
      }

      if (req.method === "GET" && url.pathname === "/api/agent") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));
        const agentResponse = await evaluateQueryWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, agentResponse);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/answer") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));
        const answer = await buildDeterministicAnswerWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, answer);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        const body = await readJsonBody<{ message?: string; mode?: string; limit?: number }>(req);
        const message = body.message?.trim();
        if (!message) throw new HttpError(400, "missing_message", "message is required");

        const mode = parseEvidenceMode(body.mode);
        const limit = body.limit ?? 5;
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
          throw new HttpError(400, "invalid_limit", "limit must be an integer between 1 and 50");
        }

        const chatResponse = await processChatWithDependencies(message, mode, limit, evidenceDependencies);
        sendJson(res, 200, chatResponse);
        return;
      }

      let staticPath = url.pathname;
      if (staticPath === "/") staticPath = "/index.html";

      if (req.method === "GET" && serveStatic(publicDir, staticPath, res)) return;

      throw new HttpError(404, "not_found", "Route not found");
    } catch (error) {
      sendError(res, error);
    }
  };
};

export const createApiServer = (options: ServerOptions = {}): Server => {
  const server = createServer(createRequestHandler(options));
  server.requestTimeout = options.requestTimeoutMs ?? 15_000;
  server.headersTimeout = options.headersTimeoutMs ?? 10_000;
  server.keepAliveTimeout = options.keepAliveTimeoutMs ?? 5_000;
  server.maxHeadersCount = options.maxHeadersCount ?? 100;
  server.maxRequestsPerSocket = 1_000;
  return server;
};

export const startServer = (): Server => {
  requireDatabaseUrl();
  const port = Number(process.env.PORT ?? 3000);
  const server = createApiServer();
  server.listen(port, () => {
    console.log(`LA Muni RAG API listening on port ${port}`);
  });
  return server;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = startServer();
  const shutdown = async () => {
    server.close();
    await closeDb();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
