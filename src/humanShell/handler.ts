import type { IncomingMessage, ServerResponse } from "node:http";
import {
  HUMAN_SHELL_CSS,
  HUMAN_SHELL_FAVICON,
  HUMAN_SHELL_HTML,
  HUMAN_SHELL_JS,
} from "./assets.js";

export const HUMAN_SHELL_ROUTE = "/app";
export const HUMAN_SHELL_CSS_ROUTE = "/app/shell.css";
export const HUMAN_SHELL_JS_ROUTE = "/app/shell.js";
export const HUMAN_SHELL_FAVICON_ROUTE = "/app/favicon.svg";
export const HUMAN_SHELL_LEGACY_FAVICON_ROUTE = "/favicon.ico";
export const HUMAN_SHELL_DEEP_LINK_ROUTES = Object.freeze([
  "/app/login",
  "/app/search",
  "/app/research",
  "/app/procedures",
  "/app/cases",
  "/app/sources",
  "/app/documents",
  "/app/ingestion",
  "/app/workflows",
  "/app/workflows/author",
  "/app/workflows/review",
  "/app/workflows/approve",
  "/app/admin/identity",
  "/app/audit",
  "/app/platform",
  "/app/accessibility",
  "/app/tenant-boundary",
]);
export const HUMAN_SHELL_RETURN_PATHS = Object.freeze([
  "/",
  HUMAN_SHELL_ROUTE,
  ...HUMAN_SHELL_DEEP_LINK_ROUTES,
]);

const SHELL_HTML_ROUTES = new Set<string>([
  HUMAN_SHELL_ROUTE,
  `${HUMAN_SHELL_ROUTE}/`,
  ...HUMAN_SHELL_DEEP_LINK_ROUTES,
]);

const CONTENT = new Map<string, { body: string; contentType: string }>([
  [HUMAN_SHELL_ROUTE, { body: HUMAN_SHELL_HTML, contentType: "text/html; charset=utf-8" }],
  [`${HUMAN_SHELL_ROUTE}/`, { body: HUMAN_SHELL_HTML, contentType: "text/html; charset=utf-8" }],
  [HUMAN_SHELL_CSS_ROUTE, { body: HUMAN_SHELL_CSS, contentType: "text/css; charset=utf-8" }],
  [HUMAN_SHELL_JS_ROUTE, { body: HUMAN_SHELL_JS, contentType: "application/javascript; charset=utf-8" }],
  [HUMAN_SHELL_FAVICON_ROUTE, { body: HUMAN_SHELL_FAVICON, contentType: "image/svg+xml; charset=utf-8" }],
  [HUMAN_SHELL_LEGACY_FAVICON_ROUTE, { body: HUMAN_SHELL_FAVICON, contentType: "image/svg+xml; charset=utf-8" }],
]);

const CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self'",
  "manifest-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "worker-src 'none'",
].join("; ");

const securityHeaders = (contentType: string, length: number): Record<string, string | number> => ({
  "content-type": contentType,
  "content-length": length,
  "cache-control": "no-store, max-age=0",
  pragma: "no-cache",
  "content-security-policy": CSP,
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

const sendMethodNotAllowed = (res: ServerResponse): void => {
  const payload = JSON.stringify({
    error: { code: "method_not_allowed", message: "Only GET and HEAD are supported" },
  });
  res.writeHead(405, {
    ...securityHeaders("application/json; charset=utf-8", Buffer.byteLength(payload)),
    allow: "GET, HEAD",
  });
  res.end(payload);
};

export const handleHumanShell = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): boolean => {
  const content = CONTENT.get(url.pathname) ?? (
    SHELL_HTML_ROUTES.has(url.pathname)
      ? { body: HUMAN_SHELL_HTML, contentType: "text/html; charset=utf-8" }
      : undefined
  );
  if (!content) return false;

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendMethodNotAllowed(res);
    return true;
  }

  const body = Buffer.from(content.body, "utf8");
  res.writeHead(200, securityHeaders(content.contentType, body.length));
  if (req.method === "HEAD") res.end();
  else res.end(body);
  return true;
};
