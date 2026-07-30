(() => {
  "use strict";

  const PROGRESS_KEY = "la-muni-rag:training-progress:v1";
  const MISSING_EVIDENCE = "Documento o regla pendiente de localizar y validar.";
  const REQUEST_ASSERTION_STATUS = "requester_supplied_unverified";
  const KEYBOARD_KEYS = ["ArrowDown", "ArrowUp", "Home", "End"];
  const EVIDENCE_STATUSES = new Set([
    "supported",
    "inferred_for_review",
    "comparative_reference",
    "missing_evidence",
  ]);

  const byId = (id) => document.getElementById(id);
  const elements = {
    status: byId("training-status"),
    lessonList: byId("lesson-list"),
    progressCount: byId("progress-count"),
    progressBar: byId("progress-bar"),
    clearProgress: byId("clear-progress"),
    lessonContent: byId("lesson-content"),
    lessonSequence: byId("lesson-sequence"),
    lessonTitle: byId("lesson-title"),
    lessonSummary: byId("lesson-summary"),
    lessonObjective: byId("lesson-objective"),
    lessonEvidenceStatus: byId("lesson-evidence-status"),
    lessonAction: byId("lesson-action"),
    lessonParticipants: byId("lesson-participants"),
    lessonDocuments: byId("lesson-documents"),
    lessonDecisions: byId("lesson-decisions"),
    lessonRisks: byId("lesson-risks"),
    citationCount: byId("citation-count"),
    evidenceSummary: byId("evidence-summary"),
    citationList: byId("citation-list"),
    gapList: byId("gap-list"),
    categoryGrid: byId("research-category-grid"),
    previousLesson: byId("previous-lesson"),
    nextLesson: byId("next-lesson"),
    markUnderstood: byId("mark-understood"),
    knowledgeCheck: byId("knowledge-check"),
    knowledgeFeedback: byId("knowledge-feedback"),
    moduleSelect: byId("training-module"),
  };

  const state = {
    module: null,
    workflow: null,
    lessons: [],
    activeIndex: 0,
    completedLessonIds: new Set(),
  };

  const createNode = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  const emptyNode = (node) => {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  const safeArray = (value) => Array.isArray(value) ? value : [];
  const boundedText = (value, fallback = MISSING_EVIDENCE, max = 900) => {
    const text = typeof value === "string" ? value.trim() : "";
    return (text || fallback).slice(0, max);
  };
  const uniqueText = (values, max = 12) => {
    const seen = new Set();
    const result = [];
    for (const value of values ?? []) {
      const text = boundedText(value, "", 600);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
      if (result.length >= max) break;
    }
    return result;
  };

  const setStatus = (status, message) => {
    elements.status.dataset.state = status;
    const messageNode = elements.status.querySelector("span:last-child");
    if (messageNode) messageNode.textContent = message;
  };

  const safeHttpUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const parsed = new URL(value, window.location.href);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  };

  const validateCurriculum = (module) => {
    if (
      module?.schema_version !== "v1" ||
      module?.research_not_facts !== true ||
      !Array.isArray(module?.groups) ||
      module.groups.length < 6 ||
      module.groups.length > 10 ||
      !Array.isArray(module?.research_categories) ||
      module.research_categories.length !== 47
    ) return false;
    const expected = Array.from({ length: 47 }, (_, index) => index + 1);
    const categorySequences = module.research_categories.map((item) => Number(item?.sequence));
    const groupSequences = module.groups.flatMap((group) => safeArray(group?.category_sequences).map(Number));
    return (
      new Set(module.research_categories.map((item) => boundedText(item?.label, "", 300))).size === 47 &&
      JSON.stringify(categorySequences) === JSON.stringify(expected) &&
      JSON.stringify(groupSequences) === JSON.stringify(expected)
    );
  };

  const readProgress = () => {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      if (!raw || !state.module) return new Set();
      const parsed = JSON.parse(raw);
      if (
        parsed?.schema_version !== "v1" ||
        parsed?.module_id !== state.module.module_id ||
        !Array.isArray(parsed?.completed_lesson_ids)
      ) return new Set();
      const allowed = new Set(state.lessons.map((lesson) => lesson.id));
      return new Set(parsed.completed_lesson_ids.filter((id) => allowed.has(id)));
    } catch {
      return new Set();
    }
  };

  const writeProgress = () => {
    if (!state.module) return false;
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        schema_version: "v1",
        module_id: state.module.module_id,
        completed_lesson_ids: [...state.completedLessonIds].sort(),
      }));
      return true;
    } catch {
      return false;
    }
  };

  const clearTrainingProgress = () => {
    try {
      window.localStorage.removeItem(PROGRESS_KEY);
    } catch {
      setStatus("dependency_failure", "El navegador no permitió borrar progreso local. No se almacenan datos de caso.");
      return;
    }
    state.completedLessonIds.clear();
    renderLessonList();
    renderActiveLesson();
    setStatus("success", "Progreso local borrado. El contenido de capacitación permanece disponible.");
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const fetchProcedure = async (module) => {
    const params = new URLSearchParams({ q: module.query, mode: "keyword", limit: "8", depth: "deep_dive" });
    const response = await fetch(`/api/procedure?${params.toString()}`, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const normalizeCitation = (value, index) => {
    if (!value || typeof value !== "object") return null;
    return {
      title: boundedText(value.title ?? value.documentTitle ?? value.document_title, `Fuente ${index + 1}`, 240),
      label: boundedText(value.label ?? value.citationLabel ?? value.citation_label, "Ubicación citable pendiente", 240),
      excerpt: boundedText(value.excerpt ?? value.snippet, "Extracto no disponible en esta vista.", 1000),
      authority: boundedText(value.authority_status ?? value.authorityStatus ?? value.authorityLevel, "Autoridad pendiente", 120),
      jurisdiction: boundedText(value.jurisdiction ?? value.source_jurisdiction, "Jurisdicción pendiente", 220),
      page: value.page_start ?? value.pageStart ?? null,
      url: safeHttpUrl(value.source_url ?? value.sourceUrl ?? value.url),
    };
  };

  const citationsForStep = (step, workflow) => {
    const direct = [
      ...safeArray(step?.sourceEvidence).slice(0, 24),
      ...safeArray(step?.source_evidence).slice(0, 24),
      ...safeArray(step?.citations).slice(0, 24),
    ];
    if (direct.length) return direct.slice(0, 32).map(normalizeCitation).filter(Boolean).slice(0, 8);

    const refs = new Set([
      ...safeArray(step?.citationRefs),
      ...safeArray(step?.citation_refs),
      ...safeArray(step?.legalBasis),
      ...safeArray(step?.legal_basis),
    ].map(String));
    return safeArray(workflow?.citations)
      .filter((item) => refs.has(String(item?.citation_id ?? item?.citationId ?? "")))
      .map(normalizeCitation)
      .filter(Boolean)
      .slice(0, 8);
  };

  const evidenceStatusFor = (step, citations) => {
    const raw = String(step?.evidenceStatus ?? step?.evidence_status ?? "").trim();
    if (EVIDENCE_STATUSES.has(raw)) {
      return raw === "missing_evidence" || citations.length > 0 ? raw : "missing_evidence";
    }
    if ((raw === "supported" || raw === "sufficient") && citations.length > 0) return "supported";
    if ((raw === "comparative" || raw === "external_reference") && citations.length > 0) return "comparative_reference";
    if ((raw === "inferred" || raw === "partial") && citations.length > 0) return "inferred_for_review";
    if (citations.length > 0) return "inferred_for_review";
    return "missing_evidence";
  };

  const stepSequence = (step) => Number(step?.sequence ?? step?.stepNumber);

  const stepsForGroup = (workflow, group, index) => {
    const steps = safeArray(workflow?.steps).slice(0, 100);
    const sequences = new Set(group.category_sequences.map(Number));
    const matching = steps.filter((step) => sequences.has(stepSequence(step)));
    if (matching.length > 0) return matching;
    return steps[index] ? [steps[index]] : [];
  };

  const uniqueCitations = (citations) => {
    const seen = new Set();
    const result = [];
    for (const citation of citations) {
      const key = [citation.title, citation.label, citation.excerpt, citation.url].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(citation);
      if (result.length >= 12) break;
    }
    return result;
  };

  const aggregateEvidenceStatus = (statuses) => {
    if (!statuses.length || statuses.includes("missing_evidence")) return "missing_evidence";
    if (statuses.every((status) => status === "supported")) return "supported";
    if (statuses.every((status) => status === "comparative_reference")) return "comparative_reference";
    return "inferred_for_review";
  };

  const buildLesson = (group, index) => {
    const steps = stepsForGroup(state.workflow, group, index);
    const evidence = steps.map((step) => {
      const citations = citationsForStep(step, state.workflow);
      return { step, citations, status: evidenceStatusFor(step, citations) };
    });
    const citations = uniqueCitations(evidence.flatMap((item) => item.citations));
    const evidenceStatus = aggregateEvidenceStatus(evidence.map((item) => item.status));
    const participants = uniqueText(evidence.flatMap(({ step, citations: stepCitations }) => {
      const participantEvidenceStatus = String(
        step?.participant_evidence_status ?? step?.participantEvidenceStatus ?? ""
      );
      if (participantEvidenceStatus === "supported" && stepCitations.length > 0) {
        return [
          step?.responsible_actor,
          step?.responsibleActor,
          step?.responsible_unit,
          step?.responsibleUnit,
        ];
      }
      return [];
    }));
    const required = uniqueText(evidence.flatMap(({ step }) => [
      ...safeArray(step?.requiredDocuments).map((item) => {
        if (typeof item === "string") return `${item} · inferred_for_review`;
        const status = EVIDENCE_STATUSES.has(String(item?.evidence_status))
          ? String(item.evidence_status)
          : "inferred_for_review";
        return item?.name ? `${item.name} · ${status}` : "";
      }),
      ...safeArray(step?.required_documents).map((item) => {
        if (typeof item === "string") return `${item} · inferred_for_review`;
        const status = EVIDENCE_STATUSES.has(String(item?.evidence_status))
          ? String(item.evidence_status)
          : "inferred_for_review";
        return item?.name ? `${item.name} · ${status}` : "";
      }),
    ]));
    const outputs = uniqueText(evidence.flatMap(({ step }) => [
      ...safeArray(step?.outputDocuments),
      ...safeArray(step?.output_documents),
    ]));
    const actions = uniqueText(evidence.map(({ step }) => step?.action), 8);
    const decisions = uniqueText([
      ...evidence.flatMap(({ step }) => [
        ...safeArray(step?.preconditions),
        ...safeArray(step?.dependsOn).map((value) => `Depende de validar la fase o paso ${value}.`),
      ]),
      group.decision_prompt,
    ]);
    const risks = uniqueText([
      ...evidence.flatMap(({ step }) => [
        ...safeArray(step?.risks),
        ...safeArray(step?.unknowns),
      ]),
      group.risk_prompt,
      evidenceStatus === "missing_evidence" ? MISSING_EVIDENCE : "",
    ]);
    const gaps = uniqueText([
      ...evidence.flatMap(({ step }) => safeArray(step?.unknowns)),
      ...(evidenceStatus === "missing_evidence" ? [MISSING_EVIDENCE] : []),
      ...(participants.length ? [] : ["Actor y unidad responsable pendientes de evidencia específica."]),
      ...(required.length ? [] : ["Documentos requeridos pendientes de evidencia."]),
    ], 8);

    return {
      id: group.id,
      sequence: index + 1,
      title: group.title,
      summary: group.summary,
      objective: group.learning_objective,
      action: actions.length
        ? boundedText(`Investigar y validar: ${actions.join(" · ")}`, group.action_prompt, 1200)
        : boundedText(group.action_prompt),
      participants: participants.length ? participants : ["Pendiente de evidencia específica: actor y unidad responsable."],
      documents: uniqueText([
        ...required.map((item) => `Requerido: ${item}`),
        ...outputs.map((item) => `Salida: ${item}`),
      ]),
      decisions,
      risks,
      citations,
      evidenceStatus,
      gaps,
      categorySequences: group.category_sequences,
      requestAssertionStatus: REQUEST_ASSERTION_STATUS,
    };
  };

  const categoryEvidence = (category) => {
    const step = safeArray(state.workflow?.steps).find((item) => stepSequence(item) === category.sequence);
    const citations = citationsForStep(step, state.workflow);
    return {
      status: evidenceStatusFor(step, citations),
      citationCount: citations.length,
    };
  };

  const renderList = (node, values) => {
    emptyNode(node);
    for (const value of values.length ? values : [MISSING_EVIDENCE]) {
      node.appendChild(createNode("li", "", value));
    }
  };

  const evidenceSummary = (lesson) => {
    if (lesson.evidenceStatus === "supported") return `La fase tiene ${lesson.citations.length} cita(s) específicas. Requiere revisión humana antes de ejecución.`;
    if (lesson.evidenceStatus === "inferred_for_review") return `Hay ${lesson.citations.length} referencia(s), pero el respaldo permanece como inferencia para revisión.`;
    if (lesson.evidenceStatus === "comparative_reference") return "La evidencia es comparativa. No define por sí sola el procedimiento de La Antigua Guatemala.";
    return "No existe una cita suficiente para presentar esta fase como respaldada. Pendiente de evidencia.";
  };

  const renderCitations = (lesson) => {
    emptyNode(elements.citationList);
    elements.citationCount.textContent = `${lesson.citations.length} cita${lesson.citations.length === 1 ? "" : "s"}`;
    elements.evidenceSummary.textContent = evidenceSummary(lesson);

    if (!lesson.citations.length) {
      const card = createNode("section", "citation-card");
      card.appendChild(createNode("h3", "", "Sin cita verificable en esta fase"));
      card.appendChild(createNode("p", "", MISSING_EVIDENCE));
      card.appendChild(createNode("p", "citation-meta", `Entrada externa: ${lesson.requestAssertionStatus}`));
      elements.citationList.appendChild(card);
      return;
    }

    lesson.citations.forEach((citation, index) => {
      const card = createNode("article", "citation-card");
      card.appendChild(createNode("h3", "", citation.title));
      card.appendChild(createNode("p", "citation-meta", `${citation.label}${citation.page ? ` · página ${citation.page}` : ""}`));
      card.appendChild(createNode("p", "", citation.excerpt));
      card.appendChild(createNode("p", "citation-meta", `${citation.authority} · ${citation.jurisdiction}`));
      if (citation.url) {
        const link = createNode("a", "", `Abrir fuente ${index + 1}`);
        link.href = citation.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        card.appendChild(link);
      }
      elements.citationList.appendChild(card);
    });
  };

  const updateProgress = () => {
    const total = state.lessons.length || 1;
    elements.progressCount.textContent = `${state.completedLessonIds.size}/${state.lessons.length}`;
    elements.progressBar.style.width = `${Math.round((state.completedLessonIds.size / total) * 100)}%`;
  };

  const renderLessonList = () => {
    emptyNode(elements.lessonList);
    state.lessons.forEach((lesson, index) => {
      const button = createNode("button", "lesson-tab");
      button.type = "button";
      button.id = `lesson-tab-${lesson.id}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "lesson-content");
      button.setAttribute("aria-selected", index === state.activeIndex ? "true" : "false");
      if (index === state.activeIndex) button.setAttribute("aria-current", "step");
      button.tabIndex = index === state.activeIndex ? 0 : -1;
      button.appendChild(createNode("span", "lesson-tab-number", lesson.sequence));
      const copy = createNode("span");
      copy.appendChild(createNode("strong", "", lesson.title.replace(/^\d+\.\s*/, "")));
      copy.appendChild(createNode("small", "", `${lesson.categorySequences.length} categorías`));
      button.appendChild(copy);
      button.appendChild(createNode("span", "lesson-tab-check", state.completedLessonIds.has(lesson.id) ? "✓" : ""));
      button.addEventListener("click", () => {
        selectLesson(index);
        elements.lessonList.querySelectorAll(".lesson-tab")[index]?.focus();
      });
      elements.lessonList.appendChild(button);
    });
  };

  const renderActiveLesson = (focusContent = false) => {
    const lesson = state.lessons[state.activeIndex];
    if (!lesson) return;
    elements.lessonSequence.textContent = `Fase ${lesson.sequence} de ${state.lessons.length}`;
    elements.lessonContent.setAttribute(
      "aria-labelledby",
      `lesson-tab-${lesson.id} lesson-title`
    );
    elements.lessonTitle.textContent = lesson.title;
    elements.lessonSummary.textContent = lesson.summary;
    elements.lessonObjective.textContent = lesson.objective;
    elements.lessonAction.textContent = lesson.action;
    elements.lessonEvidenceStatus.textContent = lesson.evidenceStatus;
    elements.lessonEvidenceStatus.dataset.evidenceStatus = lesson.evidenceStatus;
    renderList(elements.lessonParticipants, lesson.participants);
    renderList(elements.lessonDocuments, lesson.documents);
    renderList(elements.lessonDecisions, lesson.decisions);
    renderList(elements.lessonRisks, lesson.risks);
    renderList(elements.gapList, lesson.gaps);
    renderCitations(lesson);
    const understood = state.completedLessonIds.has(lesson.id);
    elements.markUnderstood.textContent = understood ? "Comprendido en este navegador" : "Marcar como comprendido";
    elements.markUnderstood.setAttribute("aria-pressed", understood ? "true" : "false");
    elements.previousLesson.disabled = state.activeIndex === 0;
    elements.nextLesson.disabled = state.activeIndex === state.lessons.length - 1;
    elements.knowledgeCheck.reset();
    elements.knowledgeFeedback.textContent = "";
    updateProgress();
    if (focusContent) elements.lessonContent.focus();
  };

  const selectLesson = (index, focusContent = false) => {
    if (!Number.isInteger(index) || index < 0 || index >= state.lessons.length) return;
    state.activeIndex = index;
    renderLessonList();
    renderActiveLesson(focusContent);
  };

  const renderCategoryMap = () => {
    emptyNode(elements.categoryGrid);
    for (const category of state.module.research_categories) {
      const card = createNode("article", "research-category");
      const evidence = categoryEvidence(category);
      card.dataset.evidenceStatus = evidence.status;
      card.appendChild(createNode("span", "", `Categoría ${category.sequence}`));
      card.appendChild(createNode("strong", "", category.label));
      card.appendChild(createNode("p", "category-evidence", `${evidence.status} · ${evidence.citationCount} cita${evidence.citationCount === 1 ? "" : "s"}`));
      card.appendChild(createNode("p", "", category.evidence_prompt));
      elements.categoryGrid.appendChild(card);
    }
  };

  const renderAll = () => {
    state.lessons = state.module.groups.map(buildLesson);
    state.completedLessonIds = readProgress();
    renderLessonList();
    renderActiveLesson();
    renderCategoryMap();
  };

  const loadTraining = async () => {
    setStatus("loading", "Cargando mapa de investigación y evidencia disponible…");
    try {
      state.module = await fetchJson("./data/water-training-map.json");
      if (!validateCurriculum(state.module)) throw new Error("invalid curriculum");

      try {
        state.workflow = await fetchProcedure(state.module);
        setStatus("success", "Mapa cargado. La evidencia disponible se presenta con sus límites y brechas.");
      } catch {
        state.workflow = null;
        setStatus("dependency_failure", "La API no está disponible. Usando el currículo estático con evidencia pendiente explícita.");
      }
      renderAll();
    } catch {
      setStatus("validation_error", "No se pudo validar el mapa de capacitación. Recarga la página o vuelve al inicio.");
    }
  };

  elements.previousLesson.addEventListener("click", () => selectLesson(state.activeIndex - 1, true));
  elements.nextLesson.addEventListener("click", () => selectLesson(state.activeIndex + 1, true));
  elements.clearProgress.addEventListener("click", clearTrainingProgress);
  elements.markUnderstood.addEventListener("click", () => {
    const lesson = state.lessons[state.activeIndex];
    if (!lesson) return;
    if (state.completedLessonIds.has(lesson.id)) state.completedLessonIds.delete(lesson.id);
    else state.completedLessonIds.add(lesson.id);
    const stored = writeProgress();
    renderLessonList();
    renderActiveLesson();
    setStatus(
      stored ? "success" : "dependency_failure",
      stored
        ? "Progreso de aprendizaje actualizado sólo en este navegador."
        : "El navegador no permitió guardar progreso local. La lección sigue disponible."
    );
  });

  elements.knowledgeCheck.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = new FormData(elements.knowledgeCheck).get("knowledge");
    if (!selected) {
      elements.knowledgeFeedback.textContent = "Selecciona una opción antes de revisar.";
      return;
    }
    elements.knowledgeFeedback.textContent = selected === "citation"
      ? "Correcto: una proposición material necesita una cita verificable y aplicable."
      : "Revisa de nuevo: título o prioridad no sustituyen evidencia verificable.";
  });

  elements.lessonList.addEventListener("keydown", (event) => {
    if (!KEYBOARD_KEYS.includes(event.key)) return;
    const lessonButtons = [...elements.lessonList.querySelectorAll(".lesson-tab")];
    if (!lessonButtons.length) return;
    event.preventDefault();
    let nextIndex = state.activeIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(lessonButtons.length - 1, state.activeIndex + 1);
    if (event.key === "ArrowUp") nextIndex = Math.max(0, state.activeIndex - 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lessonButtons.length - 1;
    selectLesson(nextIndex);
    elements.lessonList.querySelectorAll(".lesson-tab")[nextIndex]?.focus();
  });

  elements.moduleSelect.addEventListener("change", () => {
    setStatus("success", "Este preview contiene un módulo versionado. Nuevos módulos requieren revisión de evidencia.");
  });

  loadTraining();
})();
