# Academia de Procedimientos — preview pública v1

Estado: implementada y probada localmente como superficie estática/read-only;
no es todavía la aplicación SaaS autenticada.

Fecha de corte: 2026-07-21

## Propósito

La Academia enseña a leer un procedimiento municipal como una estructura de:

```text
acción investigada
→ participantes respaldados
→ documentos y salidas
→ decisiones/dependencias
→ evidencia y citas
→ riesgos/desconocidos
→ información faltante
```

El primer módulo usa las 47 categorías de investigación del golden path de agua
potable para una comunidad de La Antigua Guatemala. Esas categorías no son hechos
ni el procedimiento oficial; son un mapa para investigar sin inventar actores,
formularios, plazos, sistemas, aprobaciones o estados.

## Superficie

```text
public/procedure-training.html
public/procedure-training.css
public/procedure-training.js
public/data/water-training-map.json
```

La interfaz ofrece:

- shell institucional contemporáneo y de alta densidad;
- ocho fases enseñables que conservan las 47 categorías y su orden;
- navegación por mouse y teclado;
- acción, participantes, documentos, decisiones, riesgos y desconocidos;
- panel de evidencia con estado, citas y brechas;
- comprobación de aprendizaje;
- progreso local “comprendido”, nunca “procedimiento completado”;
- degradación útil cuando la API no está disponible;
- vista desktop, tablet y móvil;
- reduced motion y forced-colors.

## Datos y seguridad

El navegador puede guardar únicamente:

```json
{
  "schema_version": "v1",
  "module_id": "water-community-antigua",
  "completed_lesson_ids": ["community-intake"]
}
```

No almacena:

- Bearer credentials, API keys o tokens;
- tenant/session identity;
- hechos o notas de un caso;
- documentos recibidos;
- aprobación, cumplimiento o certificación;
- estado oficial de un procedimiento.

Los fetches usan `credentials: "omit"`, `redirect: "error"`, `no-store` y
rendering DOM con `textContent`. Los enlaces externos se restringen a HTTP(S) y
usan `noopener noreferrer`.

## Relación con el SaaS

La navegación muestra Casos, Revisiones y Tenancy/RBAC como áreas deshabilitadas
con la leyenda `Requiere sesión SaaS aprobada`. No existe un login ficticio ni se
reutilizan integration credentials como credenciales humanas.

Antes de habilitar el SaaS se debe aprobar e implementar:

1. identity provider humano;
2. tenant provisioning y memberships;
3. sesión server-side/BFF, cookies seguras, CSRF y logout/revocation;
4. navegación y rutas role-aware;
5. procedimiento/casos server-side;
6. auditoría de acceso y soporte;
7. browser E2E y revisión WCAG humana.

## Evidencia ejecutable

```text
npm run eval:accessibility
npm run build:pages
node scripts/verify-pages-artifact.mjs
```

El gate cubre semántica estática, teclado, contraste, responsive, reduced motion,
forced colors, seguridad de rendering/storage y artefacto Pages. No constituye
todavía un test de screen reader, matriz de browsers o auditoría WCAG 2.2 AA del
producto completo.
## Visual QA available in this sandbox

```text
browser_visual_gate=rendered desktop=28837 mobile=21032
```

A successful headless render proves that the page loads at the selected desktop
and mobile viewports; it is not a human visual-design review, interaction E2E or
assistive-technology audit. Those remain release gates.
## Local verification checkpoint

```text
EVAL-ACCESSIBILITY-001 + Academy product checks: 11/11
global regression: 676/681 pass, 3 fail, 2 explicit environment skips
typecheck/build/contracts/inventory/domain/Pages/audit: pass
```

