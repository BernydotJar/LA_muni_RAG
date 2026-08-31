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

  const makeOptionsEntrypoint = (shadow) => {
    const options = shadow.querySelector(".muni-mode-selector");
    if (!options || options.querySelector(`[${ENTRY_ATTR}="true"]`)) return false;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "muni-mode-btn procedure-workflow-entrypoint";
    button.setAttribute(ENTRY_ATTR, "true");
    button.setAttribute("aria-label", "Abrir guía de procedimientos municipales");
    button.textContent = "Ver procedimientos";
    button.addEventListener("click", openProcedureWorkflow);
    options.appendChild(button);
    return true;
  };

  const installEntrypoint = () => {
    attempts += 1;
    const host = document.getElementById("muni-rag-widget");
    const shadow = host?.shadowRoot;
    if (!shadow) return false;

    const installedOptions = makeOptionsEntrypoint(shadow);
    return installedOptions || Boolean(shadow.querySelector(`[${ENTRY_ATTR}="true"]`));
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
