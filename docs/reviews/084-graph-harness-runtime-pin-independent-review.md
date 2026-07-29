# Independent review - Feature 084 Graph Harness immutable runtime pin

## Verdict

PASS WITH LIMITATIONS.

## Producer result

The application installs Graph Harness SDLC directly from published merge commit `1bebce3db35303072049233786464bb01163c98b`. That merge contains executable runtime commit `fef364bc66849b98c08d3c1dcb91caf9701027cd`. The application executes `validate`, `status`, and `ready` against its own project and append-only event ledger.

## Critic and red-team checks

- The verifier rejects alternate project or event paths.
- The installed package identity must include the exact commit.
- The replay must retain project identity and at least the known event count.
- The project metadata must bind both the merge and runtime commit.
- A local `graph_harness` source directory causes failure, preventing copied runtime code.
- The runtime grants no merge, deployment, identity, corpus, spending, or infrastructure authority.

## Limitations

- Availability of the public Git repository is required for a fresh verification install.
- A compromised upstream Git hosting account is outside this repository's controls; commit immutability and review remain required.
- This pin proves runtime identity and replay, not product production readiness.
