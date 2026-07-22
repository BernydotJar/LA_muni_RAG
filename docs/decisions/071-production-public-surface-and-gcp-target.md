# Decision 071 — Production public surface and GCP target

Date: 2026-07-22
Status: accepted for implementation; infrastructure creation remains human-gated

## Decision

1. Replace the public demo/pitch surface with a concise product shell.
2. Keep public UI assets dependency-free and modular; do not add Tailwind.
3. Remove all static answer/procedure/domain fixtures from GitHub Pages.
4. Fail closed with a bounded unavailable state until a real API is configured.
5. Keep legacy `/api/chat`, `/api/procedure`, and `/api/domain-pack` disabled in
   production. Do not put integration Bearer credentials in browser code.
6. Implement a dedicated public query gateway/BFF before enabling the public
   assistant against production data.
7. Select Google Cloud as the target platform:
   - Cloud Run for the API and separately reviewed workers/jobs;
   - Cloud SQL for PostgreSQL plus pgvector;
   - Cloud Storage for immutable documentary artifacts;
   - Pub/Sub or Cloud Tasks for asynchronous work;
   - Secret Manager, Artifact Registry, Cloud Logging and Monitoring.
8. Infrastructure code, project creation, billing enablement, Terraform apply,
   DNS and deployment remain explicitly human-gated.

## Rationale

The existing Node container maps naturally to Cloud Run and can start with zero
minimum instances plus a small maximum-instance limit. Cloud SQL supports the
PostgreSQL `vector` extension used by the repository. App Runner is not selected
for a new deployment because AWS announced the end of new-customer onboarding;
ECS would require more initial platform surface than Cloud Run for this stage.

The browser cannot safely call the authenticated tenant API directly. The v1
Search API requires a tenant-bound credential and production intentionally hides
the old public routes. A dedicated gateway is required to bind one approved
public corpus, enforce abuse controls, minimize audit data, and avoid exposing a
service secret.

## Consequences

- GitHub Pages is a real static frontend, not a data simulator.
- Without `PAGES_API_URL`, the widget is intentionally unavailable.
- Setting `PAGES_API_URL` is not sufficient until the target implements the
  approved public gateway contract.
- The authenticated v1 APIs remain the source of truth for tenant products.
- Production readiness still requires corpus, identity, infrastructure,
  observability, load, recovery and human approval evidence.
