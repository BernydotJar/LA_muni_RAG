# Feature 069 risk register

| ID | Risk | Severity | Control | Residual action |
|---|---|---:|---|---|
| CCK-001 | A manifest silently drops a supported interaction | high | exact consumer-specific interaction set | consumer repository pins and verifies exact SHA |
| CCK-002 | Route/header/status drift is missed | high | exact OpenAPI set comparison | run verifier in both provider and consumer CI |
| CCK-003 | An interaction name is rebound to another schema/example | high | canonical name-to-artifact binding and discriminator checks | version kit on intentional breaking change |
| CCK-004 | Consumer-owned campaign/content fields enter provider artifacts | critical | required forbidden-field guards plus recursive example scan | consumer tests must reject invented foreign fields at runtime |
| CCK-005 | Provider-side green is mistaken for interoperability | high | explicit limitations in manifests/docs/eval | execute cross-repository consumer suites before staging |
| CCK-006 | Mutable branch download changes contracts unexpectedly | high | require commit-SHA pinning | add immutable release artifact only after human release approval |
