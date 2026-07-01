#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const DEFAULT_PORTS = ["4000", "4010", "4011"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const listPids = (port) => {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
};

export const killPorts = async (ports = DEFAULT_PORTS) => {
  for (const port of ports) {
    if (!/^\d+$/.test(port)) {
      throw new Error(`Invalid port: ${port}`);
    }

    const pids = listPids(port);
    if (pids.length === 0) {
      console.log(`port ${port}: free`);
      continue;
    }

    for (const pid of pids) {
      console.log(`port ${port}: stopping pid ${pid}`);
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // The process may already have exited.
      }
    }

    await sleep(500);

    for (const pid of listPids(port)) {
      console.log(`port ${port}: force stopping pid ${pid}`);
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // The process may already have exited.
      }
    }
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const ports = process.argv.slice(2);
  await killPorts(ports.length > 0 ? ports : DEFAULT_PORTS);
}

