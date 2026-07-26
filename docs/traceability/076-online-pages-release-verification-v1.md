# Feature 076 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Exact build identity | `scripts/pages-build-metadata.mjs`, `scripts/pages-build-metadata.d.mts` | full lowercase 40-character SHA validation |
| HTML release marker | `scripts/build-pages.mjs` | artifact verifier checks exact marker |
| Bounded public metadata | `dist-pages/build-metadata.json` generation | exact three-field allowlist in online verifier |
| Artifact drift rejection | `scripts/verify-pages-artifact.mjs` | mismatched SHA fails before upload |
| HTTPS-only public target | `sanitizePagesOnlineUrl` | non-loopback HTTP and credential-bearing URLs rejected |
| Desktop/mobile online smoke | `scripts/verify-pages-online.mjs` | local loopback receipt passes both scenarios |
| Product identity | online title/nav/favicon/main/widget assertions | legacy Jekyll publication is rejected |
| Runtime/network health | pageerror, console error, request-failure collectors | any collected issue fails verification |
| Post-deploy enforcement | `.github/workflows/deploy-pages.yml` | deploy output URL and `github.sha` feed verifier job |
| Human deployment boundary | runbook, ADR, Feature 076 spec | no deployment executed by this slice |
