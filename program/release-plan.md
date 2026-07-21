# LA Muni RAG — Release Plan

Updated: 2026-07-21T21:53:16Z

## Current release classification

```text
release_candidate: no
production_ready: no
protected_main_contains_cumulative_features: no
open_pr: no
staging_verified: no
production_deployed: no
observed_in_runtime: no
```

The cumulative branch passes extensive local, detached, disposable PostgreSQL and
remote CI gates. It is still a development checkpoint, not a releasable product.

## Functional branch receipts

| Capability | Commit | CI |
|---|---|---:|
| Procedure Academy publication repair | `d65e16e3faf1986a7d8eca0683f0f9f5b10081d8` | 29865728313 success |
| ProcedureCase lifecycle | `cf9449dde7d41d5ecdb5b34996bf73ee6ea803ef` | 29866907067 success |
| Disposable logical restore drill | `5d4541000d234c6ccf23155f5eeab70b467dd0c6` | 29867846337 success |
| Remaining required named evals | `e39ad7740324895c914e15106746f453e213de77` | 29871698536 success |

## Required before release candidate

- minimum catalog APIs complete;
- durable official corpus bytes, current scan, extraction, ingestion and human review;
- real-corpus retrieval/citation/refusal thresholds;
- human identity/session/provisioning and authenticated UI;
- privacy retention/deletion/legal-hold/DSAR approval;
- production object/scanner/dispatcher/secrets architecture;
- staging deployment, telemetry, SLOs/alerts, load/HA;
- coordinated object/database restore and PITR/KMS exercise;
- external consumer contract evidence;
- browser/screen-reader/human WCAG review;
- no unresolved critical/high findings;
- human legal, privacy, security and release approvals.

## Release sequence

1. Create human-reviewed cumulative draft PR(s) from published feature branches.
2. Run protected-branch CI and migration review.
3. Deploy immutable candidate to production-shaped staging.
4. Run corpus, browser, security, privacy, load/HA and recovery gates.
5. Record reviewer sign-offs and exact image/config/migration digests.
6. Obtain explicit deployment approval.
7. Merge protected main and deploy through the approved pipeline.
8. Observe health/SLOs and complete the release observation window.
9. Record rollback/forward-fix decision if any hard gate fails.

No step in this sequence is implied by a feature-branch green check.
