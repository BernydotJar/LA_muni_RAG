# Feature 076 — Online Pages release verification v1

Status: temporarily deployed and exact-SHA verified online; rollback pending.

## Goal

Make every future GitHub Pages deployment provable against one exact immutable Git SHA. The
built artifact must expose bounded, non-sensitive build metadata, and a post-deployment Chromium
smoke must reject stale, legacy, partial, or mismatched publications.

## Acceptance

- The Pages build resolves and validates one full 40-character Git SHA.
- Every generated HTML document contains the exact build-SHA marker.
- `build-metadata.json` contains only schema version, build SHA, and API-configured state.
- Artifact verification rejects missing, malformed, or mismatched build metadata.
- The online verifier requires HTTPS outside loopback and rejects credentials, query strings, and fragments.
- Desktop and mobile Chromium verify HTTP 200, exact SHA, product navigation, focus target,
  favicon, responsive width, widget/API coherence, runtime errors, and failed requests.
- The deployment workflow passes `github.sha` into the build and executes the online verifier
  against the deployment output URL.
- Current public Pages drift is recorded without treating the legacy site as Feature 075 evidence.
- Deployment and rollback remain explicitly human-gated.

## Non-goals

No permanent Pages deployment, merge, production API enablement, Cloud SQL restart, Terraform mutation,
real-corpus claim, authenticated browser journey, OS Electoral implementation, or Content Agency implementation.
