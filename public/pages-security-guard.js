/**
 * LA Muni RAG — Pages source-link security guard.
 *
 * Defensive layer for the public GitHub Pages product. It sanitizes source links
 * rendered inside the widget Shadow DOM, because real API responses can carry
 * citation source URLs.
 */
(function () {
  "use strict";

  const isSafeHttpHref = (href) => {
    try {
      const parsed = new URL(href, window.location.origin);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  };

  const sanitizeWidgetSourceLinks = () => {
    const widgetHost = document.getElementById("muni-rag-widget");
    const root = widgetHost?.shadowRoot;
    if (!root) return;

    root.querySelectorAll("a.muni-source-action").forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (!isSafeHttpHref(href)) {
        anchor.removeAttribute("href");
        anchor.textContent = "Fuente no enlazada";
        anchor.classList.add("disabled");
        anchor.setAttribute("data-source-action", "blocked-source");
        return;
      }

      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    });
  };

  const scheduleSanitization = () => requestAnimationFrame(sanitizeWidgetSourceLinks);

  document.addEventListener("click", scheduleSanitization, true);
  document.addEventListener("keyup", scheduleSanitization, true);
  window.addEventListener("load", scheduleSanitization);
  setInterval(sanitizeWidgetSourceLinks, 1000);
})();
