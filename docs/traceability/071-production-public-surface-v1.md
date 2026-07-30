# Requirements traceability — Feature 071

| Requirement | Implementation | Verification |
|---|---|---|
| Direct Assistant/Glass Wall menu | `public/index.html`, `public/product.js` | production public-surface eval |
| Remove non-product sections | concise homepage shell | negative copy/section assertions |
| Modular accessible styling | `public/product.css`, `DESIGN.md` | focus/action/opaque/mobile/reduced-motion tests |
| No static answers or procedures | `public/pages-api-bridge.js`; old bridge deleted | fail-closed bridge tests and Pages artifact verifier |
| Disable unconfigured assistant | `public/widget.js` | municipal product-readiness tests |
| Safe API URL | `scripts/build-pages.mjs`, bridge sanitizer | production Pages/security tests |
| No browser credential | bridge strips credentials and forwards none | static security assertions; gateway blocker documented |
| Production legacy route remains hidden | existing server production gate | `production-server-surface.test.ts` |
| GCP selected without resources | ADR, GCP blueprint, `infra/gcp/README.md` | documentation eval; no Terraform apply/resource receipt |
| External tools bounded | external assessment | documentation eval |
