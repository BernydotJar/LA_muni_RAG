# Feature 090 traceability — governed official HTML acquisition v1

| Requirement | Implementation | Verification |
| --- | --- | --- |
| FR-1 governed plan | `config/acquisition-packs/guatemala-municipal-core-html.json`, `parseHtmlAcquisitionPlan`, source-pack binding | plan/unit tests; 16 exact receipt entries |
| FR-2 network boundary | exact host intersection, public-address policy, pinned Undici dispatcher, manual redirects | private-address and cross-host redirect attacks; live acquisition |
| FR-3 bounded bytes | content-length precheck, Undici maximum, streaming limit | oversized-response test and stable failure code |
| FR-4 encoding and structure | strict UTF-8; declared Windows-1252 HTML only; raw bytes preserved | UTF-8/ISO-8859-1 test, structural inspection, live SNIP legacy page |
| FR-5 malware gate | `scanVerifiedArtifactSnapshot`, required ClamAV identity and definitions | infected test; live clean evidence for 11 artifacts |
| FR-6 immutable local storage | content-addressed paths, 0700 directories, 0600 files, hard-link no-overwrite publication, symlink checks | symlink attack; byte-verification report |
| FR-7 extraction quality | `html_heading_v1`, executable removal, minimum text/sections | extraction tests; two live portal shells blocked |
| FR-8 inventory semantics | success -> `ingestion_pending`; blocked -> unchanged; no indexing object | state tests, receipt before/after fields, inventory validation |
| FR-9 partial completion | threshold 10 of 16, stable per-source blockers | live result 11 successful / 5 blocked |
| FR-10 no raw content in Git | `.rag/library` storage and existing ignore rule | `git check-ignore`; repository status contains metadata only |

## Live acquisition identity

- acquisition ID: `guatemala-municipal-core-html-2026-08-01`
- attempted: 16
- successful: 11
- blocked: 5
- exact verified source bytes: 1,833,794
- receipt: `program/reports/2026-08-01-official-source-acquisition.json`
- receipt SHA-256: `a403b955994a24ac8bd9da38ba72f19a48913fc71a7f1908ff456166145c0726`
- inventory SHA-256: `44966064dde19107c8a3f99bf1d460265f839bac6d2b8393c03058bd3d5547d0`
- byte verification: `program/reports/2026-08-01-official-source-acquisition-byte-verification.json`
- byte-verification SHA-256: `4a0d7a8da1bfba97bee3b20f8ec47455a36be816d349d181df5e64c88929677d`

## Successful source IDs

1. `segeplan-snip-system`
2. `segeplan-snip-standards-2027`
3. `marn-environmental-taxonomy`
4. `marn-environmental-category-a`
5. `marn-environmental-category-b1`
6. `marn-environmental-category-b2`
7. `marn-environmental-category-c`
8. `infom-water-sanitation-services`
9. `guatemala-procurement-law`
10. `guatecompras-use-rules-2022`
11. `mspas-water-project-quality-certification`

## Blocked source IDs

- `guatemala-procurement-regulation` — HTTP 403
- `guatemala-mafim-second-edition` — HTTP 403
- `mspas-water-health-authority` — HTTP 403
- `gt-codigo-municipal-index` — zero extractable sections/text
- `guatemala-development-councils-law` — zero extractable sections/text

## State boundary

The 11 successful sources are locally acquired, clean-scanned and extracted, but remain `ingestion_pending`. They are not indexed, not projected into tenant retrieval, and do not increase supported-procedure counts. The five blocked records retain their prior `verified` state. National material remains insufficient to prove that a particular municipal event occurred.
