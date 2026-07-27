export const HUMAN_SHELL_HTML = String.raw`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Espacio de trabajo autenticado y role-aware de LA Muni RAG.">
  <title>LA Muni RAG — Espacio de trabajo</title>
  <link rel="icon" href="/app/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/app/shell.css">
  <script src="/app/shell.js" defer></script>
</head>
<body data-shell-state="loading">
  <a class="skip-link" href="#workspace-main">Saltar al espacio de trabajo</a>
  <div class="shell-frame">
    <header class="topbar">
      <a class="brand" href="/app" aria-label="LA Muni RAG, espacio de trabajo">
        <span class="brand-mark" aria-hidden="true">LM</span>
        <span><strong>LA Muni RAG</strong><small>Espacio de trabajo</small></span>
      </a>
      <div class="session-summary" aria-live="polite">
        <span class="state-indicator" aria-hidden="true"></span>
        <span id="session-state-label">Verificando sesión</span>
      </div>
      <div class="session-actions">
        <button id="rotate-session" class="button button-secondary" type="button" hidden>Renovar sesión</button>
        <button id="logout" class="button button-danger" type="button" hidden>Cerrar sesión</button>
      </div>
    </header>

    <aside class="sidebar" aria-label="Navegación del producto">
      <nav id="product-navigation" hidden>
        <button type="button" data-route="overview" aria-current="page">Resumen</button>
        <button type="button" data-route="evidence" data-permission="evidence:query" hidden>Consulta y evidencia</button>
        <button type="button" data-route="procedures" data-permission="procedure:read" hidden>Procedimientos</button>
        <button type="button" data-route="cases" data-permission="case:read" hidden>Casos</button>
        <button type="button" data-route="sources" data-permission="source:read" hidden>Fuentes</button>
        <button type="button" data-route="documents" data-permission="document:read" hidden>Documentos</button>
        <button type="button" data-route="ingestion" data-permission="document:ingest" hidden>Ingesta</button>
        <button type="button" data-route="authoring" data-permission="procedure:draft" hidden>Autoría</button>
        <button type="button" data-route="review" data-permission="procedure:review" hidden>Revisión</button>
        <button type="button" data-route="approval" data-permission="procedure:approve" hidden>Aprobación</button>
        <button type="button" data-route="identity" data-permission="identity:manage" hidden>Identidad y acceso</button>
        <button type="button" data-route="audit" data-permission="audit:read" hidden>Auditoría</button>
        <button type="button" data-route="platform" data-permission="platform:admin" hidden>Plataforma</button>
      </nav>
      <div class="boundary-note">
        <strong>Sesión BFF</strong>
        <span>Sin tokens Bearer ni credenciales en almacenamiento del navegador.</span>
      </div>
    </aside>

    <main id="workspace-main" class="workspace" tabindex="-1">
      <section id="shell-loading" class="state-card" aria-labelledby="loading-title">
        <p class="eyebrow">Sesión</p>
        <h1 id="loading-title">Verificando acceso…</h1>
        <p>El navegador solicita una sesión de backend del mismo origen. No se lee ni expone la cookie HttpOnly.</p>
      </section>

      <section id="shell-unauthenticated" class="state-card" hidden aria-labelledby="sign-in-title">
        <p class="eyebrow">Acceso requerido</p>
        <h1 id="sign-in-title">Inicia sesión para continuar.</h1>
        <p>El acceso humano usa un flujo de identidad aprobado y una sesión BFF. Las credenciales de integración no se aceptan en esta interfaz.</p>
        <a id="sign-in" class="button button-primary" href="/auth/login?return_to=%2Fapp">Iniciar sesión</a>
      </section>

      <section id="shell-unavailable" class="state-card" hidden aria-labelledby="unavailable-title">
        <p class="eyebrow">Configuración cerrada</p>
        <h1 id="unavailable-title">El acceso humano no está configurado.</h1>
        <p>El servidor permanece fail-closed hasta que exista una composición de identidad explícitamente aprobada.</p>
      </section>

      <section id="shell-error" class="state-card" hidden aria-labelledby="error-title">
        <p class="eyebrow">Acceso no disponible</p>
        <h1 id="error-title">No fue posible verificar la sesión.</h1>
        <p id="shell-error-message">Vuelve a intentarlo sin compartir credenciales ni datos personales.</p>
        <button id="retry-session" class="button button-primary" type="button">Reintentar</button>
      </section>

      <div id="authenticated-workspace" hidden>
        <section class="identity-card" aria-labelledby="workspace-title">
          <div>
            <p class="eyebrow">Contexto autorizado</p>
            <h1 id="workspace-title">Espacio municipal</h1>
            <p id="identity-summary">Sesión local verificada.</p>
          </div>
          <div class="identity-metadata">
            <span>Tenant <code id="tenant-id">—</code></span>
            <span>Principal <code id="principal-id">—</code></span>
            <span>Generación <strong id="session-generation">—</strong></span>
          </div>
          <div id="role-list" class="badge-list" aria-label="Roles activos"></div>
        </section>

        <div id="shell-alert" class="inline-alert" role="status" aria-live="polite" hidden></div>

        <section data-panel="overview" class="workspace-panel" aria-labelledby="overview-title">
          <p class="eyebrow">Resumen</p>
          <h2 id="overview-title">Capacidades de esta sesión</h2>
          <p>La navegación se deriva exclusivamente de permisos locales. Las secciones no autorizadas no se habilitan.</p>
          <div class="metric-grid">
            <article><strong id="role-count">0</strong><span>roles locales</span></article>
            <article><strong id="permission-count">0</strong><span>permisos efectivos</span></article>
            <article><strong id="visible-module-count">0</strong><span>módulos visibles</span></article>
          </div>
        </section>

        <section data-panel="evidence" data-permission="evidence:query" class="workspace-panel" hidden>
          <p class="eyebrow">Investigación</p><h2>Consulta y evidencia</h2>
          <p>Superficie autorizada para búsqueda y revisión de evidencia. Las consultas reales permanecen sujetas a corpus, vigencia y controles del API.</p>
        </section>
        <section data-panel="procedures" data-permission="procedure:read" class="workspace-panel" hidden>
          <p class="eyebrow">Procedimientos</p><h2>Catálogo procedimental</h2>
          <p>Lectura de procedimientos gobernados, versiones y evidencia asociada.</p>
        </section>
        <section data-panel="cases" data-permission="case:read" class="workspace-panel" hidden>
          <p class="eyebrow">Operación</p><h2>Casos procedimentales</h2>
          <p>Vista role-aware para casos vinculados a workflows aprobados. No declara estado jurídico.</p>
        </section>
        <section data-panel="sources" data-permission="source:read" class="workspace-panel" hidden>
          <p class="eyebrow">Corpus</p><h2>Fuentes</h2>
          <p>Inventario de fuentes, autoridad, vigencia y estado de adquisición.</p>
        </section>
        <section data-panel="documents" data-permission="document:read" class="workspace-panel" hidden>
          <p class="eyebrow">Corpus</p><h2>Documentos</h2>
          <p>Biblioteca documental tenant-scoped con trazabilidad y estado de ingesta.</p>
        </section>
        <section data-panel="ingestion" data-permission="document:ingest" class="workspace-panel" hidden>
          <p class="eyebrow">Gestión documental</p><h2>Ingesta</h2>
          <p>Superficie reservada para operadores con permiso explícito de ingesta.</p>
        </section>
        <section data-panel="authoring" data-permission="procedure:draft" class="workspace-panel" hidden>
          <p class="eyebrow">Gobernanza</p><h2>Autoría procedimental</h2>
          <p>Preparación de borradores sin capacidad implícita de revisión o aprobación.</p>
        </section>
        <section data-panel="review" data-permission="procedure:review" class="workspace-panel" hidden>
          <p class="eyebrow">Gobernanza</p><h2>Revisión procedimental</h2>
          <p>Revisión separada de autoría y aprobación.</p>
        </section>
        <section data-panel="approval" data-permission="procedure:approve" class="workspace-panel" hidden>
          <p class="eyebrow">Gobernanza</p><h2>Aprobación procedimental</h2>
          <p>Decisión humana explícita; ninguna automatización se representa como aprobación.</p>
        </section>
        <section data-panel="identity" data-permission="identity:manage" class="workspace-panel" hidden>
          <p class="eyebrow">Administración</p><h2>Identidad y acceso</h2>
          <p>Superficie reservada para membresías y roles locales. Los claims del IdP no otorgan permisos directamente.</p>
        </section>
        <section data-panel="audit" data-permission="audit:read" class="workspace-panel" hidden>
          <p class="eyebrow">Control</p><h2>Auditoría</h2>
          <p>Acceso a evidencia operativa minimizada, sujeto a políticas de retención y privacidad.</p>
        </section>
        <section data-panel="platform" data-permission="platform:admin" class="workspace-panel" hidden>
          <p class="eyebrow">Plataforma</p><h2>Administración de plataforma</h2>
          <p>Capacidad altamente privilegiada y todavía tenant-bound. No implica acceso global fuera de la membresía autenticada.</p>
        </section>
      </div>
    </main>
  </div>
  <noscript>Este espacio requiere JavaScript para establecer una sesión BFF del mismo origen.</noscript>
</body>
</html>`;

