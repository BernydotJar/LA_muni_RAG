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
      <a class="brand" href="/app" aria-label="LA Muni RAG, mesa de evidencia municipal">
        <span class="brand-mark" aria-hidden="true">LA</span>
        <span><strong>LA Muni RAG</strong><small>Mesa de evidencia municipal</small></span>
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
      <nav id="product-navigation" aria-label="Navegación del producto" hidden>
        <p class="nav-label">Trabajo</p>
        <button type="button" data-route="overview" aria-current="page"><span aria-hidden="true">01</span> Inicio</button>
        <button type="button" data-route="evidence" data-permission="evidence:query" hidden><span aria-hidden="true">02</span> Consultar evidencia</button>
        <button type="button" data-route="procedures" data-permission="procedure:read" hidden><span aria-hidden="true">03</span> Procedimientos</button>
        <button type="button" data-route="cases" data-permission="case:read" hidden><span aria-hidden="true">04</span> Casos</button>
        <p class="nav-label">Corpus</p>
        <button type="button" data-route="sources" data-permission="source:read" hidden><span aria-hidden="true">05</span> Fuentes</button>
        <button type="button" data-route="documents" data-permission="document:read" hidden><span aria-hidden="true">06</span> Documentos</button>
        <button type="button" data-route="ingestion" data-permission="document:ingest" hidden><span aria-hidden="true">07</span> Ingesta</button>
        <p class="nav-label">Gobernanza</p>
        <button type="button" data-route="authoring" data-permission="procedure:draft" hidden><span aria-hidden="true">08</span> Autoría</button>
        <button type="button" data-route="review" data-permission="procedure:review" hidden><span aria-hidden="true">09</span> Revisión</button>
        <button type="button" data-route="approval" data-permission="procedure:approve" hidden><span aria-hidden="true">10</span> Aprobación</button>
        <button type="button" data-route="identity" data-permission="identity:manage" hidden><span aria-hidden="true">11</span> Identidad y acceso</button>
        <button type="button" data-route="audit" data-permission="audit:read" hidden><span aria-hidden="true">12</span> Auditoría</button>
        <button type="button" data-route="platform" data-permission="platform:admin" hidden><span aria-hidden="true">13</span> Plataforma</button>
      </nav>
      <div class="boundary-note">
        <strong>Canal protegido</strong>
        <span>Sesión same-origin. Sin Bearer ni credenciales persistentes en este navegador.</span>
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
            <p class="eyebrow">Mesa autenticada</p>
            <h1 id="workspace-title">Espacio municipal</h1>
            <p id="identity-summary">Sesión local verificada.</p>
          </div>
          <div id="role-list" class="badge-list" aria-label="Roles activos"></div>
          <details class="session-details">
            <summary>Detalles de sesión</summary>
            <div class="identity-metadata">
              <span>Tenant <code id="tenant-id">—</code></span>
              <span>Principal <code id="principal-id">—</code></span>
              <span>Generación <strong id="session-generation">—</strong></span>
              <span id="technical-capabilities"><strong id="role-count">0</strong> roles · <strong id="permission-count">0</strong> permisos · <strong id="visible-module-count">0</strong> vistas</span>
            </div>
          </details>
        </section>

        <div id="shell-alert" class="inline-alert" role="status" aria-live="polite" hidden></div>

        <section data-panel="overview" class="workspace-panel overview-panel" aria-labelledby="overview-title">
          <div class="panel-heading">
            <p class="eyebrow">Inicio</p>
            <h2 id="overview-title">Encontrar y sostener evidencia municipal</h2>
            <p>Empieza por la pregunta que necesitas resolver. Cada vista disponible responde a tu membresía local, no a claims externos.</p>
          </div>
          <div class="overview-grid">
            <div class="task-board" aria-labelledby="task-board-title">
              <p class="section-number" aria-hidden="true">01</p>
              <div>
                <h3 id="task-board-title">Elige una tarea</h3>
                <p>La shell no inventa resultados: abre solamente superficies autorizadas y marca los prerrequisitos que aún faltan.</p>
              </div>
              <div class="task-actions">
                <button type="button" class="task-action" data-action-route="evidence" data-permission="evidence:query" hidden>
                  <strong>Consultar evidencia</strong><span>Formular una pregunta y revisar respaldo</span>
                </button>
                <button type="button" class="task-action" data-action-route="procedures" data-permission="procedure:read" hidden>
                  <strong>Revisar procedimientos</strong><span>Consultar versiones y evidencia asociada</span>
                </button>
                <button type="button" class="task-action" data-action-route="documents" data-permission="document:read" hidden>
                  <strong>Inspeccionar el corpus</strong><span>Ver fuentes, documentos y trazabilidad</span>
                </button>
                <button type="button" class="task-action" data-action-route="cases" data-permission="case:read" hidden>
                  <strong>Abrir casos</strong><span>Trabajar dentro de procedimientos aprobados</span>
                </button>
              </div>
            </div>
            <aside class="readiness-ledger" aria-labelledby="readiness-title">
              <p class="section-number" aria-hidden="true">02</p>
              <h3 id="readiness-title">Estado verificable</h3>
              <dl>
                <div><dt>Corpus real</dt><dd class="status-missing">No conectado</dd></div>
                <div><dt>Identidad productiva</dt><dd class="status-missing">No aprobada</dd></div>
                <div><dt>Journeys productivas</dt><dd>0 de 12</dd></div>
              </dl>
              <p>Este entorno demuestra la sesión y la autorización local; no declara disponibilidad productiva.</p>
            </aside>
          </div>
        </section>

        <section data-panel="evidence" data-permission="evidence:query" class="workspace-panel" hidden>
          <p class="eyebrow">Investigación</p><h2>Consulta y evidencia</h2>
          <p class="panel-intro">Formula preguntas solo cuando exista un corpus aprobado y vigente. La evidencia debe conservar fuente, fragmento y fecha de consulta.</p>
          <div class="empty-state"><span aria-hidden="true">E—01</span><h3>Consulta productiva pendiente</h3><p>No hay un corpus real aprobado conectado a esta shell. No se muestran ejemplos sintéticos como si fueran resultados municipales.</p></div>
        </section>
        <section data-panel="procedures" data-permission="procedure:read" class="workspace-panel" hidden>
          <p class="eyebrow">Procedimientos</p><h2>Catálogo procedimental</h2>
          <p class="panel-intro">Lectura de procedimientos gobernados, versiones y evidencia asociada.</p>
          <div class="empty-state"><span aria-hidden="true">P—01</span><h3>Catálogo sin datos productivos</h3><p>La vista está autorizada, pero este entorno no declara procedimientos municipales aprobados para presentar.</p></div>
        </section>
        <section data-panel="cases" data-permission="case:read" class="workspace-panel" hidden>
          <p class="eyebrow">Operación</p><h2>Casos procedimentales</h2>
          <p class="panel-intro">Casos vinculados a workflows aprobados. Esta superficie no declara estado jurídico.</p>
          <div class="empty-state"><span aria-hidden="true">C—01</span><h3>Sin casos cargados</h3><p>Crear o modificar casos requiere un workflow real, controles del API y una identidad productiva aprobada.</p></div>
        </section>
        <section data-panel="sources" data-permission="source:read" class="workspace-panel" hidden>
          <p class="eyebrow">Corpus</p><h2>Fuentes</h2>
          <p class="panel-intro">Inventario de autoridad, vigencia, derechos y estado de adquisición.</p>
          <div class="empty-state"><span aria-hidden="true">F—00</span><h3>Cero fuentes reales aprobadas</h3><p>La selección y adquisición del corpus continúa human-gated. Esta shell no presume derechos ni vigencia.</p></div>
        </section>
        <section data-panel="documents" data-permission="document:read" class="workspace-panel" hidden>
          <p class="eyebrow">Corpus</p><h2>Documentos</h2>
          <p class="panel-intro">Biblioteca tenant-scoped con trazabilidad, versión y estado de ingesta.</p>
          <div class="empty-state"><span aria-hidden="true">D—00</span><h3>Cero documentos reales ingeridos</h3><p>Los artefactos de prueba no se representan como corpus municipal productivo.</p></div>
        </section>
        <section data-panel="ingestion" data-permission="document:ingest" class="workspace-panel" hidden>
          <p class="eyebrow">Gestión documental</p><h2>Ingesta</h2>
          <p class="panel-intro">Superficie reservada para operadores con permiso explícito de ingesta.</p>
          <div class="empty-state"><span aria-hidden="true">I—01</span><h3>Adquisición pendiente de aprobación</h3><p>No se habilita carga real sin derechos, inventario, retención y controles acordados.</p></div>
        </section>
        <section data-panel="authoring" data-permission="procedure:draft" class="workspace-panel" hidden>
          <p class="eyebrow">Gobernanza</p><h2>Autoría procedimental</h2>
          <p class="panel-intro">Preparación de borradores sin capacidad implícita de revisión o aprobación.</p>
          <div class="empty-state"><span aria-hidden="true">A—01</span><h3>Autoría separada</h3><p>Los borradores requieren corpus real y nunca heredan permiso de revisión o aprobación.</p></div>
        </section>
        <section data-panel="review" data-permission="procedure:review" class="workspace-panel" hidden>
          <p class="eyebrow">Gobernanza</p><h2>Revisión procedimental</h2>
          <p class="panel-intro">Revisión separada de autoría y aprobación.</p>
          <div class="empty-state"><span aria-hidden="true">R—01</span><h3>Sin revisiones pendientes</h3><p>La bandeja permanece vacía hasta que exista un workflow completo y datos autorizados.</p></div>
        </section>
        <section data-panel="approval" data-permission="procedure:approve" class="workspace-panel" hidden>
          <p class="eyebrow">Gobernanza</p><h2>Aprobación procedimental</h2>
          <p class="panel-intro">Decisión humana explícita; ninguna automatización se representa como aprobación.</p>
          <div class="empty-state"><span aria-hidden="true">V—01</span><h3>Sin decisiones pendientes</h3><p>La aprobación exige separación de funciones y evidencia completa.</p></div>
        </section>
        <section data-panel="identity" data-permission="identity:manage" class="workspace-panel" hidden>
          <p class="eyebrow">Administración</p><h2>Identidad y acceso</h2>
          <p class="panel-intro">Membresías y roles locales. Los claims del IdP no otorgan permisos directamente.</p>
          <div class="empty-state"><span aria-hidden="true">ID—01</span><h3>Administración productiva no conectada</h3><p>La composición local está probada con un proveedor determinista exclusivo de tests.</p></div>
        </section>
        <section data-panel="audit" data-permission="audit:read" class="workspace-panel" hidden>
          <p class="eyebrow">Control</p><h2>Auditoría</h2>
          <p class="panel-intro">Evidencia operativa minimizada, sujeta a retención y privacidad.</p>
          <div class="empty-state"><span aria-hidden="true">AU—01</span><h3>Exporter productivo ausente</h3><p>La telemetría local no incluye tokens, códigos, cookies ni PII.</p></div>
        </section>
        <section data-panel="platform" data-permission="platform:admin" class="workspace-panel" hidden>
          <p class="eyebrow">Plataforma</p><h2>Administración de plataforma</h2>
          <p class="panel-intro">Capacidad altamente privilegiada y todavía tenant-bound.</p>
          <div class="empty-state"><span aria-hidden="true">PL—01</span><h3>Sin control productivo</h3><p>El rol no implica acceso global fuera de la membresía autenticada ni autoriza infraestructura.</p></div>
        </section>
      </div>
    </main>
  </div>
  <noscript>Este espacio requiere JavaScript para establecer una sesión BFF del mismo origen.</noscript>
