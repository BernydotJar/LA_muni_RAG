import "dotenv/config";
import { createServer, type RequestListener, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateQueryWithDependencies } from "./agent.js";
import { buildDeterministicAnswerWithDependencies } from "./answer.js";
import { processChatWithDependencies } from "./chat.js";
import { closeDb } from "./db.js";
import { type EvidenceDependencies, type EvidenceMode, findEvidenceWithDependencies } from "./evidence.js";
import {
  HttpError,
  handleCors,
  parseLimit,
  readJsonBody,
  requestUrl,
  requireQueryParam,
  sendError,
  sendJson,
  serveStatic,
} from "./http.js";
import { buildProcedureWorkflowWithDependencies } from "./procedure/index.js";
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

// Resolve public directory relative to the project root.
// In dev (tsx): src/server.ts → ../public
// In dist: dist/server.js → ../public
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPublicDir = join(__dirname, "..", "public");

export interface ServerOptions {
  publicDir?: string;
  evidenceDependencies?: EvidenceDependencies;
  vectorRuntimeStatus?: RuntimeVectorStatus;
  procedureFeedbackDependencies?: ProcedureFeedbackDependencies;
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

  return async (req, res) => {
    try {
      // CORS for all routes
      if (handleCors(req, res)) return;

      const url = requestUrl(req);

      // ----- Health -----
      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, {
          status: "ok",
          service: "la-muni-rag-api",
          vectorRuntime: vectorRuntimeStatus,
          procedureFeedbackApi: {
            enabled: Boolean(procedureFeedbackDependencies.apiToken?.trim()),
          },
        });
        return;
      }

      // ----- Search -----
      if (req.method === "GET" && url.pathname === "/api/search") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        if (mode === "keyword") {
          const results = await keywordSearch(query, limit);
          sendJson(res, 200, {
            mode,
            query,
            resultCount: results.length,
            results,
          });
          return;
        }

        if (mode === "phrase") {
          const results = await phraseSearch(query, limit);
          sendJson(res, 200, {
            mode,
            query,
            resultCount: results.length,
            results,
          });
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

      // ----- Evidence -----
      if (req.method === "GET" && url.pathname === "/api/evidence") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        const evidence = await findEvidenceWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, evidence);
        return;
      }

      // ----- Procedure Workflow Advisor -----
      if (req.method === "GET" && url.pathname === "/api/procedure") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        const workflow = await buildProcedureWorkflowWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, workflow);
        return;
      }

      // ----- Procedure Workflow Feedback -----
      if (url.pathname === "/api/procedure-feedback") {
        requireProcedureFeedbackAuth(req, procedureFeedbackDependencies.apiToken);

        if (req.method === "POST") {
          const body = await readJsonBody<unknown>(req);
          const input = validateProcedureFeedbackInput(body);
          const clientKey = req.socket.remoteAddress || "unknown";
          const record = await createProcedureFeedback(
            input,
            clientKey,
            procedureFeedbackDependencies
          );
          sendJson(res, 201, { item: record });
          return;
        }

        if (req.method === "GET") {
          const filters = validateProcedureFeedbackFilters(url);
          const result = await listProcedureFeedback(filters, procedureFeedbackDependencies);
          sendJson(res, 200, result);
          return;
        }
      }

      // ----- Agent -----
      if (req.method === "GET" && url.pathname === "/api/agent") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        const agentResponse = await evaluateQueryWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, agentResponse);
        return;
      }

      // ----- Deterministic Answer -----
      if (req.method === "GET" && url.pathname === "/api/answer") {
        const mode = parseEvidenceMode(url.searchParams.get("mode"));
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        const answer = await buildDeterministicAnswerWithDependencies(query, mode, limit, evidenceDependencies);
        sendJson(res, 200, answer);
        return;
      }

      // ----- Chat -----
      if (req.method === "POST" && url.pathname === "/api/chat") {
        const body = await readJsonBody<{ message?: string; mode?: string; limit?: number }>(req);

        const message = body.message?.trim();
        if (!message) {
          throw new HttpError(400, "missing_message", "message is required");
        }

        const mode = parseEvidenceMode(body.mode);
        const limit = body.limit ?? 5;
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
          throw new HttpError(400, "invalid_limit", "limit must be an integer between 1 and 50");
        }

        const chatResponse = await processChatWithDependencies(message, mode, limit, evidenceDependencies);
        sendJson(res, 200, chatResponse);
        return;
      }

      // ----- Static files (demo page, widget) -----
      let staticPath = url.pathname;
      if (staticPath === "/") staticPath = "/index.html";

      if (req.method === "GET" && serveStatic(publicDir, staticPath, res)) {
        return;
      }

      throw new HttpError(404, "not_found", "Route not found");
    } catch (error) {
      sendError(res, error);
    }
  };
};

export const createApiServer = (options: ServerOptions = {}): Server => {
  return createServer(createRequestHandler(options));
};

const closeServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }
      resolveClose();
    });
  });
};

const shutdown = async (server: Server): Promise<void> => {
  await closeServer(server);
  await closeDb();
};

export const startServer = (port = Number(process.env.PORT ?? 4010)): Server => {
  requireDatabaseUrl();

  const server = createApiServer();

  process.on("SIGINT", () => {
    void shutdown(server).finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void shutdown(server).finally(() => process.exit(0));
  });

  server.listen(port, () => {
    console.log(`LA Muni RAG API listening on http://localhost:${port}`);
  });

  return server;
};

if (process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("server.ts")) {
  startServer();
}
