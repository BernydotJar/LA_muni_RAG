# Current Progress

## Active Feature

088-public-procedure-premium-v1

## State

completed_with_documented_deferred_scope

## Mode

SHIP

## Public product

- Pages: `https://bernydotjar.github.io/LA_muni_RAG/`
- Procedure workflow: `https://bernydotjar.github.io/LA_muni_RAG/procedure-workflow.html`
- Gateway: `https://la-muni-rag-public-gateway-ccaqcuwgyq-uc.a.run.app`
- Cloud Run revision: `la-muni-rag-public-gateway-proc-a571b`
- Immutable image: `sha256:e15a1108ebb4b67242b1fdf5e9f708aa30b502831acb4a05aa10bc488dd38aad`

## Completed

- exact-origin public domain-pack and procedure routes;
- tenant-scoped RLS evidence retrieval;
- bounded lexical keyword, phrase and hybrid retrieval;
- official HTTPS citations and explicit unsupported-step gaps;
- premium responsive design system with idle/loading/success/error states;
- desktop and mobile end-to-end generation with no failed requests, console errors or overflow;
- Cloud SQL protected runtime and 0–2 instance Cloud Run bound;
- custom and legacy GitHub Pages deployments;
- Graph Harness revision 1 gate PASS and node done.

## Verification

- full suite: 1064 total / 1063 pass / 0 fail / 1 explicit environment skip;
- dependency audit: 0 vulnerabilities;
- Backend CI and Public Browser Gate: success on feature head and merge;
- water query: 47 steps / 5 gaps / 8 citations;
- stadium query: 6 steps / 4 gaps / 8 citations;
- promoted revision ERROR logs in release window: 0.

## Deferred scope

- productive Google or Microsoft OIDC;
- MFA, recovery and access review for privileged users;
- twelve authenticated journeys;
- DMP OCR and human quality review;
- broader official municipal corpus and held-out judgments;
- semantic-search, complete-procedure, legal-correctness, vigencia and production-SLO claims.

## Next safe work

Expand the official corpus under a separate graph node using provenance, malware scan, extraction, authority/vigencia review and held-out retrieval judgments. The 32-topic municipal taxonomy supplied from the separate research project may be used as a coverage map only; political/media profiling remains outside LA Muni RAG.
