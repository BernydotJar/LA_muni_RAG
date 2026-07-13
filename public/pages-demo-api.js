/**
 * LA Muni RAG — GitHub Pages demo/API bridge.
 *
 * GitHub Pages cannot run /api/chat or /api/procedure. This bridge keeps the public demo usable:
 * - ?apiUrl=https://example.com routes API calls to that API.
 * - data-api-url on this script does the same.
 * - data-demo-mode="auto" returns static demo evidence on *.github.io when no API URL is configured.
 *
 * Security boundary:
 * - only http(s) API base URLs are accepted;
 * - public GitHub Pages proxy mode requires https, except localhost development;
 * - cookies/credentials are never forwarded by the bridge;
 * - static demo citations do not include source URLs.
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript;
  const params = new URLSearchParams(window.location.search);
  const rawConfiguredApiUrl = params.get("apiUrl") || scriptTag?.getAttribute("data-api-url") || "";
  const demoMode = scriptTag?.getAttribute("data-demo-mode") || "auto";
  const isGithubPages = window.location.hostname.endsWith("github.io");
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
  const shouldDemo = demoMode === "true" || (demoMode === "auto" && isGithubPages && !configuredApiUrl);
  const shouldProxy = Boolean(configuredApiUrl);

  if (demoMode === "false" || (!shouldDemo && !shouldProxy)) return;

  const nativeFetch = window.fetch.bind(window);

  const requestPath = (input) => {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      if (!rawUrl) return "";
      return new URL(rawUrl, window.location.origin).pathname;
    } catch {
      return "";
    }
  };

  const requestSearch = (input) => {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url;
      if (!rawUrl) return "";
      return new URL(rawUrl, window.location.origin).search;
    } catch {
      return "";
    }
  };

  const isChatRequest = (input) => requestPath(input).endsWith("/api/chat");
  const isProcedureRequest = (input) => requestPath(input).endsWith("/api/procedure");
  const isDomainPackRequest = (input) => requestPath(input).endsWith("/api/domain-pack");

  const parseMessage = (init) => {
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return String(body.message || "consulta municipal");
    } catch {
      return "consulta municipal";
    }
  };

  const safeProxyInit = (init) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof init?.body === "string" ? init.body : JSON.stringify({ message: "consulta municipal", mode: "keyword", limit: 5 }),
    credentials: "omit",
    redirect: "error",
  });

  const safeProcedureProxyInit = () => ({
    method: "GET",
    headers: { accept: "application/json" },
    credentials: "omit",
    redirect: "error",
  });

  const demoDomainPackResponse = () => ({
    id: "municipal-antigua",
    name: "Municipal Antigua",
    language: "es",
    branding: {
      productName: "LA Muni RAG",
      assistantName: "Asistente Municipal",
      organizationName: "Municipalidad de La Antigua Guatemala",
      primaryLabel: "Antigua-first",
    },
    workflowTypes: [
      { id: "public_works", label: "Obra pública", description: "Construcción, ampliación o mejora municipal." },
      { id: "procurement", label: "Contratación", description: "Compras, adquisiciones, cotización o licitación." },
      { id: "project_closure", label: "Cierre de obra", description: "Recepción, liquidación y cierre de expediente." },
    ],
    exampleQueries: [
      "¿Qué hay que hacer para construir un estadio municipal?",
      "¿Qué falta para cerrar la obra de la escuela de San Mateo?",
    ],
    defaultQuery: "¿Qué hay que hacer para construir un estadio municipal?",
  });

  const citation = (citationLabel, excerpt, pageStart) => ({
    citationLabel,
    sourceType: "plan",
    pageStart,
    excerpt,
    sourceUrl: null,
  });

  const procedureCitation = (citationLabel, excerpt, pageStart, authorityClass = "pdm_ot") => ({
    citationLabel,
    sourceType: "plan",
    pageStart,
    excerpt,
    sourceUrl: null,
    authorityClass,
    evidenceUse: "cited_text",
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

  const procedureStep = (stepNumber, title, action, requiredDocuments, outputDocuments, citations) => ({
    stepNumber,
    title,
    action,
    requiredDocuments,
    outputDocuments,
    legalBasis: citations,
    sourceEvidence: citations,
    confidence: "medium",
    notes: "Paso de demostración: validar contra expediente y documentos oficiales de Antigua Guatemala antes de ejecutar.",
  });

  const demoProcedureResponse = (query) => {
    const citations = [
      procedureCitation(
        "PDM-OT Antigua Guatemala, pagina 170",
        "El plan refleja prioridades locales, acciones de desarrollo y alineación con prioridades nacionales.",
        170
      ),
      procedureCitation(
        "PDM-OT Antigua Guatemala, pagina 106",
        "Se mencionan capacidades productivas, participación ciudadana y elaboración de proyectos como parte de la planificación territorial.",
        106
      ),
      procedureCitation(
        "Presupuesto municipal demo, pagina 22",
        "Referencia demostrativa para explicar que todo proyecto requiere validación presupuestaria antes de contratación.",
        22,
        "budget"
      ),
    ];

    return {
      id: "procedure:pages-demo",
      title: "Flujo procedimental demo para obra pública municipal",
      jurisdiction: "Antigua Guatemala",
      procedureType: "public_works",
      confidence: "medium",
      summary:
        "Demo estática de GitHub Pages: el flujo organiza pasos típicos de obra municipal, pero debe validarse contra expediente, normativa nacional y documentos oficiales de Antigua Guatemala.",
      classification: {
        isProcedural: true,
        procedureType: "public_works",
        asksForExactDeadline: false,
        asksForCurrentStatus: /qué falta|que falta|cerrar/i.test(query),
        mentionsExternalMunicipality: false,
        retrievalQueries: [query, "obra pública proyecto municipal presupuesto contratación ejecución recepción liquidación"],
      },
      steps: [
        procedureStep(1, "Clasificar el proyecto", "Determinar si la iniciativa es obra pública, inversión nueva, ampliación o mantenimiento.", ["Perfil del proyecto", "Justificación técnica", "Ubicación o terreno"], ["Clasificación preliminar"], citations.slice(0, 2)),
        procedureStep(2, "Validar planificación y presupuesto", "Cruzar la obra con planificación municipal, POA/POM y disponibilidad presupuestaria.", ["PDM-OT", "POA/POM", "Presupuesto"], ["Validación de alineación y financiamiento"], citations),
        procedureStep(3, "Preparar expediente técnico", "Integrar especificaciones, planos, presupuesto detallado, dictámenes y cronograma.", ["Especificaciones técnicas", "Planos", "Presupuesto detallado", "Dictamen técnico"], ["Expediente técnico"], citations.slice(0, 2)),
        procedureStep(4, "Definir modalidad de contratación", "Determinar la modalidad aplicable según monto, objeto y normativa.", ["Monto estimado", "Objeto contractual", "Base normativa"], ["Modalidad de contratación definida"], citations),
        procedureStep(5, "Ejecutar, supervisar y documentar", "Formalizar contrato, supervisar avances y conservar evidencias del expediente.", ["Contrato", "Orden de inicio", "Informes de supervisión"], ["Expediente de ejecución"], citations),
        procedureStep(6, "Recepción, liquidación y cierre", "Verificar acta de recepción, pagos, liquidación y cierre documental antes de afirmar cierre institucional.", ["Acta de recepción", "Estimaciones/pagos", "Liquidación", "Expediente completo"], ["Expediente de cierre"], citations),
      ],
      gaps: [
        {
          missingItem: "Expediente específico del proyecto",
          whyItMatters: "Sin expediente no se puede afirmar estado actual, cierre, recepción o liquidación.",
          requiredToConfirm: "Contrato, actas, informes de supervisión, pagos y liquidación del caso.",
          severity: "blocking",
        },
        {
          missingItem: "Validación jurídica/técnica municipal",
          whyItMatters: "La ruta exacta puede depender de monto, fuente de financiamiento, unidad ejecutora y normativa aplicable.",
          requiredToConfirm: "Revisión de Gerencia Municipal, DAFIM, Asesoría Jurídica y unidad técnica.",
          severity: "important",
        },
      ],
      citations,
      validationWarning:
        "Este flujo de demostración organiza evidencia documental y no sustituye validación de Gerencia Municipal, DAFIM, Asesoría Jurídica, unidad técnica, Concejo Municipal o COCODE cuando corresponda.",
      metadata: {
        domainPackId: "municipal-antigua",
        domainPackName: "Municipal Antigua",
        query,
        retrievalMode: "keyword",
        evidenceCount: citations.length,
        hasLocalEvidence: true,
        hasExternalReference: false,
        hasAntiguaEvidence: true,
        generatedBy: "procedure_workflow_advisor_mvp",
        demoMode: true,
      },
    };
  };

  window.fetch = async (input, init) => {
    if (!isChatRequest(input) && !isProcedureRequest(input) && !isDomainPackRequest(input)) return nativeFetch(input, init);

    if (isDomainPackRequest(input)) {
      if (shouldProxy) {
        const targetUrl = new URL("/api/domain-pack", configuredApiUrl).href;
        return nativeFetch(targetUrl, safeProcedureProxyInit());
      }

      return new Response(JSON.stringify(demoDomainPackResponse()), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-la-muni-rag-demo": "true",
        },
      });
    }

    if (isProcedureRequest(input)) {
      if (shouldProxy) {
        const targetUrl = new URL(`/api/procedure${requestSearch(input)}`, configuredApiUrl).href;
        return nativeFetch(targetUrl, safeProcedureProxyInit());
      }

      const query = new URLSearchParams(requestSearch(input)).get("q") || "procedimiento municipal";
      return new Response(JSON.stringify(demoProcedureResponse(query)), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-la-muni-rag-demo": "true",
        },
      });
    }

    if (shouldProxy) {
      const targetUrl = new URL("/api/chat", configuredApiUrl).href;
      return nativeFetch(targetUrl, safeProxyInit(init));
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
