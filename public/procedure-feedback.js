(function loadProcedureDeepDive() {
  if (document.querySelector('script[data-procedure-deep-dive="true"]')) return;
  const script = document.createElement("script");
  script.src = "./procedure-deep-dive.js";
  script.async = false;
  script.dataset.procedureDeepDive = "true";
  document.head.appendChild(script);
})();

(function loadProcedureCaseWorkspace() {
  if (document.querySelector('script[data-procedure-case-workspace="true"]')) return;
  const script = document.createElement("script");
  script.src = "./procedure-case-workspace.js";
  script.async = false;
  script.dataset.procedureCaseWorkspace = "true";
  document.head.appendChild(script);
})();

(function loadProcedureCaseOpener() {
  if (document.querySelector('script[data-procedure-case-open="true"]')) return;
  const script = document.createElement("script");
  script.src = "./procedure-case-open.js";
  script.async = false;
  script.dataset.procedureCaseOpen = "true";
  document.head.appendChild(script);
})();

/**
 * LA Muni RAG — Procedure Workflow Feedback Loop
 *
 * Captures local/exportable product feedback about generated ProcedureWorkflow objects.
 * MVP boundary: no network calls, no backend persistence, no sensitive data collection.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "la-muni-rag:procedure-feedback";
  const EVENT_NAME = "procedure-workflow:rendered";
  const PANEL_ID = "procedure-feedback-panel";
  const DASHBOARD_URL = "./procedure-feedback-dashboard.html";
  const PORTFOLIO_URL = "./procedure-case-portfolio.html";
  let currentWorkflow = null;

  const feedbackTypes = [
    ["missing_document", "Falta documento"],
    ["wrong_or_unclear_step", "Paso incorrecto o confuso"],
    ["unclear_responsible", "Responsable no claro"],
    ["missing_legal_basis", "Falta fundamento legal"],
    ["missing_deadline", "Falta plazo"],
    ["missing_case_evidence", "Falta expediente del caso"],
    ["other", "Otro"],
  ];

  const escapeHtml = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };

  const asArray = (value) => (Array.isArray(value) ? value : []);

  const readFeedback = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeFeedback = (items) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-50), null, 2));
  };

  const workflowMetadata = (workflow) => ({
    domainPackId: workflow?.metadata?.domainPackId || "municipal-antigua",
    domainPackName: workflow?.metadata?.domainPackName || "Municipal Antigua",
    workflowId: workflow?.id || "workflow:unknown",
    workflowTitle: workflow?.title || "Flujo procedimental",
    procedureType: workflow?.procedureType || "unknown",
    jurisdiction: workflow?.jurisdiction || "Antigua Guatemala",
    confidence: workflow?.confidence || "low",
    query: workflow?.metadata?.query || workflow?.classification?.retrievalQueries?.[0] || "consulta no indicada",
  });

  const selectedStep = (workflow, value) => {
    if (value === "overall") return { stepNumber: "overall", stepTitle: "Flujo completo" };
    const match = asArray(workflow?.steps).find((step) => String(step.stepNumber) === String(value));
    return {
      stepNumber: match?.stepNumber ?? value,
      stepTitle: match?.title || "Paso no identificado",
    };
  };

  const feedbackPayload = (workflow, form) => {
    const step = selectedStep(workflow, form.step.value);
    return {
      id: `feedback:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...workflowMetadata(workflow),
      stepNumber: String(step.stepNumber),
      stepTitle: step.stepTitle,
      feedbackType: form.feedbackType.value,
      comment: form.comment.value.trim(),
    };
  };

  const renderRecentFeedback = () => {
    const list = document.getElementById("procedure-feedback-list");
    const count = document.getElementById("procedure-feedback-count");
    if (!list || !count) return;
    const items = readFeedback().reverse();
    count.textContent = String(items.length);
    list.innerHTML = items.slice(0, 5).map((item) => `
      <article class="procedure-feedback-item">
        <b>${escapeHtml(item.feedbackType)} · ${escapeHtml(item.stepTitle)}</b>
        <p>${escapeHtml(item.comment || "Sin comentario")}</p>
        <span>${escapeHtml(item.createdAt)}</span>
      </article>
    `).join("") || "<p>No hay feedback local todavía.</p>";
  };

  const copyFeedbackJson = async () => {
    const items = readFeedback();
    await navigator.clipboard?.writeText(JSON.stringify(items, null, 2));
    const button = document.getElementById("copy-procedure-feedback-json");
    if (button) {
      button.textContent = "JSON copiado";
      window.setTimeout(() => { button.textContent = "Copiar feedback JSON"; }, 1400);
    }
  };

  const saveFeedback = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!currentWorkflow || !form.comment.value.trim()) return;
    const items = readFeedback();
    items.push(feedbackPayload(currentWorkflow, form));
    writeFeedback(items);
    form.comment.value = "";
    renderRecentFeedback();
  };

  const renderStepOptions = (workflow) => {
    const steps = asArray(workflow?.steps);
    return [
      '<option value="overall">Flujo completo</option>',
      ...steps.map((step) => `<option value="${escapeHtml(step.stepNumber)}">Paso ${escapeHtml(step.stepNumber)} · ${escapeHtml(step.title || "Sin título")}</option>`),
    ].join("");
  };

  const renderFeedbackPanel = (workflow) => {
    const shell = document.getElementById("procedure-workflow");
    if (!shell) return;
    document.getElementById(PANEL_ID)?.remove();

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "procedure-feedback-panel";
    panel.innerHTML = `
      <div class="procedure-feedback-header">
        <div>
          <h2>Feedback del flujo</h2>
          <p>Marca brechas, pasos confusos o evidencia faltante. Este feedback queda local en tu navegador y puedes copiarlo como JSON para revisión del equipo.</p>
        </div>
        <span class="chip">feedback local: <b id="procedure-feedback-count">0</b></span>
      </div>
      <form id="procedure-feedback-form" class="procedure-feedback-form">
        <label>Tipo de feedback<select name="feedbackType">${feedbackTypes.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}</select></label>
        <label>Paso<select name="step">${renderStepOptions(workflow)}</select></label>
        <label class="procedure-feedback-comment">Comentario<textarea name="comment" rows="3" maxlength="1200" placeholder="Ejemplo: falta acta de recepción final para confirmar cierre; no incluir información confidencial."></textarea></label>
        <div class="procedure-feedback-actions">
          <button type="submit">Guardar feedback local</button>
          <button type="button" class="secondary" id="copy-procedure-feedback-json">Copiar feedback JSON</button>
          <a class="secondary" href="${DASHBOARD_URL}">Ver dashboard de feedback</a>
          <a class="secondary" href="${PORTFOLIO_URL}">Ver portafolio de casos</a>
        </div>
      </form>
      <div class="procedure-feedback-privacy">No se envía información al servidor en este MVP. No pegues datos personales, secretos ni información reservada.</div>
      <div id="procedure-feedback-list" class="procedure-feedback-list"></div>
    `;
    shell.appendChild(panel);
    document.getElementById("procedure-feedback-form")?.addEventListener("submit", saveFeedback);
    document.getElementById("copy-procedure-feedback-json")?.addEventListener("click", copyFeedbackJson);
    renderRecentFeedback();
  };

  window.addEventListener(EVENT_NAME, (event) => {
    currentWorkflow = event.detail?.workflow || null;
    if (currentWorkflow) renderFeedbackPanel(currentWorkflow);
  });
})();
