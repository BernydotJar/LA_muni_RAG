# Risk register — Feature 063 Procedure Academy

| ID | Risk | Severity | State | Control/evidence | Remaining action |
|---|---|---:|---|---|---|
| PTA-001 | Public UI is mistaken for authenticated SaaS | critical | mitigated in preview | public/read-only badges; disabled SaaS routes; no login/token fields | approved IdP/session/BFF before enabling protected UI |
| PTA-002 | Learning progress is mistaken for procedure completion | high | mitigated | “comprendido localmente”; no certification; explicit footer/boundary note | repeat boundary in authenticated case/training records |
| PTA-003 | Browser stores credentials or case facts | critical | mitigated | progress allowlist; static security tests; credential-omitting fetch | browser storage/CSP/DevTools review in staging |
| PTA-004 | Dynamic source text injects markup or unsafe URL | high | mitigated | createElement/textContent; HTTP(S) allowlist; noopener/noreferrer | browser fuzzing and CSP report-only evidence |
| PTA-005 | Static curriculum is treated as the official water procedure | high | mitigated | research_not_facts=true; missing-evidence text; categories label | real-corpus/human applicability review and source viewer |
| PTA-006 | Automated accessibility gate overclaims WCAG compliance | high | mitigated | scoped eval name/result and explicit screen-reader/browser limitations | human WCAG 2.2 AA audit and supported-browser matrix |
| PTA-007 | API failure leaves an unusable blank screen | medium | mitigated | versioned static curriculum and dependency_failure state | browser/offline/degraded E2E |
| PTA-008 | Local progress leaks across shared-device users | medium | open usability/privacy | no sensitive data; clear-progress action | tenant/user-bound training state after authentication |
| PTA-009 | Visual density overwhelms mobile/low-vision users | high | partially mitigated | reflow breakpoints, contrast, focus, reduced motion, semantic sections | zoom/reflow observation, low-vision and screen-reader review |
