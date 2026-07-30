# Feature 073 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Accidental execution against a non-test cluster | critical | loopback `/postgres`, explicit confirmation, admin capability check, unrelated-database rejection | operator still controls the local endpoint |
| Dirty environment is deleted without approval | critical | fail closed unless explicit clean flag; cleanup only after ownership established | clean flag is intentionally destructive for fixed test names |
| Secrets leak through child environment or receipt | critical | minimal env, dotenv disabled, output captured, closed schema, sensitive-string scan, mode 0600 | process memory contains ephemeral DB credentials during run |
| API journeys are claimed without exact role personas | high | dedicated viewer/admin/case-operator fixtures and HTTP calls | human session/UI remains absent |
| Smoke mapping hides missing journey | high | exact 20/20 uniqueness assertion against canonical plan | mapping still relies on reviewed smoke semantics |
| Failure leaves databases or roles | high | finally cleanup, forced DB drop, independent postcondition query | host/container crash can interrupt process cleanup; next run requires explicit clean |
| Reset check observes seeded state | high | catalog database is dropped/recreated and a no-source credential is seeded | only source-list reset is exercised |
| Synthetic staging is mistaken for production | critical | docs/receipt explicitly deny corpus, browser, cloud and deployment claims | stakeholder interpretation remains a governance risk |