export const HUMAN_SHELL_CSS = String.raw`:root {
  color-scheme: dark;
  --bg: #0b1118;
  --panel: #121c27;
  --panel-raised: #182533;
  --line: #2d4052;
  --text: #f2f6f8;
  --muted: #aab8c4;
  --accent: #78d9c5;
  --accent-strong: #b7f0e4;
  --danger: #ffb4ab;
  --focus: #ffd166;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html { min-width: 320px; background: var(--bg); }
body { margin: 0; min-height: 100vh; color: var(--text); background: radial-gradient(circle at 80% 0%, #173746 0, transparent 34rem), var(--bg); }
button, a { font: inherit; }
button { color: inherit; }
[hidden] { display: none !important; }
.skip-link { position: fixed; z-index: 20; left: 1rem; top: 1rem; transform: translateY(-160%); padding: .75rem 1rem; background: var(--focus); color: #16130a; border-radius: .4rem; }
.skip-link:focus { transform: translateY(0); }
.shell-frame { display: grid; min-height: 100vh; grid-template: 4.5rem 1fr / 17rem 1fr; grid-template-areas: "top top" "side main"; }
.topbar { grid-area: top; display: grid; grid-template-columns: minmax(13rem, 1fr) auto auto; align-items: center; gap: 1.2rem; padding: .75rem 1.25rem; border-bottom: 1px solid var(--line); background: rgba(11, 17, 24, .94); backdrop-filter: blur(18px); position: sticky; top: 0; z-index: 10; }
.brand { display: inline-flex; align-items: center; gap: .8rem; color: var(--text); text-decoration: none; width: fit-content; }
.brand-mark { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border: 1px solid var(--accent); border-radius: .65rem; color: var(--accent-strong); font-weight: 800; letter-spacing: -.05em; }
.brand span:last-child { display: grid; }
.brand small { color: var(--muted); font-size: .75rem; }
.session-summary { display: flex; align-items: center; gap: .55rem; color: var(--muted); font-size: .9rem; }
.state-indicator { width: .65rem; height: .65rem; border-radius: 50%; background: #81909c; box-shadow: 0 0 0 .25rem rgba(129,144,156,.14); }
body[data-shell-state="authenticated"] .state-indicator { background: var(--accent); box-shadow: 0 0 0 .25rem rgba(120,217,197,.14); }
body[data-shell-state="error"] .state-indicator, body[data-shell-state="unavailable"] .state-indicator { background: var(--danger); box-shadow: 0 0 0 .25rem rgba(255,180,171,.12); }
.session-actions { display: flex; gap: .65rem; justify-content: flex-end; }
.sidebar { grid-area: side; padding: 1.25rem 1rem; border-right: 1px solid var(--line); background: rgba(13, 21, 29, .9); display: flex; flex-direction: column; gap: 1.5rem; }
.sidebar nav { display: grid; gap: .3rem; }
.sidebar nav button { border: 0; border-radius: .5rem; background: transparent; padding: .7rem .8rem; text-align: left; color: var(--muted); cursor: pointer; }
.sidebar nav button:hover { background: var(--panel); color: var(--text); }
.sidebar nav button[aria-current="page"] { color: var(--accent-strong); background: rgba(120,217,197,.12); box-shadow: inset .18rem 0 var(--accent); }
.boundary-note { margin-top: auto; display: grid; gap: .4rem; padding: .85rem; border: 1px solid var(--line); border-radius: .65rem; background: var(--panel); }
.boundary-note strong { color: var(--accent-strong); font-size: .85rem; }
.boundary-note span { color: var(--muted); font-size: .78rem; line-height: 1.45; }
.workspace { grid-area: main; width: min(100%, 78rem); padding: clamp(1.25rem, 4vw, 3rem); }
.state-card, .identity-card, .workspace-panel { border: 1px solid var(--line); border-radius: .9rem; background: linear-gradient(145deg, rgba(24,37,51,.95), rgba(18,28,39,.96)); box-shadow: 0 1.2rem 3rem rgba(0,0,0,.2); }
.state-card { max-width: 46rem; padding: clamp(1.5rem, 5vw, 3.2rem); }
.state-card h1 { margin: .25rem 0 1rem; font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1.05; }
.state-card p { max-width: 60ch; color: var(--muted); line-height: 1.65; }
.eyebrow { margin: 0 0 .4rem; color: var(--accent); text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; font-weight: 800; }
.button { display: inline-flex; justify-content: center; align-items: center; min-height: 2.65rem; padding: .65rem 1rem; border: 1px solid transparent; border-radius: .5rem; text-decoration: none; cursor: pointer; font-weight: 700; }
.button-primary { color: #07100e; background: var(--accent); }
.button-secondary { color: var(--text); background: var(--panel-raised); border-color: var(--line); }
.button-danger { color: #2b0805; background: var(--danger); }
.button:disabled { opacity: .55; cursor: wait; }
.identity-card { padding: 1.4rem; display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr) auto; }
.identity-card h1 { margin: .2rem 0; font-size: clamp(1.65rem, 4vw, 2.4rem); }
.identity-card p { color: var(--muted); margin-bottom: 0; }
.identity-metadata { display: grid; gap: .45rem; align-content: center; font-size: .8rem; color: var(--muted); }
.identity-metadata code { color: var(--text); }
.badge-list { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: .5rem; }
.badge { padding: .35rem .65rem; border: 1px solid rgba(120,217,197,.45); border-radius: 999px; color: var(--accent-strong); background: rgba(120,217,197,.08); font-size: .78rem; }
.inline-alert { margin-top: 1rem; padding: .8rem 1rem; border: 1px solid var(--line); border-radius: .55rem; background: var(--panel); color: var(--muted); }
.workspace-panel { margin-top: 1.25rem; padding: clamp(1.25rem, 4vw, 2rem); }
.workspace-panel h2 { margin: .25rem 0 .7rem; font-size: clamp(1.45rem, 3vw, 2rem); }
.workspace-panel > p:last-child { color: var(--muted); line-height: 1.6; max-width: 70ch; }
.metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; margin-top: 1.5rem; }
.metric-grid article { padding: 1rem; border: 1px solid var(--line); border-radius: .65rem; background: rgba(11,17,24,.45); }
.metric-grid strong { display: block; font-size: 2rem; color: var(--accent-strong); }
.metric-grid span { color: var(--muted); font-size: .82rem; }
:focus-visible { outline: .2rem solid var(--focus); outline-offset: .18rem; }
@media (max-width: 820px) {
  .shell-frame { grid-template: auto auto 1fr / 1fr; grid-template-areas: "top" "side" "main"; }
  .topbar { grid-template-columns: 1fr auto; }
  .session-summary { grid-column: 1 / -1; grid-row: 2; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--line); padding: .75rem; }
  .sidebar nav { grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; padding-bottom: .35rem; }
  .boundary-note { display: none; }
  .identity-card { grid-template-columns: 1fr; }
  .identity-metadata, .badge-list { grid-column: 1; }
}
@media (max-width: 560px) {
  .topbar { grid-template-columns: 1fr; position: static; }
  .session-actions { justify-content: flex-start; flex-wrap: wrap; }
  .metric-grid { grid-template-columns: 1fr; }
  .workspace { padding: 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .001ms !important; animation-duration: .001ms !important; animation-iteration-count: 1 !important; }
}`;

