(function () {
  "use strict";

  const api = window.ProcedureCasePortfolio;
  if (!api) throw new Error("ProcedureCasePortfolio data runtime is missing.");

  const byId = (id) => document.getElementById(id);
  const esc = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };
  const safeDate = (value) => {
    const time = Date.parse(String(value || ""));
    return Number.isFinite(time) ? time : 0;
  };
  const downloadJson = (filename, value) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  let cases = api.load().map(api.summarize);

  const populateTypes = () => {
    const select = byId("case-type");
    const values = [...new Set(cases.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  };

  const setMetric = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = String(value);
  };

  const renderMetrics = () => {
    setMetric("m-total", cases.length);
    setMetric("m-active", cases.filter((item) => item.completed < item.total).length);
    setMetric("m-blocked", cases.filter((item) => item.blocked > 0).length);
    setMetric("m-ready", cases.filter((item) => item.ready > 0).length);
    setMetric("m-completed", cases.filter((item) => item.total > 0 && item.completed === item.total).length);
    setMetric("m-docs", cases.reduce((total, item) => total + item.missing, 0));
  };

  const matchesStatus = (item, status) => {
    if (status === "all") return true;
    if (status === "active") return item.completed < item.total;
    if (status === "blocked") return item.blocked > 0;
    if (status === "ready") return item.ready > 0;
    if (status === "completed") return item.total > 0 && item.completed === item.total;
    return true;
  };

  const filteredCases = () => {
    const search = byId("case-search").value.trim().toLowerCase();
    const type = byId("case-type").value;
    const status = byId("case-status").value;
    const blockersOnly = byId("case-blockers").checked;
    const recentOnly = byId("case-recent").checked;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const filtered = cases.filter((item) => {
      const haystack = `${item.title} ${item.query} ${item.assignees.join(" ")}`.toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (type !== "all" && item.type !== type) return false;
      if (!matchesStatus(item, status)) return false;
      if (blockersOnly && item.blocked === 0) return false;
      if (recentOnly && safeDate(item.lastActivity) < cutoff) return false;
      return true;
    });

    const sort = byId("case-sort").value;
    return filtered.sort((left, right) => {
      if (sort === "title") return left.title.localeCompare(right.title, "es");
      if (sort === "progress") return right.progressPct - left.progressPct || left.title.localeCompare(right.title, "es");
      return safeDate(right.updatedAt) - safeDate(left.updatedAt) || left.title.localeCompare(right.title, "es");
    });
  };

  const cardHtml = (item) => {
    const openHref = `./procedure-workflow.html?caseKey=${encodeURIComponent(item.key)}`;
    const assignees = item.assignees.length
      ? `<div class="assignees">${item.assignees.map((name) => `<span class="chip">${esc(name)}</span>`).join("")}</div>`
      : "";
    return `
      <article class="case-card">
        <h2>${esc(item.title)}</h2>
        <p>${esc(item.query || "Consulta no registrada")}</p>
        <div class="case-meta">
          <span class="chip">${esc(item.type)}</span>
          ${item.blocked ? `<span class="chip blocked">${item.blocked} bloqueado(s)</span>` : ""}
          ${item.ready ? `<span class="chip ready">${item.ready} listo(s) para revisión</span>` : ""}
        </div>
        <div class="progress" aria-label="Progreso operativo ${esc(item.progressPct)}%"><span style="width:${Math.max(0, Math.min(100, item.progressPct))}%"></span></div>
        <div class="case-stats">
          <span class="chip">${item.completed}/${item.total} pasos</span>
          <span class="chip">${item.missing} documentos faltantes</span>
          <span class="chip">${item.requested} solicitados</span>
          <span class="chip">${item.reviewed} revisados operativos</span>
        </div>
        ${assignees}
        <p>Última actividad: ${esc(item.lastActivity || "sin actividad registrada")}</p>
        <div class="case-actions"><a class="button" href="${esc(openHref)}">Abrir caso</a></div>
      </article>`;
  };

  const render = () => {
    const items = filteredCases();
    byId("result-count").textContent = `${items.length} caso${items.length === 1 ? "" : "s"}`;
    byId("case-list").innerHTML = items.length
      ? items.map(cardHtml).join("")
      : '<div class="empty">No hay casos locales que coincidan con los filtros.</div>';
  };

  ["case-search", "case-type", "case-status", "case-sort", "case-blockers", "case-recent"].forEach((id) => {
    byId(id)?.addEventListener(id === "case-search" ? "input" : "change", render);
  });

  byId("export-portfolio")?.addEventListener("click", () => {
    downloadJson("case-portfolio-export.json", api.exportSnapshot(cases));
  });

  populateTypes();
  renderMetrics();
  render();
})();
