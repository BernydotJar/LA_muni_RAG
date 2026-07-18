(function () {
  "use strict";

  const EVENT_NAME = "procedure-workflow:rendered";
  const STORAGE_PREFIX = "la-muni-rag:procedure-case:";
  const PANEL_ID = "procedure-case-workspace";
  const MAX_IMPORT_BYTES = 250000;
  const STATUSES = ["not_started", "in_progress", "blocked", "ready_for_review", "completed"];
  const DOCUMENT_STATES = ["missing", "requested", "received", "reviewed"];
  let currentWorkflow = null;
  let currentWorkspace = null;

  const esc = (value) => {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  };
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const now = () => new Date().toISOString();
  const safeText = (value, max = 1200) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  const workflowKey = (workflow) => {
    const raw = `${workflow?.id || "unknown"}:${workflow?.metadata?.query || "query"}`;
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${STORAGE_PREFIX}${(hash >>> 0).toString(16)}`;
  };

  const statusLabel = (value) => ({
    not_started: "No iniciado",
    in_progress: "En progreso",
    blocked: "Bloqueado",
    ready_for_review: "Listo para revisión",
    completed: "Completado operativo",
  }[value] || "No iniciado");
  const documentStateLabel = (value) => ({
    missing: "Falta",
    requested: "Solicitado",
    received: "Recibido",
    reviewed: "Revisado operativo",
  }[value] || "Falta");

  const audit = (workspace, type, detail) => {
    workspace.auditLog.push({ id: `event:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, at: now(), type, detail: safeText(detail, 500) });
    workspace.auditLog = workspace.auditLog.slice(-300);
    workspace.updatedAt = now();
  };

  const createWorkspace = (workflow) => {
    const createdAt = now();
    const workspace = {
      schemaVersion: 1,
      id: `case:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      updatedAt: createdAt,
      workflowSnapshot: {
        id: safeText(workflow?.id, 200),
        title: safeText(workflow?.title || "Flujo procedimental", 300),
        procedureType: safeText(workflow?.procedureType || "unknown", 100),
        jurisdiction: safeText(workflow?.jurisdiction || "No indicada", 160),
        confidence: safeText(workflow?.confidence || "low", 30),
        query: safeText(workflow?.metadata?.query || workflow?.classification?.retrievalQueries?.[0] || "", 500),
      },
      steps: asArray(workflow?.steps).map((step) => ({
        stepNumber: safeText(step.stepNumber, 40),
        title: safeText(step.title || "Paso sin título", 300),
        status: "not_started",
        operationalAssignee: "",
        note: "",
        documents: [...new Set([...asArray(step.requiredDocuments), ...asArray(step.outputDocuments)].map((item) => safeText(item, 300)).filter(Boolean))]
          .map((name) => ({ name, state: "missing" })),
      })),
      auditLog: [],
    };
    audit(workspace, "workspace_created", "Workspace operativo creado desde el flujo renderizado.");
    return workspace;
  };

  const validateWorkspace = (value) => {
    if (!value || typeof value !== "object" || value.schemaVersion !== 1) throw new Error("schemaVersion no soportado");
    if (!value.workflowSnapshot || typeof value.workflowSnapshot !== "object") throw new Error("workflowSnapshot inválido");
    if (!Array.isArray(value.steps) || value.steps.length > 100) throw new Error("steps inválidos");
    if (!Array.isArray(value.auditLog) || value.auditLog.length > 300) throw new Error("auditLog inválido");
    value.steps.forEach((step) => {
      if (!STATUSES.includes(step?.status)) throw new Error("estado de paso inválido");
      if (!Array.isArray(step?.documents) || step.documents.length > 200) throw new Error("documentos inválidos");
      step.documents.forEach((document) => {
        if (!DOCUMENT_STATES.includes(document?.state)) throw new Error("estado documental inválido");
      });
    });
    return {
      schemaVersion: 1,
      id: safeText(value.id, 120),
      createdAt: safeText(value.createdAt, 50),
      updatedAt: safeText(value.updatedAt, 50),
      workflowSnapshot: {
        id: safeText(value.workflowSnapshot.id, 200),
        title: safeText(value.workflowSnapshot.title, 300),
        procedureType: safeText(value.workflowSnapshot.procedureType, 100),
        jurisdiction: safeText(value.workflowSnapshot.jurisdiction, 160),
        confidence: safeText(value.workflowSnapshot.confidence, 30),
        query: safeText(value.workflowSnapshot.query, 500),
      },
      steps: value.steps.map((step) => ({
        stepNumber: safeText(step.stepNumber, 40),
        title: safeText(step.title, 300),
        status: step.status,
        operationalAssignee: safeText(step.operationalAssignee, 160),
        note: safeText(step.note, 1200),
        documents: step.documents.map((document) => ({ name: safeText(document.name, 300), state: document.state })),
      })),
      auditLog: value.auditLog.map((event) => ({ id: safeText(event.id, 120), at: safeText(event.at, 50), type: safeText(event.type, 80), detail: safeText(event.detail, 500) })),
    };
  };

  const readWorkspace = (workflow) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(workflowKey(workflow)) || "null");
      return parsed ? validateWorkspace(parsed) : null;
    } catch {
      return null;
    }
  };
  const persist = () => {
    if (!currentWorkflow || !currentWorkspace) return;
    localStorage.setItem(workflowKey(currentWorkflow), JSON.stringify(currentWorkspace));
  };

  const injectStyles = () => {
    if (document.getElementById("procedure-case-workspace-style")) return;
    const style = document.createElement("style");
    style.id = "procedure-case-workspace-style";
    style.textContent = `
      .case-workspace{margin:20px;padding:18px;border:1px solid rgba(139,92,246,.25);border-radius:24px;background:linear-gradient(135deg,rgba(139,92,246,.08),rgba(34,211,238,.04))}
      .case-workspace-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.case-workspace-header h2{margin:0 0 6px}.case-workspace-header p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
      .case-safety{margin:14px 0;padding:12px;border:1px solid rgba(251,113,133,.28);border-radius:16px;background:rgba(251,113,133,.055);color:#fecdd3;font-size:12px;line-height:1.5}
      .case-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.case-actions input[type=file]{display:none}
      .case-progress{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.case-metric{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.035)}.case-metric b{display:block;font-size:20px}.case-metric span{color:var(--muted);font-size:11px}
      .case-step-list{display:grid;gap:12px}.case-step{padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(255,255,255,.03)}.case-step h3{margin:0 0 10px;font-size:16px}.case-step-grid{display:grid;grid-template-columns:180px minmax(0,1fr);gap:10px}.case-step label{display:grid;gap:6px;color:var(--muted);font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.case-step textarea{grid-column:1/-1}.case-docs{grid-column:1/-1;display:grid;gap:6px}.case-doc-row{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:8px;align-items:center;padding:8px 10px;border:1px solid rgba(255,255,255,.07);border-radius:12px}.case-doc-row span{color:var(--muted);font-size:12px}
      .case-audit{max-height:260px;overflow:auto;display:grid;gap:6px}.case-audit-item{padding:8px 10px;border-left:2px solid var(--violet);background:rgba(255,255,255,.025);color:var(--muted);font-size:11px;line-height:1.45}
      @media(max-width:820px){.case-workspace-header{display:grid}.case-progress,.case-step-grid{grid-template-columns:1fr}.case-doc-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  };

  const summary = (workspace) => {
    const completed = workspace.steps.filter((step) => step.status === "completed").length;
    const blocked = workspace.steps.filter((step) => step.status === "blocked").length;
    const reviewedDocuments = workspace.steps.flatMap((step) => step.documents).filter((document) => document.state === "reviewed").length;
    const totalDocuments = workspace.steps.flatMap((step) => step.documents).length;
    return { completed, blocked, reviewedDocuments, totalDocuments };
  };

  const renderAudit = (workspace) => asArray(workspace.auditLog).slice().reverse().map((event) => `<div class="case-audit-item"><strong>${esc(event.type)}</strong> · ${esc(event.at)}<br>${esc(event.detail)}</div>`).join("") || "<p>Sin eventos.</p>";

  const renderWorkspace = () => {
    const shell = document.getElementById("procedure-workflow");
    if (!shell || !currentWorkflow) return;
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "case-workspace";

    if (!currentWorkspace) {
      panel.innerHTML = `<div class="case-workspace-header"><div><h2>Workspace del caso</h2><p>Convierte este flujo en un seguimiento operativo local y auditable.</p></div><button id="create-case-workspace" type="button">Crear workspace local</button></div><div class="case-safety"><strong>No es aprobación ni cierre institucional.</strong> El progreso operativo no prueba cumplimiento legal, presupuestario, de contratación, Concejo, COCODE, recepción, liquidación, pago ni cierre de obra. No ingreses datos personales, confidenciales, reservados, credenciales o secretos.</div>`;
      shell.appendChild(panel);
      document.getElementById("create-case-workspace")?.addEventListener("click", () => {
        currentWorkspace = createWorkspace(currentWorkflow);
        persist();
        renderWorkspace();
      });
      return;
    }

    const metrics = summary(currentWorkspace);
    panel.innerHTML = `
      <div class="case-workspace-header"><div><h2>Workspace del caso</h2><p>${esc(currentWorkspace.workflowSnapshot.title)}</p></div><span class="chip">actualizado ${esc(currentWorkspace.updatedAt)}</span></div>
      <div class="case-safety"><strong>Seguimiento operativo, no evidencia legal.</strong> “Completado operativo” no equivale a aprobación, autenticidad documental, suficiencia jurídica, recepción, liquidación, pago o cierre institucional. No ingreses datos sensibles.</div>
      <div class="case-actions"><button type="button" id="export-case-workspace">Exportar JSON</button><label class="secondary" for="import-case-workspace">Importar JSON</label><input id="import-case-workspace" type="file" accept="application/json"><button type="button" class="secondary" id="delete-case-workspace">Eliminar local</button></div>
      <div class="case-progress"><div class="case-metric"><b>${metrics.completed}/${currentWorkspace.steps.length}</b><span>pasos completados operativos</span></div><div class="case-metric"><b>${metrics.blocked}</b><span>pasos bloqueados</span></div><div class="case-metric"><b>${metrics.reviewedDocuments}/${metrics.totalDocuments}</b><span>documentos revisados operativos</span></div></div>
      <div class="case-step-list">${currentWorkspace.steps.map((step, index) => `
        <article class="case-step" data-step-index="${index}"><h3>Paso ${esc(step.stepNumber)} · ${esc(step.title)}</h3><div class="case-step-grid">
          <label>Estado operativo<select data-field="status">${STATUSES.map((status) => `<option value="${status}" ${step.status === status ? "selected" : ""}>${esc(statusLabel(status))}</option>`).join("")}</select></label>
          <label>Asignado operativo<input data-field="operationalAssignee" maxlength="160" value="${esc(step.operationalAssignee)}" placeholder="Ingresado por el usuario; no es autoridad extraída"></label>
          <label>Nota operativa<textarea data-field="note" rows="2" maxlength="1200" placeholder="No incluir información sensible">${esc(step.note)}</textarea></label>
          <div class="case-docs"><strong>Checklist documental operativo</strong>${step.documents.map((document, documentIndex) => `<div class="case-doc-row"><span>${esc(document.name)}</span><select data-document-index="${documentIndex}">${DOCUMENT_STATES.map((state) => `<option value="${state}" ${document.state === state ? "selected" : ""}>${esc(documentStateLabel(state))}</option>`).join("")}</select></div>`).join("") || "<p>Sin documentos en el flujo.</p>"}</div>
        </div></article>`).join("")}</div>
      <h3>Audit log local</h3><div class="case-audit">${renderAudit(currentWorkspace)}</div>`;
    shell.appendChild(panel);

    panel.querySelectorAll(".case-step").forEach((element) => {
      const index = Number(element.dataset.stepIndex);
      element.querySelectorAll("[data-field]").forEach((control) => control.addEventListener("change", () => {
        const field = control.dataset.field;
        const previous = currentWorkspace.steps[index][field];
        currentWorkspace.steps[index][field] = safeText(control.value, field === "note" ? 1200 : 160);
        audit(currentWorkspace, `step_${field}_changed`, `Paso ${currentWorkspace.steps[index].stepNumber}: ${field} cambió de “${previous || "vacío"}” a “${currentWorkspace.steps[index][field] || "vacío"}”.`);
        persist();
        renderWorkspace();
      }));
      element.querySelectorAll("[data-document-index]").forEach((control) => control.addEventListener("change", () => {
        const documentIndex = Number(control.dataset.documentIndex);
        const document = currentWorkspace.steps[index].documents[documentIndex];
        const previous = document.state;
        document.state = control.value;
        audit(currentWorkspace, "document_state_changed", `Paso ${currentWorkspace.steps[index].stepNumber}: “${document.name}” cambió de ${previous} a ${document.state}.`);
        persist();
        renderWorkspace();
      }));
    });

    document.getElementById("export-case-workspace")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(currentWorkspace, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "procedure-case-workspace.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
    document.getElementById("import-case-workspace")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file || file.size > MAX_IMPORT_BYTES) return window.alert("Archivo inválido o demasiado grande.");
      try {
        const imported = validateWorkspace(JSON.parse(await file.text()));
        audit(imported, "workspace_imported", "Workspace importado y validado localmente.");
        currentWorkspace = imported;
        persist();
        renderWorkspace();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "JSON inválido");
      }
    });
    document.getElementById("delete-case-workspace")?.addEventListener("click", () => {
      if (!window.confirm("¿Eliminar este workspace local? Esta acción no modifica el expediente institucional.")) return;
      localStorage.removeItem(workflowKey(currentWorkflow));
      currentWorkspace = null;
      renderWorkspace();
    });
  };

  window.addEventListener(EVENT_NAME, (event) => {
    currentWorkflow = event.detail?.workflow || null;
    if (!currentWorkflow) return;
    currentWorkspace = readWorkspace(currentWorkflow);
    renderWorkspace();
  });

  injectStyles();
})();
