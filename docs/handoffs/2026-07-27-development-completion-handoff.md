# LA Muni RAG — Development Completion Handoff

Generated: 2026-07-27T18:31:32Z

## Copy/paste prompt

```text
/goal

Actúa como un autonomous long-session multi-agent implementation system para LA Muni RAG. Continúa el desarrollo real desde el estado verificado del repositorio y trabaja durante toda la sesión mientras exista progreso útil, seguro, desbloqueado y reproducible.

No te limites a diagnosticar, planificar o recomendar comandos. Inspecciona, implementa, ejecuta, evalúa, critica, corrige, documenta, versiona, publica la working branch y continúa. No reveles chain of thought privada. Registra decisiones, evidencia, supuestos, limitaciones y criterios de aceptación en los artefactos persistentes del repositorio.

## Contexto exacto

Repository: https://github.com/BernydotJar/LA_muni_RAG.git
Workspace preferido: b909e055-62ae-4625-ac13-10947906a08f
Root: /workspace
Working branch: feature/gcp-cloudsql-staging-v1
Expected handoff HEAD: 17a6e0cbc7f58a14d1d22497dc324c5448632c54
Draft PR: #24, base feature/ephemeral-staging-runner-v1

Fuentes de verdad:
- AGENTS.md y RTK.md;
- program/current-state.md;
- program/task-graph.yaml y program/task-ledger.yaml;
- program/decision-log.md y program/evidence-register.jsonl;
- program/eval-results.json, program/open-issues.md y program/release-plan.md;
- docs/handoffs/2026-07-27-development-completion-handoff.md.

Antes de modificar algo, ejecuta workspace_status y verifica container, root, branch, local HEAD, remote HEAD, upstream y worktree. Fetch non-destructive y reconstruye el baseline desde Git, código, tests, PR, workflows y registros. No asumas que el SHA esperado sigue vigente.

## Baseline verificado

Feature 074 — Cloud SQL staging:
- Existe una instancia PostgreSQL 16 protegida.
- El plan exacto autorizado fue aplicado anteriormente.
- Estado final probado: STOPPED, activation policy NEVER y deletion protection activa.
- El managed synthetic run no completó; autorizaciones previas expiraron.
- No reinicies, reapliques, importes, remuevas state, debilites protección ni destruyas sin nueva autorización humana exacta.

Feature 075 — public Playwright gate:
- Playwright 1.62.0 fijado.
- 10/10 ejecuciones Chromium en desktop y Pixel 7.
- Cubre responsive, teclado/foco, reduced motion, assistant fail-closed, Academy/localStorage, procedure-workflow fail-closed y credential stripping.
- No prueba identidad humana ni las doce journeys autenticadas.

Feature 076 — exact-SHA Pages release verification:
- El artifact lleva metadata SHA acotada y verificable.
- Se desplegó temporalmente b646aa6ce5d7231587ae311f5acb59f84fc35a0e en modo fail-closed y fue verificado online desktop/mobile.
- Rollback run 30229913868 restauró main SHA 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c.
- La publicación temporal ya no está activa.
- El product owner reportó completar el smoke manual solicitado. Regístralo como evidencia declarada por usuario, no como auditoría WCAG, screen-reader, legal, real-corpus o authenticated E2E.

Baseline de validación:
- full regression: 880 total / 878 pass / 0 fail / 2 environment skips;
- EVAL-GCP-CLOUDSQL-STAGING-001: 14/14;
- EVAL-PUBLIC-BROWSER-GATE-001: 5/5;
- EVAL-ONLINE-PAGES-RELEASE-001: 5/5;
- Playwright público: 10/10;
- typecheck/build: pass;
- dependency audit: 0 vulnerabilities;
- checks del PR: Backend CI, Public Browser Gate y Terraform validation success.

## Product truth

No declares production readiness.

- documentos reales autorizados acreditados como ingested: 0;
- retrieval quality sobre corpus real: 0;
- human IdP/OIDC/PKCE/BFF/session: ausente;
- authenticated role-aware browser journeys: 0/12, bloqueadas;
- consumer executions en repos externos: ausentes;
- managed GCP staging receipt: ausente;
- Cloud SQL teardown: no autorizado/no ejecutado;
- Cloud Run/gateway productivo, edge, load/HA/SLO, recovery/privacy: ausentes;
- protected merge y production release: ausentes.

No implementes capacidades pertenecientes a OS Electoral o Content Agency. Mantén solamente contratos provider-side y kits portables.

## Misión y prioridades

Avanza el critical path hacia un producto completo y revisable. No te detengas después del mapping, una spec, scaffolding o un solo commit.

### Priority 1 — Feature 077: human session/BFF foundation v1

Esta es la primera recomendación porque ya existen service Bearer identity, tenant isolation y RBAC; falta la sesión humana de navegador.

Inspecciona y reutiliza:
- src/security/auth.ts, src/security/rbac.ts, src/security/tenant.ts;
- src/api/v1/persistence.ts;
- db/migrations/003_identity_tenancy_rbac.sql;
- docs/security/rbac.md;
- specs/070-ephemeral-staging-e2e-architecture-v1/;
- patrones existentes de denial audit y handlers v1.

Implementa el mayor slice provider-neutral que pueda probarse localmente:
- human principal/session separado de integration credentials;
- BFF session lifecycle interfaces;
- cookies HttpOnly, Secure fuera de local, SameSite y expiración acotadas;
- CSRF para mutaciones de navegador;
- login initiation/callback boundaries sin secrets comprometidos;
- state/nonce, rotation, logout, revocation y errores no enumerantes;
- tenant membership y role mapping separados de OIDC claims;
- audit minimizado sin tokens, authorization codes, cookies ni PII;
- deterministic local test provider/session adapter solo para tests;
- configuración fail-closed sin IdP aprobado;
- spec, ADR, threat/risk update, docs, traceability y named EVAL.

No selecciones ni despliegues IdP productivo sin decisión humana. No uses browser Bearer tokens. No debilites service credentials existentes.

Acceptance:
- session/BFF foundation real y testeada en código;
- secrets no comprometidos ni reflejados;
- malformed state/nonce/code, replay, fixation, CSRF, cross-tenant membership y revoked sessions fallan cerrado;
- API/RBAC regression permanece verde;
- docs separan synthetic local identity de approved human identity;
- cada defecto hallado deja regression test;
- ninguna journey se marca autenticada solo por un test adapter.

### Priority 2
Construye authenticated product shell role-aware sobre el contrato de sesión. Habilita únicamente journeys con prerequisitos reales en entorno ephemeral local; conserva bloqueadas las afirmaciones de IdP humano externo.

### Priority 3
Amplía QA: Firefox/WebKit estable, accessibility automatizada complementaria, adversarial session security y cross-artifact consistency EVALs.

### Priority 4
Avanza operations sin cloud mutation: local load/SLO harness, sanitized telemetry, failure injection, retry/idempotency y recovery verification.

Cuando una decisión humana bloquee un workstream, produce un decision packet preciso y continúa otro frente. Paquetes esperados: IdP/provisioning; corpus rights/reviewers/storage/scanner/retention; nueva lifecycle authorization de Cloud SQL; production topology/edge/deployment.

## Multi-agent contract

Usa subagentes nativos cuando existan; si no, simula roles secuencialmente y persiste outputs.

Separación mínima:
Producer -> Critic/Red Team -> Fixer -> Independent Verifier -> Release Gate.

Roles recomendados para Feature 077:
1. Repository Mapper / Spec Analyst, read-only.
2. Security/Identity Specialist.
3. Implementation Agent con write locks explícitos.
4. Test/Eval Engineer.
5. Critique/Red Team: fixation, replay, CSRF, claim confusion, tenant escalation, logging leaks y fail-open config.
6. Release Reviewer independiente.

Cada tarea delegada debe declarar task_id, objective, inputs, dependencies, allowed/read-only paths, write_lock, outputs, acceptance, validation y prohibited_actions. No aceptes resultados vagos.

## Execution loop

1. Resume safely y reconstruye baseline.
2. Lee instrucciones y estado persistente.
3. Mapea requirement -> task -> owner -> artifact -> validation -> eval -> release gate.
4. Selecciona el incremento seguro de mayor valor.
5. Implementa archivos reales y tests.
6. Valida inmediatamente.
7. Ejecuta crítica/red team independiente.
8. Repara hallazgos válidos, máximo tres ciclos materialmente distintos.
9. Ejecuta focused EVAL, full regression, typecheck, build, structured validation, git diff --check y secret/PII scan.
10. Actualiza graph, ledger, decisions, evidence, evals, current state, issues, release plan y draft PR.
11. Crea commits enfocados y publica solo como non-forced fast-forward después de verificar el padre remoto.
12. Observa CI del SHA exacto y repara fallos seguros.
13. Continúa el siguiente incremento seguro.

## Comandos conocidos

Descubre primero los scripts actuales. Baseline:

npm ci
npm test
npm run typecheck
npm run build
npm run eval:tenant
npm run eval:rbac
npm run eval:staging-e2e-architecture
npm run eval:staging-runner
npm run eval:public-browser-gate
npm run eval:online-pages-release
npm run test:browser:public
npm run contracts:validate
npm audit --omit=dev
node scripts/verify-pages-artifact.mjs
git diff --check

## Boundaries

Autorizado: inspección, implementación local, dependencias justificadas con lockfile, tests/browsers/databases desechables, commits, push no forzado a working branch, actualización de PR y registros.

Human-gated: merge, protected-branch mutation, public/production deployment, Pages replacement, GCP/Cloud SQL restart/apply/destroy/billing, destructive migrations, force push/history rewrite, production IdP/credentials y real corpus sin rights/controls aprobados.

Usa /workspace. No asumas rutas macOS. Preserva trabajo desconocido. No uses reset --hard, force push ni cleanup destructivo.

Finaliza solo como COMPLETED, PARTIAL WITH DOCUMENTED BLOCKERS o SAFETY STOP. Una rama verde, synthetic fixtures, local session adapter, temporary Pages pilot o stopped Cloud SQL no equivalen a production readiness.
```

## Maintainer note

This handoff uses repository files as durable memory and requires a closed implementation/feedback/verification loop. It is intentionally narrower than a generic orchestration prompt so the next agent resumes execution instead of restarting discovery.
