(function () {
  "use strict";

  const EVENT_NAME = "procedure-workflow:rendered";
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const esc = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };
  const safeUrl = (value) => {
    try {
      if (typeof value !== "string" || !value.trim()) return null;
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  };
  const categoryLabel = (status) => ({
    official_municipal: "Fuente oficial municipal",
    official_national: "Base nacional aplicable",
    comparative: "Referencia comparativa",
    contextual: "Fuente contextual",
    insufficient: "Cobertura pendiente",
  }[status] || "Fuente del paso");
  const sourceLinkLabel = (status) => {
    if (status === "comparative") return "Abrir referencia comparativa";
    if (status === "contextual") return "Abrir fuente contextual";
    return "Abrir fuente oficial";
  };

  const injectStyles = () => {
    if (document.getElementById("procedure-source-attribution-style")) return;
    const style = document.createElement("style");
    style.id = "procedure-source-attribution-style";
    style.textContent = `
      .source-attribution{margin-top:12px;padding:13px;border:1px solid rgba(226,170,183,.20);border-radius:16px;background:rgba(115,23,41,.045)}
      .source-attribution.official_national{border-color:rgba(184,139,115,.25);background:rgba(184,139,115,.05)}
      .source-attribution.comparative,.source-attribution.contextual{border-color:rgba(245,158,11,.28);background:rgba(245,158,11,.055)}
      .source-attribution.insufficient{border-color:rgba(251,113,133,.28);background:rgba(251,113,133,.05)}
      .source-attribution-category{display:block;margin-bottom:5px;color:#e2aab7;font-size:10px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}
      .source-attribution h4{margin:0 0 6px;font-size:13px;color:#ead5da}
      .source-attribution p{margin:0;color:var(--muted);font-size:12px;line-height:1.55}
      .source-attribution-meta{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
      .source-attribution-meta span,.source-attribution-meta a{display:inline-flex;align-items:center;min-height:27px;padding:0 9px;border:1px solid rgba(255,255,255,.1);border-radius:999px;color:#efe5e1;background:rgba(255,255,255,.035);font-size:11px;font-weight:800;text-decoration:none}
      .source-attribution-excerpt{margin-top:9px!important;padding-top:9px;border-top:1px solid rgba(255,255,255,.08)}
    `;
    document.head.appendChild(style);
  };

  const fallbackAttribution = (step) => {
    const citations = asArray(step.sourceEvidence || step.legalBasis);
    if (!citations.length) {
      return {
        status: "insufficient",
        heading: "Falta una fuente que confirme este paso",
        statement: "Los documentos disponibles todavía no contienen una cita que confirme este paso. Por eso no se presenta como un requisito confirmado.",
        coverageReason: "source_not_loaded",
        requiredEvidence: asArray(step.requiredDocuments),
        citations: [],
      };
    }
    const primary = citations[0];
    return {
      status: primary.authorityLevel === "comparative"
        ? "comparative"
        : primary.authorityLevel === "context"
          ? "contextual"
          : primary.authorityLevel === "national"
            ? "official_national"
            : primary.authorityLevel === "primary"
              ? "official_municipal"
              : "insufficient",
      heading: primary.citationLabel || "Fuente encontrada",
      statement: step.evidenceStatement || "Esta fuente contiene información relacionada con este paso.",
      primaryCitation: primary,
      citations,
    };
  };

  const renderAttribution = (step) => {
    const attribution = step.sourceAttribution || fallbackAttribution(step);
    const status = attribution.status || "insufficient";
    const citation = attribution.primaryCitation || asArray(attribution.citations)[0];
    const link = safeUrl(citation?.sourceUrl);
    const requiredEvidence = asArray(attribution.requiredEvidence || step.requiredDocuments);
    const meta = [
      citation?.authorityLabel ? `<span>${esc(citation.authorityLabel)}</span>` : "",
      citation?.authorityLevel ? `<span>Nivel: ${esc(citation.authorityLevel)}</span>` : "",
      citation?.pageStart != null ? `<span>Página ${esc(citation.pageStart)}</span>` : "",
      link
        ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(sourceLinkLabel(status))}</a>`
        : "",
      ...requiredEvidence.slice(0, 3).map((item) => `<span>Fuente requerida: ${esc(item)}</span>`),
    ].filter(Boolean).join("");
    return `
      <section class="source-attribution ${esc(status)}" data-source-attribution="true">
        <span class="source-attribution-category">${esc(categoryLabel(status))}</span>
        <h4>${esc(attribution.heading || "Fuente del paso")}</h4>
        <p>${esc(attribution.statement || "Los documentos disponibles todavía no contienen una cita que confirme este paso. Por eso no se presenta como un requisito confirmado.")}</p>
        ${meta ? `<div class="source-attribution-meta">${meta}</div>` : ""}
        ${citation?.excerpt ? `<p class="source-attribution-excerpt">${esc(citation.excerpt)}</p>` : ""}
      </section>`;
  };

  window.addEventListener(EVENT_NAME, (event) => {
    const workflow = event.detail?.workflow;
    const shell = document.getElementById("procedure-workflow");
    if (!workflow || !shell) return;
    const cards = shell.querySelectorAll(".procedure-step-card");
    asArray(workflow.steps).forEach((step, index) => {
      const card = cards[index];
      if (!card || card.querySelector('[data-source-attribution="true"]')) return;
      card.insertAdjacentHTML("beforeend", renderAttribution(step));
    });
  });

  injectStyles();
})();
