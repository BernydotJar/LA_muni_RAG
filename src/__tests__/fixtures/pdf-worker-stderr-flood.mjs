for await (const _chunk of process.stdin) {
  // Consume bounded test input before simulating unbounded diagnostics.
}

process.stderr.write("x".repeat(32 * 1024));
setInterval(() => {}, 1_000);
