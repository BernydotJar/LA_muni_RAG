# Feature 075 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Public tests misreported as authenticated E2E | critical | separate Feature 075 scope, named workflow and explicit blocked-journey assertions | stakeholder wording can still overstate evidence |
| Browser credential leakage through the Pages bridge | critical | real-browser echo harness verifies Authorization, Cookie and arbitrary headers are stripped | deployed backend CORS and gateway policy remain separate |
| Responsive regressions hidden by static tests | high | desktop/mobile geometry and overflow assertions | device matrix is Chromium-only v1 |
| Accessibility regressions | high | skip-link focus, reduced motion and semantic role checks | this is not a complete manual WCAG audit |
| Flaky browser tests | medium | local loopback server, deterministic fail-closed responses, one CI worker and bounded retries | browser/runtime changes may still expose timing defects |
| Test harness shipped to production | high | harness exists only in `scripts/serve-pages-test.mjs`; Pages build copies only `public/` | repository reviewers must preserve this boundary |
| Diagnostics expose sensitive data | high | public synthetic inputs only; reports ignored and retained on failure | future authenticated tests require a separate redaction review |
