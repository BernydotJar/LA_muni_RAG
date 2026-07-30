# Feature 073 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Plan-driven 20/20 coverage | `src/staging/ephemeralStagingRunner.ts` | named eval coverage assertion |
| Loopback/dedicated cluster | `assertSafeStagingAdminUrl`, PostgreSQL preflight | adversarial unit tests + real run |
| Four fresh databases / three roles | scenario constants and executor | real receipt + independent zero/zero query |
| Exact personas | search/catalog/case runtime fixtures and smokes | real 20/20 run |
| No shell/local dotenv | PostgreSQL executor | static hard eval |
| Reset integrity | `staging_reset_runtime_gate.sql`, reset smoke | HTTP 200 with empty source items |
| Failure cleanup | orchestration `finally` | synthetic smoke-failure test |
| Preserve unowned dirty environment | ownership flag | dirty-environment unit test |
| Sanitized receipt | receipt schema/validator and CLI | schema/adversarial tests + real receipt scan |
| CI execution | Backend CI final runner step | remote run pending publication |
