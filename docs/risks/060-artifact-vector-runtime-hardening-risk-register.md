# Feature 060 risk register

| ID | Severity | State | Risk | Control/evidence | Remaining action |
|---|---:|---|---|---|---|
| 060-R1 | critical | resolved in slice | Wrong-hash scan could be linked to accepted object | Migration preflight, trigger, lookup/lease predicates, real PostgreSQL rejection | Run remote CI and review production historical rows before rollout |
| 060-R2 | high | resolved in slice | Worker needed row locks but lacked least-privilege mechanism | Tenant-bound security-definer boolean function; no artifact UPDATE; real role gate | Provision exact EXECUTE grant in each environment |
| 060-R3 | high | resolved in slice | Accepted object coordinates/version could mutate without rescan | All-row update trigger and accepted-identity immutability gate | Preserve regression when adding storage adapters |
| 060-R4 | high | resolved in slice | Scan evidence could be edited after acceptance | Update-blocking trigger and SQL regression | Define reviewed retention/deletion policy separately |
| 060-R5 | high | open external | Scanner or object-store adapter may return stale/unauthorized bytes | No default adapter; digest/identity revalidation; interfaces fail closed | Deploy workload identity, immutable storage, quarantine, scanner and definitions monitoring |
| 060-R6 | high | open | Real-corpus vector quality/load is unproved | Atomic tenant persistence and exact synthetic smoke only | Run corpus recall/citation/load/timeout evaluation |
| 060-R7 | medium | mitigated | Security-definer function could expose foreign existence | Typed inputs, fixed search path, tenant equality, boolean result, PUBLIC revoke, cross-tenant gate | Re-review whenever tenant-context architecture changes |
