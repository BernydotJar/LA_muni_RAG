#!/usr/bin/env node
import { spawn } from "node:child_process";
import { killPorts } from "./kill-ports.mjs";

const CANONICAL_PORT = "4010";
const PROJECT_PORTS = ["4000", "4010", "4011"];

await killPorts(PROJECT_PORTS);

const child = spawn("npm", ["run", "dev:api"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: CANONICAL_PORT,
  },
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

