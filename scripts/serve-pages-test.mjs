#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const root = resolve(process.cwd(), "dist-pages");

if (!existsSync(root) || !statSync(root).isDirectory()) {
  throw new Error("dist-pages is missing; run npm run build:pages first");
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
]);

const sendJson = (response, status, value) => {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
};

const readBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const bridgeHarness = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Pages bridge browser harness</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"></head>
<body>
  <main><h1>Pages bridge browser harness</h1></main>
  <script src="/pages-api-bridge.js" data-api-url="http://127.0.0.1:${port}/mock-base/"></script>
</body>
</html>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (request.method === "GET" && url.pathname === "/__playwright__/health") {
      sendJson(response, 200, { status: "ready" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/__playwright__/bridge-harness.html") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(bridgeHarness),
        "cache-control": "no-store",
      });
      response.end(bridgeHarness);
      return;
    }

    if (url.pathname === "/api/public/v1/query") {
      if (request.method === "GET") {
        sendJson(response, 200, {
          native: true,
          method: request.method,
          path: url.pathname,
          observedHeaders: {
            cookie: request.headers.cookie ?? null,
            authorization: request.headers.authorization ?? null,
          },
        });
        return;
      }
      if (request.method !== "POST") {
        sendJson(response, 405, { error: { code: "method_not_allowed" } });
        return;
      }
      const body = await readBody(request);
      sendJson(response, 200, {
        ok: true,
        method: request.method,
        path: url.pathname,
        search: url.search,
        body,
        observedHeaders: {
          accept: request.headers.accept ?? null,
          authorization: request.headers.authorization ?? null,
          cookie: request.headers.cookie ?? null,
          contentType: request.headers["content-type"] ?? null,
          xCustom: request.headers["x-custom"] ?? null,
        },
      });
      return;
    }

    if (url.pathname === "/api/public/v1/procedure" || url.pathname === "/api/public/v1/domain-pack") {
      if (request.method !== "GET") {
        sendJson(response, 405, { error: { code: "method_not_allowed" } });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        method: request.method,
        path: url.pathname,
        search: url.search,
        observedHeaders: {
          accept: request.headers.accept ?? null,
          authorization: request.headers.authorization ?? null,
          cookie: request.headers.cookie ?? null,
          xCustom: request.headers["x-custom"] ?? null,
        },
      });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: { code: "method_not_allowed" } });
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const relative = pathname.replace(/^\/+/, "");
    const candidate = resolve(root, relative);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      sendJson(response, 400, { error: { code: "invalid_path" } });
      return;
    }
    if (!existsSync(candidate) || !statSync(candidate).isFile()) {
      sendJson(response, 404, { error: { code: "not_found" } });
      return;
    }

    const info = statSync(candidate);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(candidate)) ?? "application/octet-stream",
      "content-length": info.size,
      "cache-control": extname(candidate) === ".html" ? "no-store" : "public, max-age=60",
      "x-content-type-options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(candidate).pipe(response);
  } catch (error) {
    sendJson(response, 500, {
      error: {
        code: "test_server_error",
        message: error instanceof Error ? error.message : "unknown error",
      },
    });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Playwright Pages server listening on http://${host}:${port}\n`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
