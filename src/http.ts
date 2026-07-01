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
  "access-control-allow-headers": "content-type",
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

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new HttpError(413, "body_too_large", "Request body too large"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
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

  const message = error instanceof Error ? error.message : "Unexpected error";
  sendJson(res, 500, {
    error: {
      code: "internal_error",
      message,
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

