# Risk Register — Feature 057

| ID | Risk | Control | Residual state |
|---|---|---|---|
| R57-01 | Caller declares another tenant | credential-derived tenant plus exact body match and RLS | Local HTTP/DB denial passes; production identity provisioning pending |
| R57-02 | Viewer or integration client enqueues work | explicit `document:ingest` permission | Local role-denial test passes; administrative role governance pending |
| R57-03 | Anonymous/over-limit body triggers expensive work | auth and per-operation rate gate before parsing | Local order test passes; ingress/global abuse controls and load evidence absent |
| R57-04 | Caller chooses unsafe/incompatible pipeline | closed profile with server-owned config and 1,536 dimension | Controlled in code; provider approval/capacity and rotation procedure pending |
| R57-05 | Cross-tenant/missing job IDs become an oracle | same scoped lookup and uniform 404 | Real DB HTTP parity passes; timing/load side-channel review pending |
| R57-06 | Response leaks artifact/control credentials | closed schema omits digest, raw key, worker, lease, provider/model | Contract/HTTP checks pass; centralized log/trace redaction unproven |
| R57-07 | Rate/audit state leaks across tenants | tenant-leading key, forced RLS, non-owner role | Disposable SQL gate passes; production grants/continuous attestation absent |
| R57-08 | Anonymous failures amplify audit storage | minute/reason aggregate and 30-day opportunistic retention | Locally controlled; global traffic/retention capacity unmeasured |
| R57-09 | Mutable object alias substitutes bytes | resolver must return immutable object version and exact digest | Interface/worker validation exists; no real object-store adapter/IAM proof |
| R57-10 | Scan evidence is stale or belongs to other bytes | digest/size/type/signature/time/scanner/definition binding | Unit gate passes; no deployed scanner or evidence store |
| R57-11 | Parser mutates or substitutes accepted bytes | private copy plus post-extraction rehash | Mutation test passes; OS/native isolation remains unapproved |
| R57-12 | Lease expires during long provider call | periodic heartbeat, checkpoints, DB fencing | Lease-loss test passes; total attempt deadline/cancellation and HA clocks pending |
| R57-13 | Worker retries poison documents forever | stable codes and durable bounded attempts/backoff | Core bounded; dead-letter, repair UI, quotas, metrics, alerts absent |
| R57-14 | Callable worker is mistaken for running service | no entry point/default resolver; health says worker false | Documentation/test control only; deployment design remains open |
| R57-15 | API is mistaken for upload/acceptance authorization | only existing version/hash accepted; no bytes/path/URL | Boundary explicit; authenticated admin/upload flow absent |
| R57-16 | Migration `006` breaks historical vector upgrade | fresh and supported 011-before-003 chains plus unsafe negative gate | Local PG16 evidence only; populated restore/timing ledger absent |
| R57-17 | New gate touches controlled DMP | synthetic version/hash/content fixtures only | All smokes report zero reads; DMP remains acquired only |
| R57-18 | CI success is treated as deployment approval | read-only non-deploying workflow and human-gated runbook | Platform/release authority remains intentionally absent |
