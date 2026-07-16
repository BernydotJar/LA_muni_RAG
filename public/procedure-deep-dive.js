(function () {
  "use strict";

  const EVENT_NAME = "procedure-workflow:rendered";
  const DEPTH_CONTROL_ID = "procedure-depth";
  const nativeFetch = window.fetch.bind(window);

  const esc = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const currentDepth = () => document.getElementById(DEPTH_CONTROL_ID)?.value || "overview";

  const isProcedureRequest = (input) => {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      return Boolean(raw) && new URL(raw, window.location.origin).pathname.endsWith("/api/procedure");
    } catch {
      return false;
    }
  };

  const injectStyles = () => {
    if (document.getElementById("procedure-deep-dive-style")) return;
    const style = document.createElement("style");
    style.id = "procedure-deep-dive-style";
    style.textContent = `
      .depth-control{display:flex;gap:6px;padding:5px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.035)}
      .depth-control label{display:flex;align-items:center;gap:8px;padding:0 11px;border-radius:12px;color:var(--muted);font-size:12px;font-weight:850;cursor:pointer}
      .depth-control input{min-height:auto;accent-color:var(--cyan)}
      .deep-dive-banner,.dependency-map{padding:14px;border:1px solid rgba(34,211,238,.2);border-radius:18px;background:rgba(34,211,238,.045)}
      .deep-dive-banner{margin-top:14px;color:#bae6fd;font-size:13px;line-height:1.5}
      .dependency-map{display:grid;gap:8px}
      .dependency-item{padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03);color:var(--muted);font-size:12px;line-height:1.45}
      .evidence-badge{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--line);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
      .evidence-badge.supported{color:#86efac;border-color:rgba(34,197,94,.34)}
      .evidence-badge.inferred{color:#fde68a;border-color:rgba(245,158,11,.34)}
      .evidence-badge.insufficient{color:#fecdd3;border-color:rgba(251,113,133,.34)}
      .step-evidence-statement{margin:10px 0 0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.035);color:var(--muted);font-size:12px;line-height:1.5}
      .step-supported-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
      .supported-field{padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03)}
      .supported-field b{display:block;margin-bottom:5px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--cyan)}
      details.citation-dossier{margin-top:8px;border:1px solid rgba(34,211,238,.15);border-radius:14px;background:rgba(34,211,238,.035)}
      details.citation-dossier summary{cursor:pointer;padding:10px 12px;color:#bae6fd;font-size:12px;font-weight:800}
      .citation-dossier-body{padding:0 12px 12px;color:var(--muted);font-size:12px;line-height:1.5}
      @media(max-width:820px){.step-supported-fields{grid-template-columns:1fr}.depth-control{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  };

  const installDepthControl = () => {
    const grid = document.querySelector(".query-grid");
    if (!grid || document.getElementById(DEPTH_CONTROL_ID)) return;
    const wrapper = document.createElement("div");
    wrapper.className = "depth-control";
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", "Profundidad del flujo");
    wrapper.innerHTML = `
      <label><input id="${DEPTH_CONTROL_ID}" name="depth" type="radio" value="overview" checked>Resumen</label>
      <label><input name="depth" type="radio" value="deep_dive">Ver flujo completo</label>
    `;
    wrapper.querySelectorAll('input[name="depth"]').forEach((input) => {
      input.addEventListener("change", () => {
        const selected = wrapper.querySelector('input[name="depth"]:checked');
        wrapper.querySelector(`#${DEPTH_CONTROL_ID}`).value = selected?.value || "overview";
      });
    });
    grid.insertBefore(wrapper, grid.lastElementChild);
  };

  window.fetch = async (input, init) => {
    if (!isProcedureRequest(input)) return nativeFetch(input, init);
    const raw = typeof input === "string" ? input : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.searchParams.has("depth")) url.searchParams.set("depth", currentDepth());
    return nativeFetch(url.href, init);
  };

  const evidenceLabel = (status) => status === "supported" ? "Respaldado" : status === "inferred" ? "Inferido" : "Sin evidencia suficiente";

  const renderCitationDossiers = (citations) => {
    const values = asArray(citations);
    if (!values.length) return '<p class="step-evidence-statement">No encontré base documental suficiente para afirmar este paso.</p>';
    return values.map((citation) => `
      <details class="citation-dossier">
        <summary>${esc(citation.citationLabel || citation.sourceType || "Fuente")}</summary>
        <div class="citation-dossier-body">
          <p>${esc(citation.excerpt || "Extracto no disponible")}</p>
          <p><strong>Autoridad:</strong> ${esc(citation.authorityClass || "no clasificada")} · <strong>Uso:</strong> ${esc(citation.evidenceUse || "cited_text")}</p>
        </div>
      </details>`).join("");
  };

  const enhanceStep = (card, step) => {
    const status = step.evidenceStatus || "insufficient";
    card.dataset.evidenceStatus = status;
    const head = card.querySelector(".step-head");
    head?.insertAdjacentHTML("beforeend", `<span class="evidence-badge ${esc(status)}">${esc(evidenceLabel(status))}</span>`);

    const fields = [
      ["Responsable", step.responsibleRole],
      ["Unidad", step.responsibleUnit],
      ["Plazo explícito", step.deadline],
    ].filter(([, value]) => Boolean(value));
    if (fields.length) {
      card.insertAdjacentHTML("beforeend", `<div class="step-supported-fields">${fields.map(([label, value]) => `<div class="supported-field"><b>${esc(label)}</b>${esc(value)}</div>`).join("")}</div>`);
    }

    card.insertAdjacentHTML("beforeend", `<p class="step-evidence-statement">${esc(step.evidenceStatement || (status === "inferred" ? "Este paso es inferido por relación entre documentos y requiere validación humana." : status === "supported" ? "Paso respaldado por evidencia coincidente." : "No encontré base documental suficiente para afirmar este paso."))}</p>`);
    card.insertAdjacentHTML("beforeend", `<div class="citation-dossiers">${renderCitationDossiers(step.sourceEvidence || step.legalBasis)}</div>`);
  };

  const renderDependencies = (workflow) => {
    const dependencies = asArray(workflow.dependencies);
    if (!dependencies.length) return "";
    return `<section><h2 class="section-title">Dependencias y decisiones</h2><div class="dependency-map">${dependencies.map((dependency) => `<div class="dependency-item"><strong>Paso ${esc(dependency.fromStep)} → ${esc(dependency.toStep)}</strong> · ${esc(dependency.statement || dependency.type || "Dependencia")}</div>`).join("")}</div></section>`;
  };

  window.addEventListener(EVENT_NAME, (event) => {
    const workflow = event.detail?.workflow;
    if (!workflow || workflow.metadata?.depth !== "deep_dive") return;
    const shell = document.getElementById("procedure-workflow");
    const body = shell?.querySelector(".workflow-body");
    const header = shell?.querySelector(".workflow-header");
    if (!shell || !body || !header) return;

    header.insertAdjacentHTML("beforeend", '<div class="deep-dive-banner"><strong>Deep dive activo.</strong> Cada paso distingue evidencia directa, inferencia y ausencia de soporte documental.</div>');
    asArray(workflow.steps).forEach((step, index) => {
      const card = shell.querySelectorAll(".procedure-step-card")[index];
      if (card) enhanceStep(card, step);
    });
    const dependencyHtml = renderDependencies(workflow);
    if (dependencyHtml) body.insertAdjacentHTML("afterbegin", dependencyHtml);
  });

  injectStyles();
  installDepthControl();
})();
