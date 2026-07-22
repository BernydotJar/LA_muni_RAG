(() => {
  "use strict";

  const openWidget = () => {
    const widgetHost = document.getElementById("muni-rag-widget");
    const bubble = widgetHost?.shadowRoot?.getElementById("muni-bubble");
    bubble?.click();
  };

  document.querySelectorAll("[data-open-assistant]").forEach((control) => {
    control.addEventListener("click", openWidget);
  });

  const widgetUrl = document.getElementById("widget-url");
  if (widgetUrl) widgetUrl.textContent = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}widget.js`;

  const copyButton = document.getElementById("copy-btn");
  const embedCode = document.querySelector("#embed-code code");
  copyButton?.addEventListener("click", async () => {
    const snippet = embedCode?.textContent?.trim() || "";
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      copyButton.textContent = "Copiado";
    } catch {
      copyButton.textContent = "Selecciona el código";
    }
    window.setTimeout(() => { copyButton.textContent = "Copiar"; }, 1600);
  });
})();
