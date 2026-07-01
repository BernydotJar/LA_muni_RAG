# 005 Server Test Hang Fix Design

Status: Implemented

## Root Cause

`src/__tests__/server.test.ts` created an HTTP server and called
`server.close()` without awaiting the close callback. Its `server.listen(0)`
setup also did not reject on listen errors, so an environment-level bind failure
could leave the test lifecycle unresolved. The test also duplicated the
production request handler, which made lifecycle drift likely.

## Design

`src/server.ts` now separates three concerns:

```text
createRequestHandler()
  -> owns route behavior

createApiServer()
  -> owns HTTP server construction

startServer()
  -> owns production listener, signal handlers, and database shutdown
```

The module only calls `startServer()` when executed directly. Importing it in
tests no longer binds a real port as a side effect.

The integration test imports `createApiServer()`, listens on an ephemeral
`127.0.0.1` port, rejects immediately on listen errors, awaits
`server.close()`, then closes the PostgreSQL pool.

## Behavior Preservation

All route branches are the same logic that previously lived in `src/server.ts`.
The `/api/answer` route still calls `buildDeterministicAnswer()`, which calls
`findEvidence()`.
