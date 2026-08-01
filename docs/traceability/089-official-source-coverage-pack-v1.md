# Feature 089 traceability — official source coverage pack v1

| Requirement | Implementation | Verification |
| --- | --- | --- |
| FR-1 concrete gap requirements | `src/domain/packs/municipal-antigua-water.ts` | `official-source-coverage-pack-v1.test.ts`: 47 categories, no generic placeholder |
| FR-2 academy parity | `public/data/water-training-map.json`, `public/procedure-training.js` | exact domain/static parity and `Fuente requerida` rendering tests |
| FR-3 environmental neutrality | `marn-environmental-classification` connector and MARN inventory limitations | taxative-list entry-point and candidate-category test; red-team RT-089-01 |
| FR-4 official source expansion | nine `verified` records in `.rag/source-inventory.json` | inventory validation plus source-verification receipt |
| FR-5 state semantics | records contain no acquisition, scan, extraction or indexing evidence | focused assertion for all nine records |
| FR-6 pack/inventory binding | `validateSourcePackInventoryBindings` and CLI integration | unknown ID, duplicate binding, missing tag and host-mismatch attacks |
| FR-7 authority boundary | concrete case evidence plus record limitations | focused non-proof limitation assertions and red-team RT-089-05 |
| HTTPS and allowlists | source-pack schema and cross-binding validator | source-pack tests and `npm run source-packs:validate` |
| Persistent graph lifecycle | Feature 089 project node and append-only events | `npm run graph-harness:verify` |

## Governed source identities

1. `guatemala-mafim-second-edition`
2. `marn-environmental-taxonomy`
3. `marn-environmental-category-a`
4. `marn-environmental-category-b1`
5. `marn-environmental-category-b2`
6. `segeplan-snip-standards-2027`
7. `mspas-water-health-authority`
8. `mspas-water-project-quality-certification`
9. `guatecompras-use-rules-2022`

The source-verification receipt is `program/reports/2026-08-01-official-source-coverage-verification.json`. It records discovery provenance only; zero new artifacts are represented as acquired or ingested.

## Authority model

- National sources can establish national legal, technical, financial, environmental, health or platform requirements.
- Municipal sources can establish local organizational rules and approved local procedures when current and applicable.
- Case evidence is required to prove that a request, act, inspection, award, contract, payment, reception or other event occurred.
- A taxative-list classification must precede selection of a category-specific MARN route.

## Deferred lifecycle

Acquisition, malware scanning, extraction, OCR, indexing, managed corpus mutation, public projection, merge and deployment are outside this feature and remain separately gated.
