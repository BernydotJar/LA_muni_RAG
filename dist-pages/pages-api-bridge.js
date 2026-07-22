/**
 * LA Muni RAG — GitHub Pages API bridge.
 *
 * GitHub Pages is static. This bridge forwards approved API calls only when a
 * real HTTPS backend is configured through data-api-url at build time. Without
 * that configuration, approved calls fail closed with HTTP 503. It never emits
 * static answers, citations, procedures, or domain data.
 */
(() => {
  "use strict";

  const scriptTag = document.currentScript;
  const rawConfiguredApiUrl = scriptTag?.getAttribute("data-api-url") || "";
  const isLocalhost = (hostname) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  const sanitizeApiBaseUrl = (value) => {
    if (!value || !String(value).trim()) return "";
    try {
      const parsed = new URL(String(value).trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      if (parsed.protocol === "http:" && !isLocalhost(parsed.hostname)) return "";
      parsed.username = "";
      parsed.password = "";
      parsed.hash = "";
      parsed.search = "";
      return parsed.href;
    } catch {
      return "";
    }
  };

  const configuredApiUrl = sanitizeApiBaseUrl(rawConfiguredApiUrl);
  const configured = Boolean(configuredApiUrl);
  window.__LA_MUNI_API_CONFIG__ = Object.freeze({ configured, baseUrl: configuredApiUrl || null });

  const nativeFetch = window.fetch.bind(window);
  const requestUrl = (input) => {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      return rawUrl ? new URL(rawUrl, window.location.origin) : null;
    } catch {
      return null;
    }
  };

  const approvedRoutes = Object.freeze({
    "/api/public/v1/query": Object.freeze({ methods: ["POST"], targetPath: "/api/public/v1/query" }),
    "/api/procedure": Object.freeze({ methods: ["GET"], targetPath: "/api/public/v1/procedure" }),
    "/api/domain-pack": Object.freeze({ methods: ["GET"], targetPath: "/api/public/v1/domain-pack" }),
  });

  const unavailableResponse = () => new Response(JSON.stringify({
    error: {
      code: "service_unavailable",
      message: "El servicio de consulta no está configurado en esta publicación.",
    },
  }), {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-la-muni-rag-api-configured": "false",
    },
  });

  const safeProxyInit = (method, init) => {
    const headers = method === "POST"
      ? { "content-type": "application/json", accept: "application/json" }
      : { accept: "application/json" };
    return {
      method,
      headers,
      ...(method === "POST" && typeof init?.body === "string" ? { body: init.body } : {}),
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    };
  };

  window.fetch = async (input, init) => {
    const url = requestUrl(input);
    if (!url) return nativeFetch(input, init);

    const route = approvedRoutes[url.pathname];
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    if (!route?.methods.includes(method)) return nativeFetch(input, init);
    if (!configured) return unavailableResponse();

    const targetUrl = new URL(route.targetPath + url.search, configuredApiUrl).href;
    return nativeFetch(targetUrl, safeProxyInit(method, init));
  };
})();
