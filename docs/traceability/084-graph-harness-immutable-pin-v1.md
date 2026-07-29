# Traceability - Feature 084 Graph Harness immutable pin v1

| Requirement | Implementation | Verification |
|---|---|---|
| Immutable published framework reference | `program/graph-harness/project.json` node `PRG-GRAPH-HARNESS-PIN-002` | `scripts/verify-graph-harness-runtime.sh` |
| Runtime commit included in merge | node metadata binds merge and runtime commits | `EVAL-GRAPH-HARNESS-RUNTIME-PIN-001` |
| Replay existing state | pinned runtime executes validate/status/ready | local verifier and Backend CI |
| No copied runtime | no application `graph_harness/` directory | verifier and named EVAL |
| Persistent evidence | append-only Graph Harness events and typed state | program checkpoint reconciliation |
