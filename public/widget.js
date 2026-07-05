/**
 * LA Muni RAG — Embeddable Chat Widget
 * Configuration via data attributes: data-api-url, data-position, data-theme, data-title.
 */
(function () {
  "use strict";

  const scriptTag = document.currentScript;
  const config = {
    apiUrl: scriptTag?.getAttribute("data-api-url") || (scriptTag?.src ? new URL(scriptTag.src).origin : window.location.origin),
    position: scriptTag?.getAttribute("data-position") || "right",
    theme: scriptTag?.getAttribute("data-theme") || "dark",
    title: scriptTag?.getAttribute("data-title") || "Asistente Municipal",
  };

  const CSS = `
    :host {
      --muni-primary: #7c5cff;
      --muni-primary-hover: #a5b4fc;
      --muni-cyan: #22d3ee;
      --muni-magenta: #f472b6;
      --muni-green: #22c55e;
      --muni-surface: rgba(12, 16, 36, 0.92);
      --muni-surface-strong: rgba(17, 24, 52, 0.94);
      --muni-message: rgba(19, 29, 64, 0.76);
      --muni-user: linear-gradient(135deg, #8b5cf6, #6d5df6 50%, #22d3ee);
      --muni-text: #f8fafc;
      --muni-text-dim: #a8b3c7;
      --muni-text-muted: #718096;
      --muni-border: rgba(148, 163, 184, 0.18);
      --muni-border-strong: rgba(125, 211, 252, 0.32);
      --muni-shadow: 0 34px 110px rgba(0, 0, 0, 0.56), 0 0 80px rgba(99, 102, 241, 0.18);
      --muni-radius: 28px;
      --muni-font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
      --muni-surface: rgba(255, 255, 255, 0.94);
      --muni-surface-strong: rgba(255, 255, 255, 0.98);
      --muni-message: rgba(239, 246, 255, 0.94);
      --muni-text: #111827;
      --muni-text-dim: #475569;
      --muni-text-muted: #64748b;
      --muni-border: rgba(79, 70, 229, 0.16);
      --muni-border-strong: rgba(79, 70, 229, 0.34);
      --muni-shadow: 0 28px 80px rgba(15, 23, 42, 0.16);
    }

    .muni-bubble {
      width: 66px;
      height: 66px;
      border-radius: 24px;
      background: radial-gradient(circle at 30% 18%, rgba(255,255,255,0.62), transparent 18%), linear-gradient(135deg, #6d5df6, #8b5cf6 56%, #22d3ee);
      border: 1px solid rgba(255,255,255,0.18);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 60px rgba(109, 93, 246, 0.42), 0 0 0 8px rgba(99,102,241,0.10);
      transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.32s ease, border-radius 0.32s ease;
      position: relative;
      overflow: hidden;
    }
    .muni-bubble::before { content: ""; position: absolute; inset: -45%; background: conic-gradient(from 20deg, transparent, rgba(34,211,238,0.55), transparent, rgba(244,114,182,0.42), transparent); animation: muni-orbit 8s linear infinite; opacity: 0.72; }
    .muni-bubble::after { content: ""; position: absolute; inset: 3px; border-radius: 21px; background: linear-gradient(135deg, rgba(124,92,255,0.92), rgba(88,80,236,0.92)); }
    .muni-bubble:hover { transform: translateY(-4px) scale(1.035); box-shadow: 0 26px 76px rgba(109, 93, 246, 0.56), 0 0 0 10px rgba(34,211,238,0.10); }
    .muni-bubble.open { border-radius: 22px; }
    .muni-bubble svg { position: relative; z-index: 2; width: 28px; height: 28px; fill: white; filter: drop-shadow(0 8px 18px rgba(0,0,0,0.24)); transition: transform 0.3s ease; }
    .muni-bubble.open svg { transform: rotate(90deg); }
    .muni-pulse { display: none; }
    @keyframes muni-orbit { to { transform: rotate(360deg); } }

    .muni-window {
      position: absolute;
      bottom: 82px;
      ${config.position === "left" ? "left: 0;" : "right: 0;"}
      width: min(440px, calc(100vw - 32px));
      height: min(680px, calc(100vh - 122px));
      min-height: 520px;
      background: radial-gradient(circle at 18% 0%, rgba(34,211,238,0.20), transparent 30%), radial-gradient(circle at 92% 18%, rgba(139,92,246,0.22), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03)), var(--muni-surface);
      backdrop-filter: blur(28px) saturate(170%);
      -webkit-backdrop-filter: blur(28px) saturate(170%);
      border: 1px solid var(--muni-border);
      border-radius: var(--muni-radius);
      box-shadow: var(--muni-shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(22px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.34s cubic-bezier(0.4, 0, 0.2, 1), transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .muni-window::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px); background-size: 34px 34px; mask-image: linear-gradient(to bottom, black, transparent 72%); opacity: 0.9; }
    .muni-window::after { content: ""; position: absolute; left: 18px; right: 18px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(34,211,238,0.68), rgba(244,114,182,0.56), transparent); pointer-events: none; }
    .muni-window > * { position: relative; z-index: 1; }
    .muni-window.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

    .muni-header { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; padding: 18px 20px 16px; background: linear-gradient(135deg, rgba(124,92,255,0.20), rgba(34,211,238,0.08) 50%, rgba(244,114,182,0.08)); border-bottom: 1px solid var(--muni-border); flex-shrink: 0; }
    .muni-header-icon { width: 48px; height: 48px; border-radius: 18px; background: radial-gradient(circle at 32% 20%, rgba(255,255,255,0.52), transparent 20%), linear-gradient(135deg, #6d5df6, #8b5cf6 56%, #22d3ee); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.20); box-shadow: 0 16px 36px rgba(109,93,246,0.28); }
    .muni-header-icon svg { width: 23px; height: 23px; fill: white; }
    .muni-header-text h2 { margin: 0; font-size: 18px; font-weight: 850; letter-spacing: -0.03em; color: var(--muni-text); }
    .muni-header-status { display: inline-flex; align-items: center; gap: 8px; margin: 4px 0 0; font-size: 12px; color: var(--muni-text-dim); }
    .muni-header-status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--muni-green); box-shadow: 0 0 14px rgba(34,197,94,0.72); }
    .muni-header-rail { grid-column: 1 / -1; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .muni-rail-pill { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muni-primary-hover); border: 1px solid rgba(165,180,252,0.24); background: rgba(124,92,255,0.10); border-radius: 999px; padding: 4px 8px; }

    .muni-messages { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; background: linear-gradient(180deg, rgba(5,7,22,0.18), rgba(5,7,22,0.34)); }
    .muni-messages::-webkit-scrollbar { width: 8px; }
    .muni-messages::-webkit-scrollbar-track { background: transparent; }
    .muni-messages::-webkit-scrollbar-thumb { background: linear-gradient(180deg, rgba(124,92,255,0.74), rgba(34,211,238,0.34)); border-radius: 999px; border: 2px solid rgba(5,7,22,0.4); }
    .muni-msg { max-width: 92%; animation: muni-msgIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }
    @keyframes muni-msgIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .muni-msg-user { align-self: flex-end; }
    .muni-msg-assistant { align-self: flex-start; width: min(100%, 392px); }
    .muni-msg-user .muni-msg-bubble { background: var(--muni-user); color: white; border-radius: 20px 20px 6px 20px; padding: 12px 16px; box-shadow: 0 16px 36px rgba(109,93,246,0.24); font-weight: 680; letter-spacing: -0.01em; }
    .muni-msg-assistant .muni-msg-bubble { position: relative; background: linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025)), var(--muni-message); border: 1px solid var(--muni-border-strong); border-radius: 22px 22px 22px 8px; padding: 16px; box-shadow: 0 18px 46px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08); overflow: hidden; }
    .muni-msg-assistant .muni-msg-bubble::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: linear-gradient(180deg, var(--muni-cyan), var(--muni-primary), var(--muni-magenta)); opacity: 0.9; }
    .muni-answer-kicker { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 10px; color: var(--muni-primary-hover); font-size: 10px; font-weight: 850; letter-spacing: 0.12em; text-transform: uppercase; }
    .muni-answer-kicker::before { content: ""; width: 7px; height: 7px; border-radius: 999px; background: var(--muni-cyan); box-shadow: 0 0 14px rgba(34,211,238,0.86); }
    .muni-answer-summary { margin: 0 0 12px; font-size: 14px; line-height: 1.62; color: var(--muni-text); }
    .muni-answer-summary strong { color: var(--muni-primary-hover); }
    .muni-key-findings { margin: 10px 0 12px; padding: 12px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(125,211,252,0.12); }
    .muni-key-findings-title { display: block; color: var(--muni-cyan); font-size: 10px; font-weight: 850; letter-spacing: 0.10em; text-transform: uppercase; margin-bottom: 8px; }
    .muni-key-findings ul { margin: 0; padding-left: 18px; color: var(--muni-text-dim); line-height: 1.55; }
    .muni-key-findings li { margin: 5px 0; }
    .muni-answer-content p, .muni-msg-bubble p { margin: 0 0 10px; }
    .muni-msg-bubble blockquote { margin: 8px 0; padding: 10px 12px; border-left: 3px solid var(--muni-primary); background: rgba(124,92,255,0.10); border-radius: 0 12px 12px 0; font-size: 13px; color: var(--muni-text-dim); }

    .muni-evidence-summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 12px 0; padding: 10px 12px; border-radius: 16px; background: rgba(34,211,238,0.06); border: 1px solid rgba(34,211,238,0.16); }
    .muni-evidence-summary strong { display: block; font-size: 12px; color: var(--muni-text); }
    .muni-evidence-summary span { display: block; font-size: 11px; color: var(--muni-text-dim); }
    .muni-evidence-toggle { border: 1px solid rgba(165,180,252,0.26); background: rgba(124,92,255,0.14); color: #c4b5fd; border-radius: 999px; padding: 7px 10px; cursor: pointer; font-family: var(--muni-font); font-size: 11px; font-weight: 820; white-space: nowrap; }
    .muni-source-stack { display: flex; flex-wrap: wrap; gap: 7px; margin: 8px 0 12px; }
    .muni-source-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 820; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muni-primary-hover); border: 1px solid rgba(165,180,252,0.20); border-radius: 999px; padding: 5px 8px; background: rgba(124,92,255,0.08); }
    .muni-citations { display: grid; gap: 10px; margin-top: 10px; }
    .muni-citations.collapsed { display: none; }
    .muni-citation { position: relative; background: linear-gradient(180deg, rgba(124,92,255,0.12), rgba(34,211,238,0.05)), rgba(8,13,34,0.72); border: 1px solid rgba(125,211,252,0.18); border-radius: 16px; padding: 12px; cursor: pointer; transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); overflow: hidden; }
    .muni-citation:hover { transform: translateY(-2px); border-color: rgba(125,211,252,0.38); background: rgba(22,31,70,0.86); }
    .muni-citation-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .muni-citation-badge, .muni-citation-index { font-size: 10px; font-weight: 850; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 8px; border-radius: 999px; white-space: nowrap; }
    .muni-citation-badge { background: linear-gradient(135deg, var(--muni-primary), #8b5cf6); color: white; box-shadow: 0 10px 22px rgba(124,92,255,0.22); }
    .muni-citation-index { color: var(--muni-cyan); border: 1px solid rgba(34,211,238,0.20); background: rgba(34,211,238,0.06); }
    .muni-citation-label { display: block; color: var(--muni-text); font-size: 12px; font-weight: 760; line-height: 1.35; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .muni-citation-excerpt { color: var(--muni-text-dim); font-size: 12px; line-height: 1.48; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.045); border-left: 3px solid var(--muni-cyan); }
    .muni-citation.expanded .muni-citation-label { white-space: normal; }
    .muni-citation.expanded .muni-citation-excerpt { display: block; -webkit-line-clamp: unset; overflow: visible; }
    .muni-followups { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .muni-followup-chip { font-family: var(--muni-font); cursor: pointer; border: 1px solid rgba(165,180,252,0.24); background: linear-gradient(135deg, rgba(124,92,255,0.16), rgba(34,211,238,0.06)); color: var(--muni-text); border-radius: 999px; padding: 8px 10px; font-size: 11px; font-weight: 760; transition: transform 0.2s ease, border-color 0.2s ease; }
    .muni-followup-chip:hover { transform: translateY(-1px); border-color: rgba(125,211,252,0.42); }
    .muni-meta { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .muni-meta-tag { font-size: 10px; padding: 4px 8px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.18); color: var(--muni-text-dim); text-transform: uppercase; letter-spacing: 0.08em; background: rgba(255,255,255,0.035); }
    .confidence-high { border-color: rgba(34,197,94,0.45); color: #86efac; }
    .confidence-medium { border-color: rgba(245,158,11,0.45); color: #fcd34d; }
    .confidence-low { border-color: rgba(248,113,113,0.45); color: #fca5a5; }

    .muni-typing { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--muni-message); border: 1px solid var(--muni-border-strong); border-radius: 18px 18px 18px 6px; color: var(--muni-text-dim); box-shadow: 0 14px 38px rgba(0,0,0,0.18); }
    .muni-typing-label { font-size: 12px; font-weight: 700; }
    .muni-typing-dots { display: inline-flex; gap: 4px; }
    .muni-typing-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muni-cyan); animation: muni-bounce 1.4s ease-in-out infinite; }
    .muni-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .muni-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes muni-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.36; } 30% { transform: translateY(-7px); opacity: 1; } }

    .muni-mode-selector { display: flex; gap: 6px; padding: 10px 14px 0; background: rgba(5,7,22,0.56); border-top: 1px solid var(--muni-border); flex-shrink: 0; }
    .muni-mode-btn { background: rgba(255,255,255,0.035); border: 1px solid transparent; color: var(--muni-text-dim); font-size: 11px; font-weight: 780; padding: 7px 12px; border-radius: 999px; cursor: pointer; font-family: var(--muni-font); transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, transform 0.2s ease; }
    .muni-mode-btn:hover { color: var(--muni-text); background: rgba(124,92,255,0.10); transform: translateY(-1px); }
    .muni-mode-btn.active { color: #c4b5fd; background: linear-gradient(135deg, rgba(124,92,255,0.22), rgba(34,211,238,0.08)); border-color: rgba(165,180,252,0.26); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
    .muni-input-area { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 10px; padding: 12px 14px 14px; border-top: 1px solid rgba(255,255,255,0.045); background: rgba(5,7,22,0.66); flex-shrink: 0; }
    .muni-input { width: 100%; background: rgba(15,23,52,0.92); border: 1px solid rgba(125,211,252,0.18); border-radius: 16px; padding: 13px 14px; color: var(--muni-text); font-family: var(--muni-font); font-size: 14px; outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; resize: none; max-height: 90px; min-height: 46px; line-height: 1.42; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); }
    .muni-input::placeholder { color: var(--muni-text-muted); }
    .muni-input:focus { border-color: rgba(125,211,252,0.46); box-shadow: 0 0 0 4px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.08); background: rgba(18,28,64,0.96); }
    .muni-send { width: 46px; height: 46px; border-radius: 16px; background: linear-gradient(135deg, #8b5cf6, #6d5df6 58%, #22d3ee); border: 1px solid rgba(255,255,255,0.14); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.15s ease, opacity 0.2s ease, box-shadow 0.2s ease; flex-shrink: 0; box-shadow: 0 14px 34px rgba(109,93,246,0.30); }
    .muni-send:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 18px 42px rgba(109,93,246,0.42); }
    .muni-send:disabled { opacity: 0.44; cursor: not-allowed; transform: none; }
    .muni-send svg { width: 18px; height: 18px; fill: white; }

    .muni-welcome { padding: 26px 18px; border: 1px solid rgba(125,211,252,0.14); border-radius: 24px; background: radial-gradient(circle at 20% 0%, rgba(34,211,238,0.14), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); }
    .muni-welcome-icon { width: 54px; height: 54px; border-radius: 18px; background: linear-gradient(135deg, #6d5df6, #8b5cf6 58%, #22d3ee); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 18px 42px rgba(109,93,246,0.26); }
    .muni-welcome-icon svg { width: 27px; height: 27px; fill: white; }
    .muni-welcome h3 { margin: 0 0 8px; font-size: 18px; font-weight: 850; letter-spacing: -0.03em; }
    .muni-welcome p { margin: 0 0 16px; font-size: 13px; color: var(--muni-text-dim); line-height: 1.55; }
    .muni-suggestions { display: grid; gap: 8px; }
    .muni-suggestion { background: rgba(15,23,52,0.76); border: 1px solid rgba(125,211,252,0.14); border-radius: 14px; padding: 10px 12px; cursor: pointer; text-align: left; font-size: 12px; color: var(--muni-text); font-family: var(--muni-font); line-height: 1.35; transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease; }
    .muni-suggestion:hover { transform: translateY(-1px); border-color: rgba(125,211,252,0.34); background: rgba(30,41,82,0.82); }
    .muni-powered { text-align: center; padding: 8px 12px 10px; font-size: 10px; color: var(--muni-text-muted); border-top: 1px solid rgba(255,255,255,0.045); background: rgba(5,7,22,0.72); flex-shrink: 0; letter-spacing: 0.04em; }

    @media (max-width: 480px) {
      :host { bottom: 16px; ${config.position === "left" ? "left: 16px;" : "right: 16px;"} }
      .muni-bubble { width: 58px; height: 58px; border-radius: 20px; }
      .muni-window { width: calc(100vw - 24px); height: calc(100dvh - 96px); min-height: 0; bottom: 72px; ${config.position === "left" ? "left: 0;" : "right: 0;"} border-radius: 24px; }
      .muni-header { padding: 14px 16px 12px; }
      .muni-header-icon { width: 42px; height: 42px; border-radius: 15px; }
      .muni-header-text h2 { font-size: 15px; }
      .muni-header-rail { display: none; }
      .muni-messages { padding: 14px; gap: 12px; }
      .muni-msg { max-width: 96%; }
      .muni-msg-assistant { width: 100%; }
      .muni-msg-assistant .muni-msg-bubble { padding: 14px; border-radius: 20px 20px 20px 8px; }
      .muni-citation-label { white-space: normal; }
      .muni-mode-selector { padding: 9px 12px 0; overflow-x: auto; }
      .muni-input-area { padding: 10px 12px 12px; }
      .muni-evidence-summary { align-items: flex-start; flex-direction: column; }
      .muni-evidence-toggle { width: 100%; }
    }

    @media (prefers-reduced-motion: reduce) {
      .muni-bubble, .muni-bubble::before, .muni-window, .muni-msg, .muni-send, .muni-suggestion, .muni-citation, .muni-followup-chip, .muni-typing-dot {
        animation: none !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  const ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7zm0 6h6v2H7z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    building: '<svg viewBox="0 0 24 24"><path d="M12 3 3 8v2h18V8l-9-5Zm-5 9v7H5v2h14v-2h-2v-7h-2v7h-2v-7h-2v7H9v-7H7Z"/></svg>',
  };

  const SOURCE_LABELS = { constitution: "Constitución", law: "Ley", decree: "Decreto", regulation: "Reglamento", municipal_agreement: "Acuerdo", council_minutes: "Acta", plan: "Plan", manual: "Manual", procedure: "Procedimiento", form: "Formulario", guide: "Guía", jurisprudence: "Jurisprudencia", other: "Otro" };
  const THEME_RULES = [
    { label: "Agua potable y saneamiento", query: "agua potable saneamiento", pattern: /agua potable|saneamiento|acceso.*agua|universal.*agua/i },
    { label: "Aguas residuales", query: "aguas residuales tratamiento", pattern: /residual|tratamiento de aguas|drenaje/i },
    { label: "Aguas pluviales", query: "aguas pluviales", pattern: /pluvial|lluvia|escorrent/i },
    { label: "Acueducto y abastecimiento", query: "acueducto abastecimiento agua", pattern: /acueducto|pozo|xay[aá]|pixcay[aá]|abastecimiento/i },
    { label: "Necesidades locales", query: "necesidades locales", pattern: /necesidad|problem[aá]tica|capacidad productiva|prioridad local/i },
    { label: "Prioridades municipales", query: "prioridades municipales", pattern: /prioridad|estrategia|meta|ods|desarrollo/i },
  ];

  function escapeHtml(text) { const div = document.createElement("div"); div.textContent = String(text ?? ""); return div.innerHTML; }
  function renderMarkdown(text) { return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>").replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>").replace(/^\s*-\s+(.+)$/gm, "• $1").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>"); }
  function normalizeSpaces(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function isBroadQuery(query) { return normalizeSpaces(query).split(/\s+/).filter(Boolean).length <= 3; }
  function isRetrievalDump(content) { return /Encontr[eé]\s+\d+\s+(referencias|resultados)/i.test(content || "") || /\d+\.\s+.+p[aá]gina\s+\d+/i.test(content || "") || /PDM-OT.+p[aá]gina/i.test(content || ""); }
  function cleanMainAnswer(content) { return String(content || "").split("\n").filter((line) => !/^\s*\d+\.\s+.+p[aá]gina\s+\d+/i.test(line)).filter((line) => !/^\s*\(.+Municipal.+\)\s*$/i.test(line)).join("\n").replace(/Encontr[eé]\s+\d+\s+(referencias|resultados).+?(consulta\.|evidencia puede no ser suficiente:)/i, "").trim(); }
  function detectThemes(query, citations) { const corpus = `${query || ""} ${(citations || []).map((c) => `${c.citationLabel || ""} ${c.excerpt || ""}`).join(" ")}`; return THEME_RULES.filter((rule) => rule.pattern.test(corpus)).slice(0, 4); }
  function compactSourceLabel(citation) { return (citation?.citationLabel || "Documento municipal").replace(/,\s*p[aá]gina\s*/i, " · pág. ").replace(/\s+/g, " ").trim(); }
  function composeAnswerView(data, query) {
    const citations = Array.isArray(data?.citations) ? data.citations : [];
    const rawContent = String(data?.content || "");
    const dumpLike = isRetrievalDump(rawContent);
    const themes = detectThemes(query, citations);
    const cleaned = cleanMainAnswer(rawContent);
    let summary;
    if (citations.length && dumpLike) summary = isBroadQuery(query) ? `Encontré evidencia sobre “${normalizeSpaces(query)}”. No la presentaría como una respuesta única cerrada; el documento permite revisar el tema por hallazgos y fuentes.` : "Encontré evidencia municipal relacionada con tu consulta. Te dejo una síntesis primero y las fuentes verificadas aparte para no mezclar respuesta con citas.";
    else if (cleaned) summary = cleaned.length > 520 ? `${cleaned.slice(0, 520).trim()}…` : cleaned;
    else if (citations.length) summary = `Encontré ${citations.length} referencia${citations.length === 1 ? "" : "s"} relacionada${citations.length === 1 ? "" : "s"} con tu consulta.`;
    else summary = "No encontré evidencia municipal suficiente para responder con confianza. Puedes intentar una consulta más específica o cambiar a frase exacta.";
    const findings = themes.length ? themes.map((theme) => theme.label) : citations.slice(0, 3).map((citation) => compactSourceLabel(citation));
    const followups = themes.length ? themes.map((theme) => ({ label: theme.label, query: theme.query })) : [{ label: "Buscar frase exacta", query: normalizeSpaces(query), mode: "phrase" }, { label: "Ver necesidades locales", query: "necesidades locales" }, { label: "Ver prioridades municipales", query: "prioridades municipales" }];
    return { summary, findings, followups: followups.slice(0, 4), citations };
  }

  class MuniChatWidget {
    constructor() {
      this.isOpen = false;
      this.isLoading = false;
      this.searchMode = "keyword";
      this.lastQuery = "";
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
      this.container.innerHTML = `<div class="muni-window" id="muni-window"><div class="muni-header"><div class="muni-header-icon">${ICONS.building}</div><div class="muni-header-text"><h2>${this.escapeHtml(config.title)}</h2><p class="muni-header-status">Documentos municipales verificados</p></div><div class="muni-header-rail" aria-hidden="true"><span class="muni-rail-pill">Evidencia</span><span class="muni-rail-pill">Citas</span><span class="muni-rail-pill">Sin caja negra</span></div></div><div class="muni-messages" id="muni-messages"><div class="muni-welcome"><div class="muni-welcome-icon">${ICONS.building}</div><h3>Consulta municipal con evidencia</h3><p>Haz preguntas sobre documentos municipales de La Antigua Guatemala. Las respuestas muestran una síntesis primero y fuentes verificables después.</p><div class="muni-suggestions"><button class="muni-suggestion" data-query="ordenamiento territorial">Plan Municipal · Ordenamiento territorial</button><button class="muni-suggestion" data-query="CNPAG">Patrimonio · ¿Qué es el CNPAG?</button><button class="muni-suggestion" data-query="agua">Agua · Hallazgos principales</button></div></div></div><div class="muni-mode-selector" id="muni-mode-selector"><button class="muni-mode-btn active" id="muni-mode-btn-keyword" data-mode="keyword">Palabras clave</button><button class="muni-mode-btn" id="muni-mode-btn-phrase" data-mode="phrase">Frase exacta</button></div><div class="muni-input-area"><textarea class="muni-input" id="muni-input" placeholder="Escribe tu consulta municipal..." rows="1" aria-label="Mensaje"></textarea><button class="muni-send" id="muni-send" aria-label="Enviar mensaje">${ICONS.send}</button></div><div class="muni-powered">Evidencia de documentos municipales oficiales</div></div><button class="muni-bubble" id="muni-bubble" aria-label="Abrir chat de asistencia municipal"><span class="muni-pulse"></span>${ICONS.chat}</button>`;
      this.bindEvents();
    }

    bindEvents() {
      const bubble = this.shadow.getElementById("muni-bubble");
      const input = this.shadow.getElementById("muni-input");
      const send = this.shadow.getElementById("muni-send");
      bubble.addEventListener("click", () => this.toggle());
      send.addEventListener("click", () => this.sendMessage());
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendMessage(); } if (e.key === "Escape") this.close(); });
      input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 90) + "px"; });
      this.shadow.querySelectorAll(".muni-suggestion").forEach((btn) => btn.addEventListener("click", () => this.sendQuery(btn.getAttribute("data-query") || "")));
      this.shadow.getElementById("muni-mode-btn-keyword").addEventListener("click", () => this.setSearchMode("keyword"));
      this.shadow.getElementById("muni-mode-btn-phrase").addEventListener("click", () => this.setSearchMode("phrase"));
    }

    setSearchMode(mode) { this.searchMode = mode; const kwBtn = this.shadow.getElementById("muni-mode-btn-keyword"); const phBtn = this.shadow.getElementById("muni-mode-btn-phrase"); if (mode === "keyword") { kwBtn.classList.add("active"); phBtn.classList.remove("active"); } else { kwBtn.classList.remove("active"); phBtn.classList.add("active"); } this.shadow.getElementById("muni-input")?.focus(); }
    sendQuery(query, mode) { if (mode) this.setSearchMode(mode); const input = this.shadow.getElementById("muni-input"); input.value = query; this.sendMessage(); }
    toggle() { this.isOpen ? this.close() : this.open(); }
    open() { this.isOpen = true; const win = this.shadow.getElementById("muni-window"); const bubble = this.shadow.getElementById("muni-bubble"); win.classList.add("visible"); bubble.classList.add("open"); bubble.innerHTML = ICONS.close; setTimeout(() => this.shadow.getElementById("muni-input")?.focus(), 300); }
    close() { this.isOpen = false; const win = this.shadow.getElementById("muni-window"); const bubble = this.shadow.getElementById("muni-bubble"); win.classList.remove("visible"); bubble.classList.remove("open"); bubble.innerHTML = `<span class="muni-pulse"></span>${ICONS.chat}`; }

    async sendMessage() {
      const input = this.shadow.getElementById("muni-input");
      const message = input.value.trim();
      if (!message || this.isLoading) return;
      this.lastQuery = message;
      input.value = "";
      input.style.height = "auto";
      const welcome = this.shadow.querySelector(".muni-welcome");
      if (welcome) welcome.remove();
      this.addMessage("user", message);
      this.showTyping();
      try {
        const response = await fetch(`${config.apiUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, mode: this.searchMode, limit: 5 }) });
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const data = await response.json();
        this.hideTyping();
        this.addAssistantMessage(data, message);
      } catch (err) {
        this.hideTyping();
        this.addMessage("assistant", "Lo siento, hubo un error al procesar tu consulta. Por favor intenta de nuevo.");
        console.error("[MuniRAG Widget]", err);
      }
    }

    addMessage(role, content) {
      const messagesEl = this.shadow.getElementById("muni-messages");
      const msgDiv = document.createElement("div");
      msgDiv.className = `muni-msg muni-msg-${role}`;
      const bubble = document.createElement("div");
      bubble.className = "muni-msg-bubble";
      if (role === "user") bubble.textContent = content;
      else bubble.innerHTML = `<span class="muni-answer-kicker">Respuesta con evidencia</span><div class="muni-answer-content"><p>${renderMarkdown(content)}</p></div>`;
      msgDiv.appendChild(bubble);
      messagesEl.appendChild(msgDiv);
      this.scrollToBottom();
    }

    addAssistantMessage(data, query = this.lastQuery) {
      const view = composeAnswerView(data, query);
      const messagesEl = this.shadow.getElementById("muni-messages");
      const msgDiv = document.createElement("div");
      msgDiv.className = "muni-msg muni-msg-assistant";
      const bubble = document.createElement("div");
      bubble.className = "muni-msg-bubble";
      const sourceChips = view.citations.slice(0, 3).map((citation) => `<span class="muni-source-chip">${this.escapeHtml(compactSourceLabel(citation))}</span>`).join("");
      const findings = view.findings.length ? `<div class="muni-key-findings"><span class="muni-key-findings-title">Hallazgos clave</span><ul>${view.findings.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
      const followups = view.followups.length ? `<div class="muni-followups">${view.followups.map((item) => `<button class="muni-followup-chip" data-query="${this.escapeHtml(item.query)}" data-mode="${this.escapeHtml(item.mode || "keyword")}">${this.escapeHtml(item.label)}</button>`).join("")}</div>` : "";
      const evidenceSummary = view.citations.length ? `<div class="muni-evidence-summary"><div><strong>Fuentes verificadas · ${view.citations.length}</strong><span>La evidencia está separada de la respuesta para facilitar lectura.</span></div><button class="muni-evidence-toggle" type="button" aria-expanded="true">Ocultar evidencia</button></div><div class="muni-source-stack">${sourceChips}</div>` : "";
      bubble.innerHTML = `<span class="muni-answer-kicker">Respuesta con evidencia</span><p class="muni-answer-summary">${renderMarkdown(view.summary)}</p>${findings}${evidenceSummary}`;
      if (view.citations.length > 0) bubble.appendChild(this.renderCitationList(view.citations));
      if (data?.meta) bubble.appendChild(this.renderMeta(data.meta));
      bubble.insertAdjacentHTML("beforeend", followups);
      msgDiv.appendChild(bubble);
      messagesEl.appendChild(msgDiv);
      this.bindAssistantInteractions(msgDiv);
      this.scrollToBottom();
    }

    renderCitationList(citations) {
      const citationsDiv = document.createElement("div");
      citationsDiv.className = "muni-citations";
      citations.forEach((citation, index) => {
        const card = document.createElement("div");
        card.className = "muni-citation";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        const sourceLabel = SOURCE_LABELS[citation.sourceType] || citation.sourceType || "Fuente";
        const fullExcerpt = citation.excerpt || "";
        const preview = fullExcerpt.length > 170 ? fullExcerpt.slice(0, 170) + "…" : fullExcerpt;
        const citationLabel = citation.citationLabel || "Documento municipal";
        card.innerHTML = `<div class="muni-citation-header"><span class="muni-citation-badge">${this.escapeHtml(sourceLabel)}</span><span class="muni-citation-index">Evidencia ${index + 1}</span></div><span class="muni-citation-label">${this.escapeHtml(citationLabel)}</span><div class="muni-citation-excerpt" data-excerpt-full="${this.escapeHtml(fullExcerpt)}" data-excerpt-preview="${this.escapeHtml(preview)}">${this.escapeHtml(preview)}</div>`;
        citationsDiv.appendChild(card);
      });
      return citationsDiv;
    }

    renderMeta(meta) { const metaDiv = document.createElement("div"); metaDiv.className = "muni-meta"; const confidence = meta.confidence || "low"; const confidenceLabel = confidence === "high" ? "Alta" : confidence === "medium" ? "Media" : "Baja"; const evidenceCount = meta.evidenceCount || 0; metaDiv.innerHTML = `<span class="muni-meta-tag confidence-${this.escapeHtml(confidence)}">Confianza ${confidenceLabel}</span><span class="muni-meta-tag">${this.escapeHtml(evidenceCount)} fuente${evidenceCount !== 1 ? "s" : ""}</span>`; return metaDiv; }
    bindAssistantInteractions(scope) {
      const toggle = scope.querySelector(".muni-evidence-toggle");
      if (toggle) toggle.addEventListener("click", () => { const citations = scope.querySelector(".muni-citations"); const isCollapsed = citations.classList.toggle("collapsed"); toggle.textContent = isCollapsed ? "Ver evidencia" : "Ocultar evidencia"; toggle.setAttribute("aria-expanded", String(!isCollapsed)); this.scrollToBottom(); });
      scope.querySelectorAll(".muni-citation").forEach((card) => { const toggleCard = () => { const excerptEl = card.querySelector(".muni-citation-excerpt"); card.classList.toggle("expanded"); excerptEl.textContent = card.classList.contains("expanded") ? excerptEl.getAttribute("data-excerpt-full") : excerptEl.getAttribute("data-excerpt-preview"); this.scrollToBottom(); }; card.addEventListener("click", toggleCard); card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleCard(); } }); });
      scope.querySelectorAll(".muni-followup-chip").forEach((chip) => chip.addEventListener("click", () => this.sendQuery(chip.getAttribute("data-query") || "", chip.getAttribute("data-mode") || "keyword")));
    }
    showTyping() { this.isLoading = true; this.shadow.getElementById("muni-send").disabled = true; const messagesEl = this.shadow.getElementById("muni-messages"); const typing = document.createElement("div"); typing.className = "muni-typing"; typing.id = "muni-typing"; typing.innerHTML = `<span class="muni-typing-label">Consultando evidencia</span><span class="muni-typing-dots"><span class="muni-typing-dot"></span><span class="muni-typing-dot"></span><span class="muni-typing-dot"></span></span>`; messagesEl.appendChild(typing); this.scrollToBottom(); }
    hideTyping() { this.isLoading = false; this.shadow.getElementById("muni-send").disabled = false; const typing = this.shadow.getElementById("muni-typing"); if (typing) typing.remove(); }
    scrollToBottom() { const messagesEl = this.shadow.getElementById("muni-messages"); requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }); }
    escapeHtml(text) { return escapeHtml(text); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => new MuniChatWidget());
  else new MuniChatWidget();
})();
