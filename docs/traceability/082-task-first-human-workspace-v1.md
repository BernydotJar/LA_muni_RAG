# Feature 082 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Task-first evidence workspace | src/humanShell/assets.ts | Feature 082 focused test |
| Grouped civic navigation | src/humanShell/assets.ts | source and browser assertions |
| Secondary session details | src/humanShell/assets.ts | focused HTML test |
| Canonical journey paths | src/humanShell/handler.ts | HTTP path matrix |
| Closed path and panel mapping | src/humanShell/assets.ts | named EVAL and malformed route smoke |
| Permission-bound task shortcuts | src/humanShell/assets.ts | viewer/admin browser smoke |
| Honest zero-data states | src/humanShell/assets.ts | source assertions |
| 320 px diagnostic reflow | zero-minimum shell tracks, no fixed root minimum, forced-scrollbar browser diagnostics | Chromium, Firefox and WebKit |
| Telemetry type contract repair | src/humanSession/types.ts | typecheck and Feature 079 EVAL |
| Provider outage recovery repair | src/humanSession/handler.ts | failure-injection test |
| Design decision and limitations | ADR, risk register, review and product doc | EVAL-HUMAN-WORKSPACE-001 |

## Named gates

- npm run test:human-workspace
- npm run eval:human-workspace
- npm run smoke:human-product-shell-cross-browser
- npm run eval:human-session-reliability

