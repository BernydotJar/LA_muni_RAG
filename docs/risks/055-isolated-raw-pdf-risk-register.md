# Risk Register — Feature 055

| ID | Risk | Control | Residual state |
|---|---|---|---|
| R55-01 | Malformed PDF crashes or stalls the API process | PDF.js runs in a killable child with a wall-time bound | Controlled locally; kernel/container failure domain not exercised |
| R55-02 | Small PDF expands into excessive page text/output | input/page/per-page/total/stdout bounds and strict result validation | Controlled to configured ceilings; pathological parser allocation before checks remains possible |
| R55-03 | Worker floods stderr or leaks parser details | stderr byte cap; parent never returns raw diagnostics | Controlled with adversarial fixture |
| R55-04 | Encrypted/corrupt/text-free PDF is treated as successful | stable fail-closed codes and zero-section rejection | Controlled; OCR is intentionally absent |
| R55-05 | Parser opens paths or fetches attacker-controlled URLs | only verified bytes are sent; worker uses local data with worker fetch disabled | Controlled by code path; no OS network namespace exists |
| R55-06 | Child writes files or spawns more execution | Node permission mode grants only exact read roots and addons | Controlled at Node API boundary; not an OS sandbox |
| R55-07 | Native canvas or PDF.js consumes non-V8 memory | separate process and wall timeout | Open; V8 heap flag is not a total RSS/native-memory cap |
| R55-08 | Dependency compromise or silent parser drift | exact `pdfjs-dist` and `@napi-rs/canvas` versions, lockfile, and dependency audit gate | Registry/build provenance, SBOM, signatures, and image scanning remain pending |
| R55-09 | Parser upgrade changes text/chunk hashes and citations | parser/version recorded in metadata; exact dependency | Future upgrades require re-extraction/evaluation/version review |
| R55-10 | Direct index/backfill bypasses scan evidence | `.pdf` paths fail before provider/read/extract; document library is the operational entry | No authenticated ingestion API exists; same-process code remains a trust boundary |
| R55-11 | Same artifact is parsed twice with inconsistent results | document library extracts once and passes normalized object | Controlled with identity/call-count test |
| R55-12 | Embedding fan-out creates denial-of-wallet | 5,000-chunk cap and sequential 64-text batches | Per-tenant/global quotas and distributed job limits remain absent |
| R55-13 | Concurrent PDFs exhaust a scaled deployment | per-process parser concurrency cap | Open; no distributed queue, tenant quota, lease, or autoscaling policy |
| R55-14 | Temporary files persist or expose content | private empty cwd; input remains stdin; cwd removed in `finally` | Host temp encryption, forensic retention, and crash-orphan policy are platform decisions |
| R55-15 | Scanner reads different bytes through ABA path mutation | private verified scan snapshot plus managed-path recheck | Controlled locally; storage-level locking/CAS remains absent |
| R55-16 | Snapshot scanner lacks access under daemon user | `clamdscan --stream` lets the client stream private bytes | Real daemon/config/topology is not installed or tested |
| R55-17 | PDF tables, forms, scans, or images lose meaning | documentation limits output to text-bearing page text | Open by design; requires separate OCR/layout evaluation and human review |
| R55-18 | Successful parser test is mistaken for approval of the DMP | DMP remains acquired only; docs and program evidence forbid extraction/indexing | Human/scanner/tenant/platform gates remain pending |