</body>
</html>`;

export const HUMAN_SHELL_CSS = String.raw`:root {
  color-scheme: light;
  --paper: #f4f0e7;
  --paper-raised: #fffdf8;
  --ink: #182c33;
  --ink-soft: #53636a;
  --navy: #163b46;
  --navy-deep: #0d2a33;
  --brick: #a8442e;
  --brick-soft: #f4ded6;
  --line: #c7c3b8;
  --line-strong: #8d928e;
  --success: #2f6655;
  --warning: #7f3c2c;
  --focus: #7c2d12;
  font-family: Arial, Helvetica, sans-serif;
}
* { box-sizing: border-box; }
html { background: var(--paper); }
body { margin: 0; min-height: 100vh; color: var(--ink); background: var(--paper); }
button, a, summary { font: inherit; }
button { color: inherit; }
[hidden] { display: none !important; }
.skip-link { position: fixed; z-index: 20; left: 1rem; top: 1rem; transform: translateY(-160%); padding: .75rem 1rem; background: var(--focus); color: #fff; border: 2px solid #fff; }
.skip-link:focus { transform: translateY(0); }
.shell-frame { display: grid; min-height: 100vh; grid-template: 5rem 1fr / 18rem 1fr; grid-template-areas: "top top" "side main"; }
.topbar { grid-area: top; display: grid; grid-template-columns: minmax(15rem, 1fr) auto auto; align-items: center; gap: 1.2rem; padding: .8rem 1.5rem; border-bottom: 3px solid var(--brick); background: var(--paper-raised); position: sticky; top: 0; z-index: 10; }
.brand { display: inline-flex; align-items: center; gap: .85rem; color: var(--ink); text-decoration: none; width: fit-content; }
.brand-mark { display: grid; place-items: center; width: 2.7rem; height: 2.7rem; border: 2px solid var(--navy); color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-weight: 700; letter-spacing: -.06em; }
.brand span:last-child { display: grid; gap: .1rem; }
.brand strong { font-family: Georgia, "Times New Roman", serif; font-size: 1.12rem; letter-spacing: .01em; }
.brand small { color: var(--ink-soft); font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; }
.session-summary { display: flex; align-items: center; gap: .55rem; color: var(--ink-soft); font-size: .86rem; }
.state-indicator { width: .58rem; height: .58rem; border-radius: 50%; background: var(--line-strong); }
body[data-shell-state="authenticated"] .state-indicator { background: var(--success); }
body[data-shell-state="error"] .state-indicator, body[data-shell-state="unavailable"] .state-indicator { background: var(--brick); }
.session-actions { display: flex; gap: .55rem; justify-content: flex-end; }
.sidebar { grid-area: side; padding: 1.4rem 1rem; border-right: 1px solid #34515a; background: var(--navy-deep); color: #f7f3ea; display: flex; flex-direction: column; gap: 1.5rem; }
.sidebar nav { display: grid; gap: .12rem; }
.nav-label { margin: 1rem .75rem .35rem; color: #aebfc2; font-size: .66rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.nav-label:first-child { margin-top: 0; }
.sidebar nav button { display: grid; grid-template-columns: 2.2rem 1fr; align-items: center; min-height: 2.75rem; border: 0; border-left: 3px solid transparent; background: transparent; padding: .55rem .7rem; text-align: left; color: #d5dfe0; cursor: pointer; }
.sidebar nav button > span { color: #81979c; font-family: "Courier New", monospace; font-size: .7rem; }
.sidebar nav button:hover { background: #163945; color: #fff; }
.sidebar nav button[aria-current="page"] { color: #fff; background: #234c57; border-left-color: #e27b5e; }
.sidebar nav button[aria-current="page"] > span { color: #f1a68d; }
.boundary-note { margin-top: auto; display: grid; gap: .4rem; padding: .85rem 0 0; border-top: 1px solid #49636a; }
.boundary-note strong { color: #fff; font-size: .8rem; }
.boundary-note span { color: #aebfc2; font-size: .75rem; line-height: 1.45; }
.workspace { grid-area: main; width: min(100%, 82rem); padding: clamp(1.25rem, 4vw, 3.5rem); }
.state-card, .identity-card, .workspace-panel { border: 1px solid var(--line); background: var(--paper-raised); }
.state-card { max-width: 48rem; padding: clamp(1.5rem, 5vw, 3.4rem); border-top: 5px solid var(--navy); }
.state-card h1 { margin: .3rem 0 1rem; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 500; line-height: 1.04; }
.state-card p { max-width: 60ch; color: var(--ink-soft); line-height: 1.65; }
.eyebrow { margin: 0 0 .45rem; color: var(--brick); text-transform: uppercase; letter-spacing: .15em; font-size: .68rem; font-weight: 800; }
.button { display: inline-flex; justify-content: center; align-items: center; min-height: 2.75rem; padding: .65rem 1rem; border: 1px solid transparent; text-decoration: none; cursor: pointer; font-weight: 700; }
.button-primary { color: #fff; background: var(--navy); }
.button-primary:hover { background: var(--navy-deep); }
.button-secondary { color: var(--navy); background: var(--paper-raised); border-color: var(--navy); }
.button-danger { color: #fff; background: var(--brick); }
.button:disabled { opacity: .55; cursor: wait; }
.identity-card { padding: 1.15rem 1.3rem; display: grid; gap: .8rem 1.2rem; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; border-left: 5px solid var(--navy); }
.identity-card h1 { margin: .1rem 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(1.6rem, 4vw, 2.25rem); font-weight: 500; }
.identity-card p { color: var(--ink-soft); margin: .2rem 0 0; }
.badge-list { display: flex; flex-wrap: wrap; gap: .4rem; }
.badge { padding: .32rem .55rem; border: 1px solid var(--line-strong); color: var(--navy); background: #f0eee7; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; }
.session-details { min-width: 11rem; color: var(--ink-soft); font-size: .78rem; }
.session-details summary { min-height: 2.6rem; display: flex; align-items: center; justify-content: flex-end; cursor: pointer; color: var(--navy); font-weight: 700; }
.identity-metadata { display: grid; gap: .42rem; padding-top: .7rem; border-top: 1px solid var(--line); }
.identity-metadata code { color: var(--ink); overflow-wrap: anywhere; }
.inline-alert { margin-top: 1rem; padding: .8rem 1rem; border-left: 4px solid var(--success); background: #e4eee8; color: #244c3f; }
.inline-alert[data-tone="warning"] { border-left-color: var(--warning); background: var(--brick-soft); color: #6b2d20; }
.workspace-panel { margin-top: 1.25rem; padding: clamp(1.25rem, 4vw, 2.4rem); }
.workspace-panel h2 { margin: .25rem 0 .75rem; max-width: 22ch; font-family: Georgia, "Times New Roman", serif; font-size: clamp(1.7rem, 3.5vw, 2.65rem); font-weight: 500; line-height: 1.12; }
.panel-heading > p:last-child, .panel-intro { color: var(--ink-soft); line-height: 1.6; max-width: 68ch; }
.workspace-panel h2[tabindex="-1"]:focus { outline: none; }
.overview-panel { border-top: 5px solid var(--brick); }
.overview-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(16rem, .8fr); gap: 1px; margin-top: 2rem; background: var(--line); border: 1px solid var(--line); }
.task-board, .readiness-ledger { background: var(--paper-raised); padding: clamp(1.1rem, 3vw, 1.7rem); }
.task-board { display: grid; grid-template-columns: 2.7rem 1fr; align-content: start; }
.section-number { margin: .15rem 0; color: var(--brick); font-family: "Courier New", monospace; font-size: .78rem; font-weight: 700; }
.task-board h3, .readiness-ledger h3, .empty-state h3 { margin: 0 0 .45rem; font-family: Georgia, "Times New Roman", serif; font-size: 1.25rem; font-weight: 500; }
.task-board > div > p, .readiness-ledger > p, .empty-state p { color: var(--ink-soft); line-height: 1.55; }
.task-actions { grid-column: 2; display: grid; margin-top: 1rem; border-top: 1px solid var(--line); }
.task-action { display: grid; grid-template-columns: minmax(9rem, .55fr) 1fr; gap: 1rem; min-height: 4.2rem; padding: .8rem .2rem; border: 0; border-bottom: 1px solid var(--line); background: transparent; text-align: left; cursor: pointer; }
.task-action:hover { color: var(--brick); }
.task-action strong { font-family: Georgia, "Times New Roman", serif; font-size: 1.02rem; font-weight: 600; }
.task-action span { color: var(--ink-soft); font-size: .82rem; line-height: 1.4; }
.readiness-ledger { border-left: 0; }
.readiness-ledger dl { margin: 1.1rem 0; border-top: 1px solid var(--line); }
.readiness-ledger dl div { display: flex; justify-content: space-between; gap: 1rem; padding: .75rem 0; border-bottom: 1px solid var(--line); }
.readiness-ledger dt { color: var(--ink-soft); }
.readiness-ledger dd { margin: 0; font-weight: 700; text-align: right; }
.status-missing { color: var(--warning); }
.empty-state { display: grid; grid-template-columns: 3.2rem 1fr; gap: .25rem 1rem; margin-top: 1.8rem; padding: 1.2rem 0; border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line); }
.empty-state > span { grid-row: 1 / 3; color: var(--brick); font-family: "Courier New", monospace; font-size: .75rem; font-weight: 700; }
.empty-state p { margin: 0; max-width: 62ch; }
:focus-visible { outline: .2rem solid var(--focus); outline-offset: .18rem; }
.sidebar :focus-visible { outline-color: #ffd166; }
@media (forced-colors: active) {
  .sidebar nav button[aria-current="page"], .identity-card, .overview-panel, .inline-alert { border: 2px solid CanvasText; }
}
@media (max-width: 820px) {
  .shell-frame { grid-template: auto auto 1fr / minmax(0, 1fr); grid-template-areas: "top" "side" "main"; }
  .topbar, .sidebar, .sidebar nav, .workspace, #authenticated-workspace { min-width: 0; max-width: 100%; }
  .topbar { grid-template-columns: 1fr auto; }
  .session-summary { grid-column: 1 / -1; grid-row: 2; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--line); padding: .75rem; }
  .sidebar nav { grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; padding-bottom: .35rem; }
  .nav-label, .boundary-note { display: none; }
  .sidebar nav button { grid-template-columns: 1fr; border-left: 0; border-bottom: 3px solid transparent; }
  .sidebar nav button > span { display: none; }
  .sidebar nav button[aria-current="page"] { border-bottom-color: #e27b5e; }
  .identity-card { grid-template-columns: 1fr auto; }
  .session-details { grid-column: 1 / -1; }
  .overview-grid { grid-template-columns: 1fr; }
  .readiness-ledger { border-top: 1px solid var(--line); }
}
@media (max-width: 560px) {
  .topbar { grid-template-columns: minmax(0, 1fr); position: static; }
  .session-actions { justify-content: flex-start; flex-wrap: wrap; }
  .identity-card { grid-template-columns: 1fr; }
  .task-board { grid-template-columns: 2.2rem 1fr; }
  .task-action { grid-template-columns: 1fr; gap: .25rem; }
  .empty-state { grid-template-columns: 1fr; }
  .empty-state > span { grid-row: auto; }
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
  const routePaths = Object.freeze({
    overview: "/app",
    evidence: "/app/search",
    procedures: "/app/procedures",
    cases: "/app/cases",
    sources: "/app/sources",
    documents: "/app/documents",
    ingestion: "/app/ingestion",
    authoring: "/app/workflows/author",
    review: "/app/workflows/review",
    approval: "/app/workflows/approve",
    identity: "/app/admin/identity",
    audit: "/app/audit",
    platform: "/app/platform"
  });
  const pathRoutes = Object.freeze({
    "/app": "overview",
    "/app/": "overview",
    "/app/login": "overview",
    "/app/search": "evidence",
    "/app/research": "evidence",
    "/app/procedures": "procedures",
    "/app/cases": "cases",
    "/app/sources": "sources",
    "/app/documents": "documents",
    "/app/ingestion": "ingestion",
    "/app/workflows": "authoring",
    "/app/workflows/author": "authoring",
    "/app/workflows/review": "review",
    "/app/workflows/approve": "approval",
    "/app/admin/identity": "identity",
    "/app/audit": "audit",
    "/app/platform": "platform",
    "/app/accessibility": "overview",
    "/app/tenant-boundary": "tenant-boundary"
  });
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
    for (const action of document.querySelectorAll("[data-action-route]")) {
      action.hidden = !isGranted(action.dataset.permission || "");
    }
    for (const panel of document.querySelectorAll("[data-panel]")) {
      if (!isGranted(panel.dataset.permission || "")) panel.hidden = true;
    }
    return count;
  };

  const selectRoute = (requested, mode = "path", historyMode = "replace") => {
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
    const destination = mode === "hash" ? "/app#" + allowed : routePaths[allowed];
    if (location.pathname + location.hash !== destination) {
      if (historyMode === "push") history.pushState(null, "", destination);
      else history.replaceState(null, "", destination);
    }
    const alert = byId("shell-alert");
    if (requested !== allowed) {
      alert.textContent = "La vista solicitada no está disponible para esta membresía.";
      alert.dataset.tone = "warning";
      alert.hidden = false;
    } else if (alert.dataset.tone === "warning") {
      alert.replaceChildren();
      delete alert.dataset.tone;
      alert.hidden = true;
    }
    const title = selectedPanel ? selectedPanel.querySelector("h2") : null;
    if (title) {
      title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    }
  };

  const routeFromLocation = () => {
    if (location.hash) return { route: location.hash.slice(1) || "overview", mode: "hash" };
    return { route: pathRoutes[location.pathname] || "overview", mode: "path" };
  };

  const renderAuthenticated = () => {
    setText("identity-summary", "Membresía local · sesión vigente hasta " + new Date(session.expiresAt).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" }) + ".");
    setText("tenant-id", session.tenantId);
    setText("principal-id", session.principalId);
    setText("session-generation", String(session.generation));
    setText("role-count", String(session.roles.length));
    setText("permission-count", String(session.permissions.length));
    renderRoles();
    setText("visible-module-count", String(availableRoutes()));
    setState("authenticated", "Sesión verificada");
    const requested = routeFromLocation();
    selectRoute(requested.route, requested.mode);
  };

  const fail = (message) => {
    session = null;
    setText("shell-error-message", message);
    setState("error", "Error de sesión");
  };

  const updateSignInLink = () => {
    const returnPath = Object.prototype.hasOwnProperty.call(pathRoutes, location.pathname)
      ? location.pathname
      : "/app";
    byId("sign-in").setAttribute(
      "href", "/auth/login?return_to=" + encodeURIComponent(returnPath)
    );
  };

  const bootstrap = async () => {
    if (busy) return;
    busy = true;
    updateSignInLink();
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
      alert.dataset.tone = "success";
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
      selectRoute(button.dataset.route || "overview", "path", "push");
    });
  }
  for (const action of document.querySelectorAll("[data-action-route]")) {
    action.addEventListener("click", () => {
      if (!session || action.hidden || !isGranted(action.dataset.permission || "")) return;
      selectRoute(action.dataset.actionRoute || "overview", "path", "push");
    });
  }
  window.addEventListener("popstate", () => {
    if (session) {
      const requested = routeFromLocation();
      selectRoute(requested.route, requested.mode);
    }
  });
  window.addEventListener("hashchange", () => {
    if (session) selectRoute(location.hash.slice(1) || "overview", "hash");
  });
  byId("retry-session").addEventListener("click", bootstrap);
  byId("rotate-session").addEventListener("click", rotate);
  byId("logout").addEventListener("click", logout);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) bootstrap();
  });
  bootstrap();
})();`;


export const HUMAN_SHELL_FAVICON = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#fffdf8"/><rect x="5" y="5" width="54" height="54" rx="7" fill="none" stroke="#163b46" stroke-width="4"/><path d="M14 47h36" stroke="#a8442e" stroke-width="5"/><text x="32" y="39" text-anchor="middle" font-family="Georgia,serif" font-size="25" font-weight="700" fill="#163b46">LA</text></svg>`;
