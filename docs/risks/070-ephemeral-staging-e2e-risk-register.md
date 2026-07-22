# Risk register — Feature 070

| ID | Severity | Risk | Control in this slice | Residual gap |
|---|---|---|---|---|
| E2E-070-01 | critical | Production credentials or data enter test artifacts | closed schema, runtime-only credential references, secret-pattern scan, production endpoint allowlist | platform secret injection and continuous environment attestation not implemented |
| E2E-070-02 | critical | Browser tests use service Bearer credentials | browser identity is explicitly blocked pending IdP/BFF/session | human identity architecture remains unapproved/unimplemented |
| E2E-070-03 | critical | Cross-tenant fixtures leak | two tenants, forced cross-tenant denial journey, RLS concern, fresh DB reset | deployed staging RLS drift and human review remain open |
| E2E-070-04 | high | Reset omits mutable resource classes | verifier derives mutable fixture types and requires reset coverage | future platform adapter still needs destructive-isolation proof |
| E2E-070-05 | high | Browser suite duplicates API tests and becomes brittle | closed API/browser concern sets and policy violations fail | future UI authors must preserve the boundary |
| E2E-070-06 | high | OS Electoral or Content Agency stubs are presented as interoperability | external consumers locked to provider-contract-only and overclaims fail | external consumer repository suites remain absent |
| E2E-070-07 | high | Object/scanner stubs are presented as production services | boundary-stub mode and `production_equivalent=false` | durable storage, current scanner, definitions monitoring and dispatcher absent |
| E2E-070-08 | high | Role matrix drifts from runtime authorization | exact import and set comparison against canonical RBAC | human provisioning and access review absent |
| E2E-070-09 | medium | Test data becomes non-deterministic | stable UUIDs, fixed fixture keys, fresh database per run | platform clock/randomness adapters not yet implemented |
| E2E-070-10 | medium | Browser suite expands without diagnostic value | budget of twelve blocked critical journeys | future approval and pruning discipline required |
| E2E-070-11 | high | Architecture conformance is mistaken for deployed staging | docs, summary flags and limitations explicitly deny the claim | infrastructure, system journeys and browser runs remain open |
