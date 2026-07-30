# Procedure Deep-Dive UI

Feature 050 adds a progressive visual layer over the verified `depth=deep_dive` Procedure Workflow Advisor response.

## User flow

1. The existing procedure page remains in overview mode by default.
2. The user can select **Ver flujo completo**.
3. Procedure requests include `depth=deep_dive`.
4. The existing workflow cards remain the base renderer.
5. `procedure-deep-dive.js` enriches the rendered workflow with:
   - dependencies and decisions;
   - step evidence status;
   - explicit evidence statements;
   - responsible role/unit only when returned by the backend;
   - deadline only when returned by the backend;
   - expandable citation dossiers;
   - visible unsupported and inferred states.

## Safety contract

- The UI does not synthesize legal authority.
- Missing responsibility or deadline fields remain absent.
- Unsupported steps display: `No encontré base documental suficiente para afirmar este paso.`
- Inferred steps display that human validation is required.
- Dynamic workflow and citation content is escaped before HTML insertion.
- Comparative evidence is displayed using the backend evidence status and authority metadata.

## Progressive enhancement

The existing `procedure-workflow.html` renderer is not replaced. `procedure-feedback.js` loads `procedure-deep-dive.js`, which intercepts only `/api/procedure` requests and enriches only workflows whose metadata depth is `deep_dive`.

This preserves the current overview behavior and limits the change surface.

## GitHub Pages

GitHub Pages cannot execute the API. The current bridge returns HTTP 503 unless a reviewed public gateway is configured. No static overview or deep-dive workflow is generated; the renderer operates only on an actual API response and does not invent roles, deadlines, approvals, legal requirements, or production case status.

## Verification

```bash
npm run typecheck
npm run build
node --import tsx --test src/__tests__/procedure-deep-dive-ui.test.ts src/__tests__/procedure-workflow-ui-cards.test.ts
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
git diff --check
```
