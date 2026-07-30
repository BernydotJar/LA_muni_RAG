for await (const _chunk of process.stdin) {
  // Consume bounded test input before simulating a parser-process crash.
}

process.exit(7);
