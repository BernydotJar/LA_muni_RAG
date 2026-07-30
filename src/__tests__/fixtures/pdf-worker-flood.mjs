for await (const _chunk of process.stdin) {
  // Consume bounded test input before simulating unbounded output.
}

process.stdout.write("x".repeat(32 * 1024));
