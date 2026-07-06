/**
 * LA Muni RAG — GitHub Pages demo/API bridge.
 *
 * GitHub Pages cannot run /api/chat. This bridge keeps the public demo usable:
 * - ?apiUrl=https://example.com routes /api/chat calls to that API.
 * - data-api-url on this script does the same.
 * - data-demo-mode="auto" returns static demo evidence on *.github.io when no API URL is configured.
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript;
  const params = new URLSearchParams(window.location.search);
  const configuredApiUrl = params.get("apiUrl") || scriptTag?.getAttribute("data-api-url") || "";
  const demoMode = scriptTag?.getAttribute("data-demo-mode") || "auto";
  const isGithubPages = window.location.hostname.endsWith("github.io");
  const shouldDemo = demoMode === "true" || (demoMode === "auto" && isGithubPages && !configuredApiUrl);
  const shouldProxy = Boolean(configuredApiUrl);

  if (demoMode === "false" || (!shouldDemo && !shouldProxy)) return;

  const nativeFetch = window.fetch.bind(window);

  const isChatRequest = (input) => {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      if (!rawUrl) return false;
      const url = new URL(rawUrl, window.location.origin);
      return url.pathname.endsWith("/api/chat");
    } catch {
      return false;
    }
  };

  const parseMessage = (init) => {
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return String(body.message || "consulta municipal");
    } catch {
      return "consulta municipal";
    }
  };

  const citation = (citationLabel, excerpt, pageStart) => ({
    citationLabel,
    sourceType: "plan",
    pageStart,
    excerpt,
    sourceUrl: null,
  });

  const demoCitationsFor = (message) => {
    const normalized = message.toLowerCase();

    if (/agua|saneamiento|acueducto|pozo|residual|pluvial/.test(normalized)) {
      return [
        citation(
          "PDM-OT Antigua Guatemala, pagina 43",
          "Se atribuye a que el acueducto Xayá Pixcayá surte de agua a la capital y condiciona la disponibilidad local del recurso hídrico.",
          43
        ),
        citation(
          "PDM-OT Antigua Guatemala, pagina 193",
          "Se identifican necesidades relacionadas con aguas pluviales, aguas residuales y mejora del sistema de tratamiento.",
          193
        ),
        citation(
          "PDM-OT Antigua Guatemala, pagina 184",
          "Se menciona la construcción de un pozo exclusivo y metas asociadas al acceso universal al agua limpia y saneamiento.",
          184
        ),
      ];
    }

    if (/prioridad|prioridades|desarrollo|proyecto/.test(normalized)) {
      return [
        citation(
          "PDM-OT Antigua Guatemala, pagina 170",
          "Se reflejan prioridades locales y su aporte a las prioridades nacionales de desarrollo, con acciones para asegurar implementación.",
          170
        ),
        citation(
          "PDM-OT Antigua Guatemala, pagina 100",
          "Se proponen redes y alianzas con organizaciones, instituciones académicas y otros actores para mejorar estrategias específicas.",
          100
        ),
        citation(
          "PDM-OT Antigua Guatemala, pagina 106",
          "Se identifican capacidades productivas, participación ciudadana y elaboración de proyectos como elementos de planificación territorial.",
          106
        ),
      ];
    }

    return [
      citation(
        "PDM-OT Antigua Guatemala, pagina 95",
        "Se mencionan acciones urgentes y efectivas a implementar en el municipio para responder a desafíos de bienestar social, económico y ambiental.",
        95
      ),
      citation(
        "PDM-OT Antigua Guatemala, pagina 106",
        "Se señalan necesidades para reducir la degradación de hábitats naturales y fortalecer participación ciudadana en procesos de planificación.",
        106
      ),
      citation(
        "PDM-OT Antigua Guatemala, pagina 94",
        "Se menciona la urgencia de programas de seguridad alimentaria y nutricional para mejorar condiciones de salud de la población.",
        94
      ),
    ];
  };

  const demoResponse = (message) => {
    const citations = demoCitationsFor(message);
    return {
      role: "assistant",
      content:
        "Respuesta de demostración estática para GitHub Pages. Encontré evidencia municipal relacionada con tu consulta; revisa las fuentes visibles antes de usarla como conclusión institucional.",
      citations,
      meta: {
        responseLabel: "evidence_found",
        confidence: "medium",
        evidenceCount: citations.length,
        suggestedAction: "revisar_fuentes",
        demoMode: true,
      },
    };
  };

  window.fetch = async (input, init) => {
    if (!isChatRequest(input)) return nativeFetch(input, init);

    if (shouldProxy) {
      const targetUrl = new URL("/api/chat", configuredApiUrl).href;
      return nativeFetch(targetUrl, init);
    }

    const message = parseMessage(init);
    return new Response(JSON.stringify(demoResponse(message)), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-la-muni-rag-demo": "true",
      },
    });
  };
})();
