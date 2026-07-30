/**
 * LA Muni RAG — Procedure Workflow Widget Entrypoint
 *
 * Lightweight progressive enhancement for the embeddable widget.
 * It links users from chat-style Q&A into the dedicated Procedure Workflow UI.
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript;
  const configuredUrl = scriptTag?.getAttribute("data-procedure-url") || "";
  const procedureUrl = configuredUrl || new URL("./procedure-workflow.html", window.location.href).href;
  const ENTRY_ATTR = "data-procedure-workflow-entrypoint";
  const MAX_ATTEMPTS = 80;
  let attempts = 0;
  let observer = null;

  const openProcedureWorkflow = () => {
    window.open(procedureUrl, "_self");
  };

  const makeRailEntrypoint = (shadow) => {
    const rail = shadow.querySelector(".muni-header-rail");
    if (!rail || rail.querySelector(`[${ENTRY_ATTR}="true"]`)) return false;

    const link = document.createElement("button");
    link.type = "button";
    link.className = "muni-rail-pill procedure-workflow-entrypoint";
    link.setAttribute(ENTRY_ATTR, "true");
    link.setAttribute("aria-label", "Abrir flujos procedimentales municipales");
    link.textContent = "Flujos";
    link.style.cursor = "pointer";
    link.addEventListener("click", openProcedureWorkflow);
    rail.appendChild(link);
    return true;
  };

  const makeWelcomeEntrypoint = (shadow) => {
    const suggestions = shadow.querySelector(".muni-suggestions");
    if (!suggestions || suggestions.querySelector(`[${ENTRY_ATTR}="true"]`)) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "muni-suggestion procedure-workflow-entrypoint";
    button.setAttribute(ENTRY_ATTR, "true");
    button.textContent = "Generar flujo procedimental paso a paso";
    button.addEventListener("click", openProcedureWorkflow);
    suggestions.appendChild(button);
    return true;
  };

  const installEntrypoint = () => {
    attempts += 1;
    const host = document.getElementById("muni-rag-widget");
    const shadow = host?.shadowRoot;
    if (!shadow) return false;

    const installedRail = makeRailEntrypoint(shadow);
    const installedWelcome = makeWelcomeEntrypoint(shadow);
    return installedRail || installedWelcome || Boolean(shadow.querySelector(`[${ENTRY_ATTR}="true"]`));
  };

  const stop = () => {
    if (observer) observer.disconnect();
    observer = null;
  };

  const tick = () => {
    if (installEntrypoint() || attempts >= MAX_ATTEMPTS) stop();
  };

  const start = () => {
    tick();
    if (attempts >= MAX_ATTEMPTS) return;
    observer = new MutationObserver(tick);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(stop, 8000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
