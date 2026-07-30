# Feature 076 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Stale or wrong revision reported as deployed | critical | exact HTML/JSON SHA marker plus post-deploy comparison | CDN propagation can delay a valid deployment |
| Legacy Pages content mistaken for product evidence | critical | product selectors and exact SHA required | current public URL remains legacy until authorized deployment |
| Public deployment replaces current site | high | deployment remains human-gated; exact SHA and rollback target required | GitHub Pages has one public site for the repository |
| Build metadata leaks sensitive data | high | metadata allowlist contains only schema, SHA, and API-configured boolean | public Git SHAs remain intentionally visible |
| Online verifier sends credentials | critical | verifier uses a clean browser context and never supplies credentials | future authenticated previews need a separate threat model |
| External URL or downgrade attack | high | HTTPS required outside loopback; credentials/query/fragment rejected | DNS and GitHub Pages platform remain external dependencies |
| Online smoke becomes flaky | medium | bounded deterministic selectors, two scenarios, explicit network/runtime errors | transient CDN/network faults can still fail a valid release |
