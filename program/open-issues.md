# LA Muni RAG — Open Issues

Updated: 2026-07-22T01:05:41Z

## Closed locally by Feature 069

- Provider-side portable manifests exist for OS Electoral and Content Agency.
- Five interactions are bound to exact OpenAPI routes, headers, statuses, schemas and canonical examples.
- Complete interaction inventories, output discriminators, response correlation headers and foreign-owned field guards are executable.
- Functional commit `5e5481e26b1a27a0aa2bd9c965e1c160f18b3198` is published at the exact remote ref.
- Detached verification passes 795/793/0/2, 30/30 canonical contracts, 2 kits/5 interactions, typecheck, build and two zero-vulnerability audits.
- Backend CI run `29882062536` is `success`. No PR, merge or deployment exists.

## Critical product blockers

### External consumers

1. OS Electoral has not pinned or executed the kit in its own repository.
2. Content Agency has not pinned or executed the kit in its own repository.
3. Cross-product persistence, retries, expiry, revocation and supersession remain unproved.

### Corpus and human review

1. Zero authorized durable bytes and zero real ingested documents.
2. No real-corpus retrieval/citation/latency/load evaluation.
3. No human authority, vigencia, supersession or applicability sign-off.

### Human SaaS, staging and E2E

1. IdP/OIDC/BFF/session architecture remains undecided/unimplemented.
2. Deterministic tenant identities/data and isolated ephemeral staging are absent.
3. Authenticated role-aware UI and browser/screen-reader evidence are absent.
4. Browser E2E is intentionally deferred until these prerequisites stabilize.

### Platform and release

1. Production Terraform, secrets, object/scanner/dispatcher, observability, SLOs, load/HA, coordinated recovery and privacy operations remain absent.
2. No reviewed PR, protected merge, deployment or observation window exists.

## Next safe executable work

`WS08-EXTERNAL-CONSUMER-CONFORMANCE-001` requires explicit access/coordination with neighboring repositories. In this repository, the next autonomous preparation work is an ephemeral staging/E2E architecture specification that does not provision paid services or use production credentials.
