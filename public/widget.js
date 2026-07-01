/**
 * LA Muni RAG — Embeddable Chat Widget
 *
 * Usage:
 *   <script src="http://your-api:4010/widget.js" data-api-url="http://your-api:4010"></script>
 *
 * Configuration (via data attributes on the script tag):
 *   data-api-url     API base URL (default: auto-detect from script src)
 *   data-position    "right" | "left" (default: "right")
 *   data-theme       "dark" | "light" (default: "dark")
 *   data-title       Chat window title (default: "Asistente Municipal")
 */
(function () {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────────────────
  const scriptTag = document.currentScript;
  const config = {
    apiUrl: scriptTag?.getAttribute("data-api-url") ||
      (scriptTag?.src ? new URL(scriptTag.src).origin : window.location.origin),
    position: scriptTag?.getAttribute("data-position") || "right",
    theme: scriptTag?.getAttribute("data-theme") || "dark",
    title: scriptTag?.getAttribute("data-title") || "Asistente Municipal",
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :host {
      --muni-primary: #6366f1;
      --muni-primary-hover: #818cf8;
      --muni-accent: #f59e0b;
      --muni-bg: #0f0f23;
      --muni-bg-chat: #1a1a2e;
      --muni-bg-message: #16213e;
      --muni-bg-user: #6366f1;
      --muni-bg-glass: rgba(26, 26, 46, 0.85);
      --muni-text: #e2e8f0;
      --muni-text-dim: #94a3b8;
      --muni-text-user: #ffffff;
      --muni-border: rgba(99, 102, 241, 0.2);
      --muni-border-strong: rgba(99, 102, 241, 0.4);
      --muni-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
      --muni-radius: 16px;
      --muni-radius-sm: 10px;
      --muni-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

      all: initial;
      font-family: var(--muni-font);
      font-size: 14px;
      line-height: 1.5;
      color: var(--muni-text);
      position: fixed;
      bottom: 24px;
      ${config.position === "left" ? "left: 24px;" : "right: 24px;"}
      z-index: 2147483647;
    }

    :host([data-theme="light"]) {
      --muni-primary: #4f46e5;
      --muni-primary-hover: #4338ca;
      --muni-accent: #d97706;
      --muni-bg: #f9fafb;
      --muni-bg-chat: #ffffff;
      --muni-bg-message: #f3f4f6;
      --muni-bg-user: #4f46e5;
      --muni-bg-glass: rgba(255, 255, 255, 0.9);
      --muni-text: #1f2937;
      --muni-text-dim: #4b5563;
      --muni-text-user: #ffffff;
      --muni-border: rgba(79, 70, 229, 0.15);
      --muni-border-strong: rgba(79, 70, 229, 0.35);
      --muni-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
    }

    /* ── Bubble ───────────────────────────────────────── */

    .muni-bubble {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--muni-primary), #8b5cf6);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.3s ease;
      position: relative;
    }

    .muni-bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 12px 40px rgba(99, 102, 241, 0.6);
    }

    .muni-bubble:active { transform: scale(0.95); }

    .muni-bubble svg {
      width: 28px;
      height: 28px;
      fill: white;
      transition: transform 0.3s ease;
    }

    .muni-bubble.open svg { transform: rotate(90deg); }

    .muni-bubble .muni-pulse {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--muni-primary);
      animation: muni-pulse 2s ease-out infinite;
      z-index: -1;
    }

    @keyframes muni-pulse {
      0% { transform: scale(1); opacity: 0.4; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    /* ── Chat Window ──────────────────────────────────── */

    .muni-window {
      position: absolute;
      bottom: 76px;
      ${config.position === "left" ? "left: 0;" : "right: 0;"}
      width: 400px;
      max-width: calc(100vw - 48px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: var(--muni-bg-glass);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid var(--muni-border);
      border-radius: var(--muni-radius);
      box-shadow: var(--muni-shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .muni-window.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* ── Header ───────────────────────────────────────── */

    .muni-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
      border-bottom: 1px solid var(--muni-border);
      flex-shrink: 0;
    }

    .muni-header-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--muni-primary), #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .muni-header-icon svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .muni-header-text h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--muni-text);
    }

    .muni-header-text p {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--muni-text-dim);
    }

    .muni-header-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .muni-header-status::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }

    /* ── Messages ──────────────────────────────────────── */

    .muni-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    .muni-messages::-webkit-scrollbar { width: 6px; }
    .muni-messages::-webkit-scrollbar-track { background: transparent; }
    .muni-messages::-webkit-scrollbar-thumb {
      background: var(--muni-border-strong);
      border-radius: 3px;
    }

    .muni-msg {
      max-width: 88%;
      animation: muni-msgIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes muni-msgIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .muni-msg-user {
      align-self: flex-end;
    }

    .muni-msg-user .muni-msg-bubble {
      background: linear-gradient(135deg, var(--muni-primary), #8b5cf6);
      color: var(--muni-text-user);
      border-radius: var(--muni-radius-sm) var(--muni-radius-sm) 4px var(--muni-radius-sm);
      padding: 10px 16px;
    }

    .muni-msg-assistant {
      align-self: flex-start;
    }

    .muni-msg-assistant .muni-msg-bubble {
      background: var(--muni-bg-message);
      border: 1px solid var(--muni-border);
      border-radius: var(--muni-radius-sm) var(--muni-radius-sm) var(--muni-radius-sm) 4px;
      padding: 12px 16px;
    }

    .muni-msg-bubble p {
      margin: 0 0 8px;
    }

    .muni-msg-bubble p:last-child { margin-bottom: 0; }

    .muni-msg-bubble strong { color: var(--muni-primary-hover); font-weight: 600; }

    .muni-msg-bubble em { color: var(--muni-text-dim); font-style: italic; }

    .muni-msg-bubble blockquote {
      margin: 6px 0;
      padding: 8px 12px;
      border-left: 3px solid var(--muni-primary);
      background: rgba(99, 102, 241, 0.08);
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      color: var(--muni-text-dim);
    }

    /* ── Citation Cards ────────────────────────────────── */

    .muni-citations {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
    }

    .muni-citation {
      background: rgba(99, 102, 241, 0.06);
      border: 1px solid var(--muni-border);
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease;
    }

    .muni-citation:hover {
      border-color: var(--muni-border-strong);
      background: rgba(99, 102, 241, 0.1);
    }

    .muni-citation-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .muni-citation-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 4px;
      background: linear-gradient(135deg, var(--muni-primary), #8b5cf6);
      color: white;
      white-space: nowrap;
    }

    .muni-citation-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--muni-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .muni-citation-excerpt {
      font-size: 12px;
      color: var(--muni-text-dim);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .muni-citation.expanded .muni-citation-excerpt {
      display: block;
      -webkit-line-clamp: unset;
      overflow: visible;
    }

    /* ── Meta badge ────────────────────────────────────── */

    .muni-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .muni-meta-tag {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--muni-border);
      color: var(--muni-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .muni-meta-tag.confidence-high { border-color: #22c55e; color: #22c55e; }
    .muni-meta-tag.confidence-medium { border-color: var(--muni-accent); color: var(--muni-accent); }
    .muni-meta-tag.confidence-low { border-color: #ef4444; color: #ef4444; }

    /* ── Typing indicator ─────────────────────────────── */

    .muni-typing {
      align-self: flex-start;
      display: flex;
      gap: 4px;
      padding: 12px 20px;
      background: var(--muni-bg-message);
      border: 1px solid var(--muni-border);
      border-radius: var(--muni-radius-sm) var(--muni-radius-sm) var(--muni-radius-sm) 4px;
    }

    .muni-typing-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--muni-text-dim);
      animation: muni-bounce 1.4s ease-in-out infinite;
    }

    .muni-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .muni-typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes muni-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-8px); opacity: 1; }
    }

    /* ── Mode Selector ────────────────────────────────── */

    .muni-mode-selector {
      display: flex;
      gap: 4px;
      padding: 6px 16px;
      background: rgba(15, 15, 35, 0.25);
      border-top: 1px solid var(--muni-border);
      flex-shrink: 0;
    }

    :host([data-theme="light"]) .muni-mode-selector {
      background: rgba(0, 0, 0, 0.02);
    }

    .muni-mode-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--muni-text-dim);
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-family: var(--muni-font);
      transition: all 0.2s ease;
    }

    .muni-mode-btn:hover {
      color: var(--muni-text);
      background: rgba(99, 102, 241, 0.08);
    }

    .muni-mode-btn.active {
      color: var(--muni-primary);
      background: rgba(99, 102, 241, 0.12);
      border-color: var(--muni-border);
      font-weight: 600;
    }

    /* ── Input ─────────────────────────────────────────── */

    .muni-input-area {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--muni-border);
      background: rgba(15, 15, 35, 0.6);
      flex-shrink: 0;
    }

    .muni-input {
      flex: 1;
      background: var(--muni-bg-message);
      border: 1px solid var(--muni-border);
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--muni-text);
      font-family: var(--muni-font);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
      resize: none;
      max-height: 80px;
      min-height: 20px;
      line-height: 1.4;
    }

    .muni-input::placeholder { color: var(--muni-text-dim); }

    .muni-input:focus { border-color: var(--muni-primary); }

    .muni-send {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--muni-primary), #8b5cf6);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease, opacity 0.2s ease;
      flex-shrink: 0;
    }

    .muni-send:hover { transform: scale(1.05); }
    .muni-send:active { transform: scale(0.92); }
    .muni-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .muni-send svg { width: 18px; height: 18px; fill: white; }

    /* ── Welcome ───────────────────────────────────────── */

    .muni-welcome {
      text-align: center;
      padding: 24px 20px;
    }

    .muni-welcome-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--muni-primary), #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .muni-welcome-icon svg { width: 28px; height: 28px; fill: white; }

    .muni-welcome h3 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
    }

    .muni-welcome p {
      margin: 0 0 16px;
      font-size: 13px;
      color: var(--muni-text-dim);
    }

    .muni-suggestions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .muni-suggestion {
      background: var(--muni-bg-message);
      border: 1px solid var(--muni-border);
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
      color: var(--muni-text);
      font-family: var(--muni-font);
      transition: border-color 0.2s ease, background 0.2s ease;
    }

    .muni-suggestion:hover {
      border-color: var(--muni-primary);
      background: rgba(99, 102, 241, 0.08);
    }

    /* ── Powered by ────────────────────────────────────── */

    .muni-powered {
      text-align: center;
      padding: 6px;
      font-size: 10px;
      color: var(--muni-text-dim);
      border-top: 1px solid var(--muni-border);
      flex-shrink: 0;
      opacity: 0.7;
    }

    /* ── Responsive ────────────────────────────────────── */

    @media (max-width: 480px) {
      .muni-window {
        width: calc(100vw - 16px);
        height: calc(100vh - 100px);
        bottom: 70px;
        ${config.position === "left" ? "left: -16px;" : "right: -16px;"}
        border-radius: var(--muni-radius) var(--muni-radius) 0 0;
      }
    }

    /* ── Reduced motion ────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .muni-bubble, .muni-window, .muni-msg, .muni-send, .muni-suggestion {
        transition-duration: 0.1s !important;
      }
      .muni-bubble .muni-pulse,
      .muni-typing-dot { animation: none !important; }
    }
  `;

  // ── SVG Icons ──────────────────────────────────────────────────────────────
  const ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h6v2H7z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    building: '<svg viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>',
  };

  // ── Source type labels (Spanish) ───────────────────────────────────────────
  const SOURCE_LABELS = {
    constitution: "Constitución",
    law: "Ley",
    decree: "Decreto",
    regulation: "Reglamento",
    municipal_agreement: "Acuerdo",
    council_minutes: "Acta",
    plan: "Plan",
    manual: "Manual",
    procedure: "Procedimiento",
    form: "Formulario",
    guide: "Guía",
    jurisprudence: "Jurisprudencia",
    other: "Otro",
  };

  // ── Markdown-lite renderer ─────────────────────────────────────────────────
  function renderMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(/^\s*-\s+(.+)$/gm, "• $1")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--muni-primary); text-decoration: underline;">$1</a>')
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  // ── Widget Class ───────────────────────────────────────────────────────────
  class MuniChatWidget {
    constructor() {
      this.isOpen = false;
      this.isLoading = false;
      this.messages = [];
      this.searchMode = "keyword";

      this.host = document.createElement("div");
      this.host.id = "muni-rag-widget";
      this.host.setAttribute("data-theme", config.theme);
      this.shadow = this.host.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = CSS;
      this.shadow.appendChild(style);

      this.container = document.createElement("div");
      this.shadow.appendChild(this.container);

      this.render();
      document.body.appendChild(this.host);
    }

    render() {
      this.container.innerHTML = `
        <div class="muni-window" id="muni-window">
          <div class="muni-header">
            <div class="muni-header-icon">${ICONS.building}</div>
            <div class="muni-header-text">
              <h2>${this.escapeHtml(config.title)}</h2>
              <p class="muni-header-status">Documentos municipales verificados</p>
            </div>
          </div>
          <div class="muni-messages" id="muni-messages">
            <div class="muni-welcome">
              <div class="muni-welcome-icon">${ICONS.building}</div>
              <h3>¡Bienvenido!</h3>
              <p>Consulta documentos municipales de La Antigua Guatemala. Todas las respuestas incluyen citas de fuentes oficiales.</p>
              <div class="muni-suggestions">
                <button class="muni-suggestion" data-query="ordenamiento territorial">📋 ¿Qué dice el PDM-OT sobre ordenamiento territorial?</button>
                <button class="muni-suggestion" data-query="CNPAG">🏛️ ¿Qué es el CNPAG?</button>
                <button class="muni-suggestion" data-query="patrimonio cultural">🏗️ Normativa sobre patrimonio cultural</button>
              </div>
            </div>
          </div>
          <div class="muni-mode-selector" id="muni-mode-selector">
            <button class="muni-mode-btn active" id="muni-mode-btn-keyword" data-mode="keyword">Palabras clave</button>
            <button class="muni-mode-btn" id="muni-mode-btn-phrase" data-mode="phrase">Frase exacta</button>
          </div>
          <div class="muni-input-area">
            <textarea
              class="muni-input"
              id="muni-input"
              placeholder="Escribe tu consulta..."
              rows="1"
              aria-label="Mensaje"
            ></textarea>
            <button class="muni-send" id="muni-send" aria-label="Enviar mensaje">
              ${ICONS.send}
            </button>
          </div>
          <div class="muni-powered">Evidencia de documentos municipales oficiales</div>
        </div>
        <button class="muni-bubble" id="muni-bubble" aria-label="Abrir chat de asistencia municipal">
          <span class="muni-pulse"></span>
          ${ICONS.chat}
        </button>
      `;

      this.bindEvents();
    }

    bindEvents() {
      const bubble = this.shadow.getElementById("muni-bubble");
      const input = this.shadow.getElementById("muni-input");
      const send = this.shadow.getElementById("muni-send");
      const suggestions = this.shadow.querySelectorAll(".muni-suggestion");
      const modeKeywordBtn = this.shadow.getElementById("muni-mode-btn-keyword");
      const modePhraseBtn = this.shadow.getElementById("muni-mode-btn-phrase");

      bubble.addEventListener("click", () => this.toggle());

      send.addEventListener("click", () => this.sendMessage());

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
        if (e.key === "Escape") {
          this.close();
        }
      });

      // Auto-resize textarea
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 80) + "px";
      });

      suggestions.forEach((btn) => {
        btn.addEventListener("click", () => {
          const query = btn.getAttribute("data-query");
          if (query) {
            this.shadow.getElementById("muni-input").value = query;
            this.sendMessage();
          }
        });
      });

      modeKeywordBtn.addEventListener("click", () => this.setSearchMode("keyword"));
      modePhraseBtn.addEventListener("click", () => this.setSearchMode("phrase"));
    }

    setSearchMode(mode) {
      this.searchMode = mode;
      const kwBtn = this.shadow.getElementById("muni-mode-btn-keyword");
      const phBtn = this.shadow.getElementById("muni-mode-btn-phrase");
      if (mode === "keyword") {
        kwBtn.classList.add("active");
        phBtn.classList.remove("active");
      } else {
        kwBtn.classList.remove("active");
        phBtn.classList.add("active");
      }
      this.shadow.getElementById("muni-input")?.focus();
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      const window = this.shadow.getElementById("muni-window");
      const bubble = this.shadow.getElementById("muni-bubble");
      window.classList.add("visible");
      bubble.classList.add("open");
      bubble.innerHTML = `${ICONS.close}`;
      // Focus input
      setTimeout(() => {
        this.shadow.getElementById("muni-input")?.focus();
      }, 350);
    }

    close() {
      this.isOpen = false;
      const window = this.shadow.getElementById("muni-window");
      const bubble = this.shadow.getElementById("muni-bubble");
      window.classList.remove("visible");
      bubble.classList.remove("open");
      bubble.innerHTML = `<span class="muni-pulse"></span>${ICONS.chat}`;
    }

    async sendMessage() {
      const input = this.shadow.getElementById("muni-input");
      const message = input.value.trim();
      if (!message || this.isLoading) return;

      input.value = "";
      input.style.height = "auto";

      // Remove welcome if present
      const welcome = this.shadow.querySelector(".muni-welcome");
      if (welcome) welcome.remove();

      // Add user message
      this.addMessage("user", message);

      // Show typing indicator
      this.showTyping();

      try {
        const response = await fetch(`${config.apiUrl}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, mode: this.searchMode, limit: 5 }),
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const data = await response.json();
        this.hideTyping();
        this.addAssistantMessage(data);
      } catch (err) {
        this.hideTyping();
        this.addMessage(
          "assistant",
          "Lo siento, hubo un error al procesar tu consulta. Por favor intenta de nuevo.",
          null
        );
        console.error("[MuniRAG Widget]", err);
      }
    }

    addMessage(role, content, meta) {
      const messagesEl = this.shadow.getElementById("muni-messages");
      const msgDiv = document.createElement("div");
      msgDiv.className = `muni-msg muni-msg-${role}`;

      const bubble = document.createElement("div");
      bubble.className = "muni-msg-bubble";

      if (role === "user") {
        bubble.textContent = content;
      } else {
        bubble.innerHTML = `<p>${renderMarkdown(content)}</p>`;
      }

      msgDiv.appendChild(bubble);
      messagesEl.appendChild(msgDiv);
      this.scrollToBottom();
    }

    addAssistantMessage(data) {
      const messagesEl = this.shadow.getElementById("muni-messages");
      const msgDiv = document.createElement("div");
      msgDiv.className = "muni-msg muni-msg-assistant";

      const bubble = document.createElement("div");
      bubble.className = "muni-msg-bubble";

      // Content
      bubble.innerHTML = `<p>${renderMarkdown(data.content)}</p>`;

      // Citations
      if (data.citations && data.citations.length > 0) {
        const citationsDiv = document.createElement("div");
        citationsDiv.className = "muni-citations";

        data.citations.forEach((citation) => {
          const card = document.createElement("div");
          card.className = "muni-citation";

          const sourceLabel = SOURCE_LABELS[citation.sourceType] || citation.sourceType;
          const excerpt = citation.excerpt.length > 150
            ? citation.excerpt.slice(0, 150) + "…"
            : citation.excerpt;

          card.innerHTML = `
            <div class="muni-citation-header">
              <span class="muni-citation-badge">${this.escapeHtml(sourceLabel)}</span>
              <span class="muni-citation-label">${this.escapeHtml(citation.citationLabel)}</span>
            </div>
            <div class="muni-citation-excerpt" data-excerpt-full="${this.escapeHtml(citation.excerpt)}" data-excerpt-preview="${this.escapeHtml(excerpt)}">${this.escapeHtml(excerpt)}</div>
          `;
          card.addEventListener("click", () => {
            card.classList.toggle("expanded");
            const excerptEl = card.querySelector(".muni-citation-excerpt");
            if (card.classList.contains("expanded")) {
              excerptEl.textContent = excerptEl.getAttribute("data-excerpt-full");
            } else {
              excerptEl.textContent = excerptEl.getAttribute("data-excerpt-preview");
            }
            this.scrollToBottom();
          });
          citationsDiv.appendChild(card);
        });

        bubble.appendChild(citationsDiv);
      }

      // Meta tags
      if (data.meta) {
        const metaDiv = document.createElement("div");
        metaDiv.className = "muni-meta";

        const confidence = data.meta.confidence || "low";
        metaDiv.innerHTML = `
          <span class="muni-meta-tag confidence-${confidence}">
            Confianza: ${confidence === "high" ? "Alta" : confidence === "medium" ? "Media" : "Baja"}
          </span>
          <span class="muni-meta-tag">${data.meta.evidenceCount} fuente${data.meta.evidenceCount !== 1 ? "s" : ""}</span>
        `;
        bubble.appendChild(metaDiv);
      }

      msgDiv.appendChild(bubble);
      messagesEl.appendChild(msgDiv);
      this.scrollToBottom();
    }

    showTyping() {
      this.isLoading = true;
      this.shadow.getElementById("muni-send").disabled = true;
      const messagesEl = this.shadow.getElementById("muni-messages");
      const typing = document.createElement("div");
      typing.className = "muni-typing";
      typing.id = "muni-typing";
      typing.innerHTML = `
        <span class="muni-typing-dot"></span>
        <span class="muni-typing-dot"></span>
        <span class="muni-typing-dot"></span>
      `;
      messagesEl.appendChild(typing);
      this.scrollToBottom();
    }

    hideTyping() {
      this.isLoading = false;
      this.shadow.getElementById("muni-send").disabled = false;
      const typing = this.shadow.getElementById("muni-typing");
      if (typing) typing.remove();
    }

    scrollToBottom() {
      const messagesEl = this.shadow.getElementById("muni-messages");
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }

    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // ── Initialize ─────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => new MuniChatWidget());
  } else {
    new MuniChatWidget();
  }
})();
