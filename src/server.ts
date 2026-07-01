import "dotenv/config";
import { createServer, type RequestListener, type Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateQuery } from "./agent.js";
import { buildDeterministicAnswer } from "./answer.js";
import { processChat } from "./chat.js";
import { closeDb } from "./db.js";
import { type EvidenceMode, findEvidence } from "./evidence.js";
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
import { keywordSearch, phraseSearch } from "./search.js";

// Resolve public directory relative to the project root.
// In dev (tsx): src/server.ts → ../public
// In dist: dist/server.js → ../public
const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPublicDir = join(__dirname, "..", "public");

export interface ServerOptions {
  publicDir?: string;
}

const requireDatabaseUrl = (): void => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and set your password.");
  }
};

export const createRequestHandler = (options: ServerOptions = {}): RequestListener => {
  const publicDir = options.publicDir ?? defaultPublicDir;

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
        });
        return;
      }

      // ----- Search -----
      if (req.method === "GET" && url.pathname === "/api/search") {
        const mode = url.searchParams.get("mode")?.trim() ?? "keyword";
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

        throw new HttpError(400, "invalid_mode", "mode must be keyword or phrase");
      }

      // ----- Evidence -----
      if (req.method === "GET" && url.pathname === "/api/evidence") {
        const mode = (url.searchParams.get("mode")?.trim() ?? "keyword") as EvidenceMode;
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        if (mode !== "keyword" && mode !== "phrase") {
          throw new HttpError(400, "invalid_mode", "mode must be keyword or phrase");
        }

        const evidence = await findEvidence(query, mode, limit);
        sendJson(res, 200, evidence);
        return;
      }

      // ----- Agent -----
      if (req.method === "GET" && url.pathname === "/api/agent") {
        const mode = (url.searchParams.get("mode")?.trim() ?? "keyword") as EvidenceMode;
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        if (mode !== "keyword" && mode !== "phrase") {
          throw new HttpError(400, "invalid_mode", "mode must be keyword or phrase");
        }

        const agentResponse = await evaluateQuery(query, mode, limit);
        sendJson(res, 200, agentResponse);
        return;
      }

      // ----- Deterministic Answer -----
      if (req.method === "GET" && url.pathname === "/api/answer") {
        const mode = (url.searchParams.get("mode")?.trim() ?? "keyword") as EvidenceMode;
        const query = requireQueryParam(url, "q");
        const limit = parseLimit(url.searchParams.get("limit"));

        if (mode !== "keyword" && mode !== "phrase") {
          throw new HttpError(400, "invalid_mode", "mode must be keyword or phrase");
        }

        const answer = await buildDeterministicAnswer(query, mode, limit);
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

        const mode = ((body.mode ?? "keyword") as EvidenceMode);
        if (mode !== "keyword" && mode !== "phrase") {
          throw new HttpError(400, "invalid_mode", "mode must be keyword or phrase");
        }

        const limit = body.limit ?? 5;
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
          throw new HttpError(400, "invalid_limit", "limit must be an integer between 1 and 50");
        }

        const chatResponse = await processChat(message, mode, limit);
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

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (isDirectRun) {
  startServer();
}