export const HUMAN_SHELL_JS = String.raw`(() => {
  "use strict";

  const roles = new Set([
    "platform_admin", "tenant_admin", "document_manager", "researcher",
    "procedure_author", "procedure_reviewer", "procedure_approver",
    "case_operator", "viewer"
  ]);
  const permissions = new Set([
    "platform:admin", "tenant:manage", "identity:manage", "source:read",
    "source:write", "document:read", "document:write", "document:ingest",
    "evidence:query", "procedure:read", "procedure:draft", "procedure:review",
    "procedure:approve", "case:read", "case:write", "audit:read"
  ]);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const opaque = /^[A-Za-z0-9_-]{43,172}$/;
  let session = null;
  let busy = false;

  const byId = (id) => document.getElementById(id);
  const stateSections = ["shell-loading", "shell-unauthenticated", "shell-unavailable", "shell-error"];

  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value;
  };

  const setState = (state, label) => {
    document.body.dataset.shellState = state;
    setText("session-state-label", label);
    for (const id of stateSections) {
      const element = byId(id);
      if (element) element.hidden = id !== "shell-" + state;
    }
    const authenticated = state === "authenticated";
    byId("authenticated-workspace").hidden = !authenticated;
    byId("product-navigation").hidden = !authenticated;
    byId("rotate-session").hidden = !authenticated;
    byId("logout").hidden = !authenticated;
  };

  const uniqueAllowed = (value, allowlist) => {
    if (!Array.isArray(value) || value.length < 1 || value.length > allowlist.size) return null;
    const result = [];
    for (const item of value) {
      if (typeof item !== "string" || !allowlist.has(item) || result.includes(item)) return null;
      result.push(item);
    }
    return result;
  };

  const parseSession = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value;
    const parsedRoles = uniqueAllowed(record.roles, roles);
    const parsedPermissions = uniqueAllowed(record.permissions, permissions);
    if (
      record.authenticated !== true || !uuid.test(record.session_id || "") ||
      !uuid.test(record.tenant_id || "") || !uuid.test(record.principal_id || "") ||
      !parsedRoles || !parsedPermissions || !opaque.test(record.csrf_token || "") ||
      !Number.isSafeInteger(record.generation) || record.generation < 2 ||
      Number.isNaN(Date.parse(record.issued_at)) || Number.isNaN(Date.parse(record.expires_at))
    ) return null;
    return {
      sessionId: record.session_id,
      tenantId: record.tenant_id,
      principalId: record.principal_id,
      roles: parsedRoles,
      permissions: parsedPermissions,
      csrf: record.csrf_token,
      generation: record.generation,
      issuedAt: record.issued_at,
      expiresAt: record.expires_at
    };
  };

  const parseRotation = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (value.rotated !== true || !uuid.test(value.session_id || "") ||
        !opaque.test(value.csrf_token || "") || !Number.isSafeInteger(value.generation)) return null;
    return { sessionId: value.session_id, csrf: value.csrf_token, generation: value.generation };
  };

  const readJson = async (response) => {
    const type = response.headers.get("content-type") || "";
    if (!type.toLowerCase().startsWith("application/json")) return null;
    try { return await response.json(); } catch { return null; }
  };

  const request = (path, headers) => fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "follow",
    headers: Object.assign({ accept: "application/json" }, headers || {})
  });

  const isGranted = (permission) => !permission || (session && session.permissions.includes(permission));

  const renderRoles = () => {
    const list = byId("role-list");
    list.replaceChildren();
    for (const role of session.roles) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = role.replaceAll("_", " ");
      list.append(badge);
    }
  };

  const availableRoutes = () => {
    let count = 0;
    for (const button of document.querySelectorAll("[data-route]")) {
      const granted = isGranted(button.dataset.permission || "");
      button.hidden = !granted;
      if (granted) count += 1;
    }
    for (const panel of document.querySelectorAll("[data-panel]")) {
      if (!isGranted(panel.dataset.permission || "")) panel.hidden = true;
    }
    return count;
  };

  const selectRoute = (requested) => {
    const buttons = [...document.querySelectorAll("[data-route]")];
    const candidate = buttons.find((button) => button.dataset.route === requested);
    const allowed = candidate && !candidate.hidden ? requested : "overview";
    for (const button of buttons) {
      button.setAttribute("aria-current", button.dataset.route === allowed ? "page" : "false");
    }
    let selectedPanel = null;
    for (const panel of document.querySelectorAll("[data-panel]")) {
      const selected = panel.dataset.panel === allowed && isGranted(panel.dataset.permission || "");
      panel.hidden = !selected;
      if (selected) selectedPanel = panel;
    }
    if (location.hash !== "#" + allowed) history.replaceState(null, "", "#" + allowed);
    const title = selectedPanel ? selectedPanel.querySelector("h2") : null;
    if (title) {
      title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    }
  };

  const renderAuthenticated = () => {
    setText("identity-summary", "Permisos derivados de membresía local. La sesión expira a las " + new Date(session.expiresAt).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" }) + ".");
    setText("tenant-id", session.tenantId);
    setText("principal-id", session.principalId);
    setText("session-generation", String(session.generation));
    setText("role-count", String(session.roles.length));
    setText("permission-count", String(session.permissions.length));
    renderRoles();
    setText("visible-module-count", String(availableRoutes()));
    setState("authenticated", "Sesión verificada");
    const requested = location.hash.slice(1) || "overview";
    selectRoute(requested);
  };

  const fail = (message) => {
    session = null;
    setText("shell-error-message", message);
    setState("error", "Error de sesión");
  };

  const bootstrap = async () => {
    if (busy) return;
    busy = true;
    setState("loading", "Verificando sesión");
    try {
      const response = await request("/auth/session", { "x-session-bootstrap": "v1" });
      const body = await readJson(response);
      if (response.status === 401) {
        session = null;
        setState("unauthenticated", "Acceso requerido");
        return;
      }
      if (response.status === 503) {
        session = null;
        setState("unavailable", "Identidad no configurada");
        return;
      }
      const parsed = response.ok ? parseSession(body) : null;
      if (!parsed) {
        fail("La respuesta de sesión no cumplió el contrato de seguridad.");
        return;
      }
      session = parsed;
      renderAuthenticated();
    } catch {
      fail("No fue posible contactar el servicio de sesión del mismo origen.");
    } finally {
      busy = false;
    }
  };

  const rotate = async () => {
    if (!session || busy) return;
    busy = true;
    byId("rotate-session").disabled = true;
    try {
      const response = await request("/auth/session/rotate", { "x-csrf-token": session.csrf });
      const body = await readJson(response);
      const parsed = response.ok ? parseRotation(body) : null;
      if (!parsed || parsed.generation !== session.generation + 1) {
        fail("La sesión no pudo renovarse de forma verificable.");
        return;
      }
      session.sessionId = parsed.sessionId;
      session.csrf = parsed.csrf;
      session.generation = parsed.generation;
      setText("session-generation", String(session.generation));
      const alert = byId("shell-alert");
      alert.textContent = "La sesión fue renovada y el identificador anterior quedó revocado.";
      alert.hidden = false;
    } catch {
      fail("La renovación de sesión no estuvo disponible.");
    } finally {
      busy = false;
      byId("rotate-session").disabled = false;
    }
  };

  const logout = async () => {
    if (!session || busy) return;
    busy = true;
    byId("logout").disabled = true;
    try {
      const response = await request("/auth/logout", { "x-csrf-token": session.csrf });
      if (!response.ok) {
        fail("El cierre de sesión no pudo confirmarse.");
        return;
      }
      session = null;
      history.replaceState(null, "", "/app");
      setState("unauthenticated", "Sesión cerrada");
    } catch {
      fail("El cierre de sesión no estuvo disponible.");
    } finally {
      busy = false;
      byId("logout").disabled = false;
    }
  };

  for (const button of document.querySelectorAll("[data-route]")) {
    button.addEventListener("click", () => {
      if (!session || button.hidden || !isGranted(button.dataset.permission || "")) return;
      selectRoute(button.dataset.route || "overview");
    });
  }
  window.addEventListener("hashchange", () => {
    if (session) selectRoute(location.hash.slice(1) || "overview");
  });
  byId("retry-session").addEventListener("click", bootstrap);
  byId("rotate-session").addEventListener("click", rotate);
  byId("logout").addEventListener("click", logout);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) bootstrap();
  });
  bootstrap();
})();`;


export const HUMAN_SHELL_FAVICON = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1118"/><rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="#78d9c5" stroke-width="4"/><path d="M18 43V21h6l8 13 8-13h6v22h-6V31l-8 12-8-12v12z" fill="#b7f0e4"/></svg>`;
