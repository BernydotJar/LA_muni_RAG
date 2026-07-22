# Feature 071 — Production public surface v1

Status: implemented locally; verification and publication pending.

## Goal

Convert the public frontend from a presentation/demo surface into a concise,
honest product shell that can be connected to a real backend without fabricating
responses or exposing service credentials.

## Requirements

1. The primary menu exposes Assistant and Glass Wall directly.
2. The homepage contains the product hero and installation guidance only; the
   removed marketing/explainer sections must not render.
3. The primary CTA uses a reserved interaction color and every interactive
   element has a visible keyboard focus state.
4. Text on glass surfaces has a predictable opaque-enough background and WCAG
   contrast is treated as a release gate.
5. CSS and JavaScript are modular assets suitable for the standalone page and
   embeddable widget; Tailwind is not introduced.
6. GitHub Pages never creates static answers, citations, procedures, domain
   metadata, or evidence claims.
7. Without a configured HTTPS API, approved Pages calls return a bounded 503 and
   the widget disables its query controls.
8. A configured API URL cannot contain credentials, query parameters, or a
   fragment; HTTP is permitted only for localhost.
9. The widget does not claim a verified/official corpus. Evidence labels are
   derived only from an actual backend response.
10. Production `/api/chat` remains disabled. Browser service credentials remain
    forbidden. A dedicated public query gateway/BFF is a separate required slice.
11. GCP is the selected deployment target in architecture only. This slice must
    not create cloud resources, incur cost, merge, or deploy.
12. OpenSEO and Unlimited-OCR are optional isolated evaluations, not runtime
    dependencies of this slice.

## Non-goals

- public anonymous query gateway implementation;
- human OIDC/BFF/session implementation;
- corpus acquisition or ingestion;
- Terraform apply or cloud project creation;
- external model download/execution;
- production release.
