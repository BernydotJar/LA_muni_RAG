for await (const _chunk of process.stdin) {
  // Consume bounded test input before simulating a stalled parser.
}

setInterval(() => {}, 1_000);
