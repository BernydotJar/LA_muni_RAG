import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};

/** Apply CORS headers to every response. Returns true for preflight (caller should return). */
export const handleCors = (req: IncomingMessage, res: ServerResponse): boolean => {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
};

const appendVary = (res: ServerResponse, value: string): void => {
  const existing = res.getHeader("vary");
  const values = new Set(
    (Array.isArray(existing) ? existing : String(existing ?? "").split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  );
  values.add(value);
  res.setHeader("vary", [...values].join(", "));
};

/**
 * Versioned integration routes never emit wildcard origins. An absent Origin
 * is valid for server-to-server clients; browser origins must match exactly.
 */
export const handleV1Cors = (
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: readonly string[],
  allowedMethods: readonly ("GET" | "POST")[] = ["POST"]
): boolean => {
  appendVary(res, "Origin");
  const origin = singleHeaderValue(req.headers.origin);
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader(
      "access-control-allow-methods",
      [...new Set([...allowedMethods, "OPTIONS" as const])].join(", ")
    );
    res.setHeader(
      "access-control-allow-headers",
      "authorization, content-type, idempotency-key, x-request-id"
    );
    res.setHeader("access-control-max-age", "600");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
};

const singleHeaderValue = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export const parseLimit = (value: string | null): number => {
  if (!value) return 10;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new HttpError(400, "invalid_limit", "limit must be an integer between 1 and 50");
  }
  return parsed;
};

export const requireQueryParam = (url: URL, name: string): string => {
  const value = url.searchParams.get(name)?.trim();
  if (!value) {
    throw new HttpError(400, "missing_query_param", `${name} is required`);
  }
  return value;
};

const MAX_BODY_BYTES = 16_384; // 16 KB

/** Read and parse a JSON request body. */
export const readJsonBody = async <T = unknown>(req: IncomingMessage): Promise<T> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        // Keep draining the socket. Destroying it here can prevent the caller
        // from returning a contract-shaped rejection and breaks reuse.
        reject(new HttpError(413, "body_too_large", "Request body too large"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (tooLarge) return;
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        if (!raw.trim()) {
          reject(new HttpError(400, "empty_body", "Request body is required"));
          return;
        }
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new HttpError(400, "invalid_json", "Request body must be valid JSON"));
      }
    });

    req.on("error", reject);
  });
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export const sendJson = (
  res: ServerResponse,
  statusCode: number,
  body: unknown
): void => {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
};

export const sendError = (res: ServerResponse, error: unknown): void => {
  if (error instanceof HttpError) {
    sendJson(res, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
      },
    } satisfies ApiErrorBody);
    return;
  }

  // Do not expose database, filesystem, dependency, or configuration details.
  sendJson(res, 500, {
    error: {
      code: "internal_error",
      message: "Unexpected server error",
    },
  } satisfies ApiErrorBody);
};

export const requestUrl = (req: IncomingMessage): URL => {
  const host = req.headers.host ?? "localhost";
  return new URL(req.url ?? "/", `http://${host}`);
};

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * Serve a file from the public directory. Returns true if a file was served.
 */
export const serveStatic = (
  publicDir: string,
  pathname: string,
  res: ServerResponse
): boolean => {
  // Prevent directory traversal
  const safePath = pathname.replace(/\.\./g, "").replace(/\/\//g, "/");
  const filePath = resolve(join(publicDir, safePath));

  if (!filePath.startsWith(resolve(publicDir))) return false;
  if (!existsSync(filePath)) return false;

  const stat = statSync(filePath);
  if (!stat.isFile()) return false;

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  res.writeHead(200, {
    "content-type": contentType,
    "content-length": stat.size,
    "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  });

  createReadStream(filePath).pipe(res);
  return true;
};
