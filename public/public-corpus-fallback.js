/**
 * LA Muni RAG — static public corpus resilience layer.
 *
 * This is a read-only resilience layer for the public GitHub Pages pilot.
 * Pages uses it as the primary public route so a stopped managed backend does
 * not generate browser errors; remote-first integrations can still use it only
 * after 502/503/504 or transport failure. It performs deterministic lexical retrieval
 * over a frozen projection of three official public PDM-OT documents. It does
 * not provide semantic search, server audit, identity, or a legal conclusion.
 */
(() => {
  "use strict";

  const scriptTag = document.currentScript;
  const baseUrl = scriptTag?.src ? new URL("./", scriptTag.src) : new URL("./", window.location.href);
  const corpusUrl = new URL("public-corpus-snapshot.json", baseUrl).href;
  const domainUrl = new URL("public-domain-pack-snapshot.json", baseUrl).href;
  const nativeFetch = window.fetch.bind(window);
  const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;
  const MAX_QUERY = 800;
  const STOPWORDS = new Set([
    "a", "al", "algo", "como", "con", "cual", "de", "del", "el", "en", "es", "esta", "este", "hay",
    "la", "las", "lo", "los", "me", "municipal", "municipio", "para", "por", "que", "qué", "se", "sin",
    "sobre", "su", "sus", "un", "una", "y",
  ]);

  let corpusPromise;
  let domainPromise;

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("es-GT")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  const boundedText = (value, maximum) => {
    const normalized = String(value ?? "").replace(/\s+/gu, " ").trim();
    if (!normalized || CONTROL_CHARACTER.test(normalized)) return "";
    return normalized.length <= maximum ? normalized : `${normalized.slice(0, Math.max(1, maximum - 1))}…`;
  };

  const uuid = () => globalThis.crypto?.randomUUID?.() ?? `static-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-la-muni-rag-static-fallback": "true",
    },
  });

  const publicError = (status, code, retryable = false) => jsonResponse(status, {
    schema_version: "v1",
    response_type: "public_error",
    request_id: uuid(),
    error: { code, message: code === "invalid_request" ? "Request validation failed" : "Public fallback unavailable", retryable },
  });

  const loadJson = async (url) => {
    const response = await nativeFetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "force-cache",
    });
    if (!response.ok) throw new Error(`Static public artifact unavailable: HTTP ${response.status}`);
    return response.json();
  };

  const loadCorpus = async () => {
    if (!corpusPromise) corpusPromise = loadJson(corpusUrl).then((snapshot) => {
      if (snapshot?.schemaVersion !== 1 || snapshot?.corpusKind !== "public_official_municipal_static_projection_v1") {
        throw new Error("Unsupported public corpus snapshot");
      }
      if (!Array.isArray(snapshot.sources) || snapshot.sources.length !== 3 || !Array.isArray(snapshot.sections) || snapshot.sections.length < 250) {
        throw new Error("Incomplete public corpus snapshot");
      }
      return {
        ...snapshot,
        searchSections: snapshot.sections.map((section) => ({ ...section, normalizedText: normalize(section.text) })),
      };
    });
    return corpusPromise;
  };

  const loadDomain = async () => {
    if (!domainPromise) domainPromise = loadJson(domainUrl).then((snapshot) => {
      if (snapshot?.schemaVersion !== 1 || snapshot?.ui?.id !== "municipal-antigua") throw new Error("Unsupported public domain snapshot");
      return snapshot;
    });
    return domainPromise;
  };

  const tokensFor = (query) => [...new Set(normalize(query).split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token)))]
    .slice(0, 18);

  const expandedTokensFor = (query, tokens) => {
    const normalized = normalize(query);
    const extras = [];
    if (/\b(necesidad|necesidades|urgente|urgentes|prioridad|prioridades|problematica|problematicas)\b/u.test(normalized)) {
      extras.push("priorizacion", "problematicas", "problemas");
    }
    return [...new Set([...tokens, ...extras])].slice(0, 22);
  };

  const tokenCount = (text, token) => {
    let count = 0;
    let offset = 0;
    while (count < 8) {
      const found = text.indexOf(token, offset);
      if (found < 0) break;
      count += 1;
      offset = found + token.length;
    }
    return count;
  };

  const scoreSection = (section, query, mode, tokens) => {
    const text = section.normalizedText;
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return 0;
    if (mode === "phrase") return text.includes(normalizedQuery) ? 100 + Math.min(20, tokenCount(text, normalizedQuery)) : 0;
    let matched = 0;
    let occurrences = 0;
    for (const token of tokens) {
      const count = tokenCount(text, token);
      if (count > 0) matched += 1;
      occurrences += count;
    }
    if (matched === 0) return 0;
    const exactBoost = text.includes(normalizedQuery) ? 20 : 0;
    const coverage = matched / Math.max(1, tokens.length);
    const title = normalize(section.title);
    const titleBoost = tokens.some((token) => title.includes(token)) ? 1.5 : 0;
    return exactBoost + coverage * 12 + Math.min(8, occurrences * 0.6) + titleBoost;
  };

  const excerptFor = (text, tokens) => {
    const sentences = String(text).split(/(?<=[.!?;:])\s+/u).filter(Boolean);
    let best = "";
    let bestScore = -1;
    for (const sentence of sentences) {
      const normalizedSentence = normalize(sentence);
      let score = 0;
      for (const token of tokens) if (normalizedSentence.includes(token)) score += 1;
      if (score > bestScore) {
        best = sentence;
        bestScore = score;
      }
    }
    if (!best) best = String(text).slice(0, 700);
    const index = Math.max(0, sentences.indexOf(best));
    const joined = sentences.slice(index, index + 2).join(" ") || best;
    return boundedText(joined, 700);
  };

  const search = async (query, mode = "keyword", limit = 5) => {
    const corpus = await loadCorpus();
    const baseTokens = tokensFor(query);
    const tokens = mode === "keyword" ? expandedTokensFor(query, baseTokens) : baseTokens;
    if (!tokens.length && mode !== "phrase") return [];
    return corpus.searchSections
      .map((section) => ({ section, score: scoreSection(section, query, mode, tokens) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.section.sourceId.localeCompare(right.section.sourceId) || left.section.pageStart - right.section.pageStart)
      .slice(0, Math.max(1, Math.min(Number(limit) || 5, 12)))
      .map(({ section, score }) => ({
        ...section,
        score,
        excerpt: excerptFor(section.text, tokens.length ? tokens : [normalize(query)]),
        matchedModes: [mode === "phrase" ? "phrase" : "keyword"],
      }));
  };

  const citationFrom = (candidate, evidenceStatus = "supported") => ({
    citationLabel: `${candidate.title}, página ${candidate.pageStart}`,
    sourceType: "plan",
    title: candidate.title,
    documentTitle: candidate.title,
    pageStart: candidate.pageStart,
    pageEnd: candidate.pageEnd,
    articleNumber: null,
    excerpt: boundedText(candidate.excerpt, 700),
    sourceUrl: candidate.sourceUrl,
    authorityStatus: "official_target_jurisdiction",
    temporalStatus: "undetermined",
    evidenceStatus,
    score: candidate.score,
    retrievalMode: candidate.matchedModes[0] ?? "keyword",
    matchedModes: candidate.matchedModes,
  });

  const parseQueryBody = (bodyText) => {
    let body;
    try { body = JSON.parse(bodyText || "{}"); } catch { return null; }
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const keys = Object.keys(body).sort().join(",");
    if (keys !== "limit,message,mode") return null;
    const message = boundedText(body.message, MAX_QUERY);
    const mode = body.mode;
    const limit = Number(body.limit);
    if (!message || (mode !== "keyword" && mode !== "phrase") || !Number.isInteger(limit) || limit < 1 || limit > 5) return null;
    return { message, mode, limit };
  };

  const queryResponse = async (bodyText) => {
    const request = parseQueryBody(bodyText);
    if (!request) return publicError(400, "invalid_request");
    const candidates = await search(request.message, request.mode, request.limit);
    const citations = candidates.map((candidate) => citationFrom(candidate));
    const responseLabel = citations.length ? "evidence_found" : "not_found";
    const confidence = citations.length >= 2 ? "high" : citations.length === 1 ? "medium" : "low";
    const content = citations.length
      ? `Encontré **${citations.length} fragmentos documentales públicos** relacionados con la consulta. Revisa las citas, la vigencia y la aplicabilidad antes de usar esta orientación como conclusión institucional.`
      : "No encontré evidencia documental pública suficiente en la proyección disponible. Intenta una consulta más específica o solicita la incorporación y revisión de la fuente correspondiente.";
    return jsonResponse(200, {
      schema_version: "v1",
      response_type: "public_query",
      request_id: uuid(),
      role: "assistant",
      content,
      citations,
      meta: {
        responseLabel,
        confidence,
        evidenceCount: citations.length,
        suggestedAction: citations.length
          ? "Revisa la cita, la vigencia y la aplicabilidad antes de tomar una decisión."
          : "Reformula la consulta o solicita la incorporación y revisión de una fuente documental.",
        requestedMode: request.mode,
        executedModes: [request.mode],
        jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
        asOfDate: new Date().toISOString().slice(0, 10),
        limitations: [
          "Fallback estático de una proyección pública de tres documentos oficiales PDM-OT.",
          "La búsqueda compara palabras y frases de forma determinista; esta copia pública no ejecuta búsqueda semántica.",
          "La vigencia, aplicabilidad y completitud requieren revisión de las fuentes citadas.",
        ],
      },
    });
  };

  const classifyProcedure = (query, domain) => {
    const normalized = normalize(query);
    for (const rule of domain.classifierRules) {
      if (rule.id === "generic") continue;
      if (rule.keywords.some((keyword) => normalized.includes(normalize(keyword)))) return rule;
    }
    return domain.classifierRules.find((rule) => rule.id === "generic") ?? { workflowType: "unknown", retrievalQueries: [] };
  };

  const uniqueCitations = (citations, limit = 12) => {
    const seen = new Set();
    const result = [];
    for (const citation of citations) {
      const key = `${citation.sourceUrl}|${citation.pageStart}|${citation.excerpt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(citation);
      if (result.length >= limit) break;
    }
    return result;
  };

  const procedureResponse = async (requestUrl) => {
    const query = boundedText(requestUrl.searchParams.get("q"), MAX_QUERY);
    const mode = requestUrl.searchParams.get("mode") || "keyword";
    const depth = requestUrl.searchParams.get("depth") || "overview";
    const limit = Number(requestUrl.searchParams.get("limit") || 8);
    if (!query || !["keyword", "phrase", "hybrid"].includes(mode) || !["overview", "deep_dive"].includes(depth) || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      return publicError(400, "invalid_request");
    }

    const domain = await loadDomain();
    const rule = classifyProcedure(query, domain);
    const template = domain.workflowTemplates.find((item) => item.workflowType === rule.workflowType)
      ?? domain.workflowTemplates.find((item) => item.workflowType === "unknown");
    if (!template) return publicError(503, "service_unavailable", true);

    const queryModes = mode === "hybrid" ? ["keyword", "phrase"] : [mode];
    const queryCandidates = [];
    let retrievalQueryCount = 0;
    for (const retrievalMode of queryModes) {
      queryCandidates.push(...await search(query, retrievalMode, Math.min(limit, 12)));
      retrievalQueryCount += 1;
    }
    for (const retrievalQuery of (rule.retrievalQueries ?? []).slice(0, depth === "deep_dive" ? 4 : 2)) {
      queryCandidates.push(...await search(retrievalQuery, "keyword", Math.min(limit, 8)));
      retrievalQueryCount += 1;
    }

    const steps = [];
    const gaps = [];
    const allCitations = [];
    let supportedStepCount = 0;
    for (let index = 0; index < template.steps.length; index += 1) {
      const step = template.steps[index];
      const patterns = (step.evidencePatterns ?? []).filter(Boolean);
      let evidenceCandidates = [];
      if (patterns.length) evidenceCandidates = await search(patterns.join(" "), "keyword", 3);
      const sourceEvidence = uniqueCitations(evidenceCandidates.map((candidate) => citationFrom(candidate, "validation_required")), 2);
      const hasEvidence = sourceEvidence.length > 0;
      if (hasEvidence) supportedStepCount += 1;
      allCitations.push(...sourceEvidence);
      steps.push({
        stepNumber: index + 1,
        sequence: index + 1,
        title: step.title,
        action: step.action,
        requiredDocuments: step.requiredDocuments ?? [],
        outputDocuments: step.outputDocuments ?? [],
        sourceEvidence,
        legalBasis: [],
        confidence: hasEvidence ? "medium" : "low",
        evidenceStatus: hasEvidence ? "inferred_for_review" : "missing_evidence",
        notes: hasEvidence
          ? "La evidencia recuperada es contextual y requiere validación humana antes de tratar este paso como obligatorio."
          : (step.notes || "No se encontró evidencia suficiente en la proyección pública para confirmar este paso."),
      });
      if (!hasEvidence) gaps.push({
        missingItem: `Evidencia para: ${step.title}`,
        whyItMatters: "Los documentos públicos disponibles no contienen un fragmento suficiente para confirmar este paso como un procedimiento aplicable.",
        requiredToConfirm: "Fuente oficial vigente y aplicable, más validación de la unidad municipal competente.",
        severity: "important",
      });
    }

    const topQueryCitations = uniqueCitations(queryCandidates.map((candidate) => citationFrom(candidate, "validation_required")), 8);
    const citations = uniqueCitations([...allCitations, ...topQueryCitations], 12);
    const coveragePercent = template.steps.length ? Math.round((supportedStepCount / template.steps.length) * 100) : 0;
    const confidence = supportedStepCount === template.steps.length && supportedStepCount > 1 ? "high" : supportedStepCount > 0 ? "medium" : "low";

    return jsonResponse(200, {
      schema_version: "v1",
      response_type: "public_procedure",
      request_id: uuid(),
      procedureType: rule.workflowType,
      title: template.title,
      summary: `${template.defaultSummary} Este fallback sólo marca evidencia contextual y deja explícitas las brechas que requieren confirmación.`,
      jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
      confidence,
      steps,
      gaps,
      citations,
      validationWarning: template.validationWarning,
      metadata: {
        domainPackId: domain.ui.id,
        domainPackName: domain.ui.name,
        evidenceCount: citations.length,
        supportedStepCount,
        pendingStepCount: Math.max(0, template.steps.length - supportedStepCount),
        coveragePercent,
        retrievalQueryCount,
        hasExternalReference: false,
        staticFallback: true,
        semanticSearch: false,
        serverAudit: false,
      },
    });
  };

  const handle = async ({ targetPath, requestUrl, method, body }) => {
    try {
      if (targetPath === "/api/public/v1/query" && method === "POST") return queryResponse(body);
      if (targetPath === "/api/public/v1/domain-pack" && method === "GET") {
        const domain = await loadDomain();
        return jsonResponse(200, domain.ui);
      }
      if (targetPath === "/api/public/v1/procedure" && method === "GET") return procedureResponse(requestUrl);
      return publicError(405, "method_not_allowed");
    } catch {
      return publicError(503, "service_unavailable", true);
    }
  };

  window.__LA_MUNI_PUBLIC_FALLBACK__ = Object.freeze({
    available: true,
    corpusUrl,
    domainUrl,
    handle,
  });
})();
