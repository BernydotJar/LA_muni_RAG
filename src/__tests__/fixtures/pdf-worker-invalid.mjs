for await (const _chunk of process.stdin) {
  // Consume bounded test input before returning an invalid protocol object.
}

process.stdout.write(JSON.stringify({ schemaVersion: 1, ok: true, extra: "unexpected" }));
