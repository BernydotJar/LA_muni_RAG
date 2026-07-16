(function () {
  "use strict";

  const STORAGE_PREFIX = "la-muni-rag:procedure-case:";
  const CASE_KEY_PATTERN = /^la-muni-rag:procedure-case:[a-f0-9]{1,16}$/;
  const MAX_RECORD_BYTES = 250000;

  const params = new URLSearchParams(window.location.search);
  const caseKey = params.get("caseKey") || "";
  if (!CASE_KEY_PATTERN.test(caseKey) || !caseKey.startsWith(STORAGE_PREFIX)) return;

  let workspace;
  try {
    const raw = window.localStorage.getItem(caseKey);
    if (!raw || new Blob([raw]).size > MAX_RECORD_BYTES) return;
    workspace = JSON.parse(raw);
  } catch {
    return;
  }

  const query = String(workspace?.workflowSnapshot?.query || "").trim().slice(0, 500);
  if (workspace?.schemaVersion !== 1 || !query) return;

  const restore = () => {
    const input = document.getElementById("procedure-query");
    const form = document.getElementById("procedure-workflow-form");
    if (!input || !form) return;
    input.value = query;
    const deepDive = document.querySelector('input[name="procedure-depth"][value="deep_dive"]');
    if (deepDive) deepDive.checked = true;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restore, { once: true });
  } else {
    window.setTimeout(restore, 0);
  }
})();
