import type {
  HumanSessionTelemetry,
  HumanSessionTelemetryEvent,
  HumanSessionTelemetryOperation,
  HumanSessionTelemetryOutcome,
} from "./types.js";

const OPERATIONS: readonly HumanSessionTelemetryOperation[] = Object.freeze([
  "login",
  "callback",
  "session_bootstrap",
  "session_rotate",
  "logout",
]);
const OUTCOMES: readonly HumanSessionTelemetryOutcome[] = Object.freeze([
  "success",
  "denied",
  "unavailable",
  "server_error",
]);
const METHODS = Object.freeze(["GET", "POST", "OTHER"] as const);

const validEvent = (event: HumanSessionTelemetryEvent): boolean =>
  OPERATIONS.includes(event.operation) &&
  METHODS.includes(event.method) &&
  OUTCOMES.includes(event.outcome) &&
  Number.isInteger(event.statusCode) &&
  event.statusCode >= 100 &&
  event.statusCode <= 599 &&
  Number.isFinite(event.durationMs) &&
  event.durationMs >= 0 &&
  event.durationMs <= 60_000;

export class NoopHumanSessionTelemetry implements HumanSessionTelemetry {
  record(_event: HumanSessionTelemetryEvent): void {
    // Intentionally empty. Productive exporters require an explicit reviewed composition.
  }
}

export interface HumanSessionTelemetrySummary {
  count: number;
  successCount: number;
  deniedCount: number;
  unavailableCount: number;
  serverErrorCount: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return Number(sorted[index]!.toFixed(3));
};

export class InMemoryHumanSessionTelemetry implements HumanSessionTelemetry {
  readonly events: HumanSessionTelemetryEvent[] = [];

  record(event: HumanSessionTelemetryEvent): void {
    if (!validEvent(event)) throw new Error("Invalid human session telemetry event");
    const exactKeys = Object.keys(event).sort().join(",");
    if (exactKeys !== "durationMs,method,operation,outcome,statusCode") {
      throw new Error("Human session telemetry event contains unexpected fields");
    }
    this.events.push(Object.freeze({ ...event }));
  }

  summary(operation?: HumanSessionTelemetryOperation): HumanSessionTelemetrySummary {
    const events = operation
      ? this.events.filter((event) => event.operation === operation)
      : this.events;
    const durations = events.map((event) => event.durationMs);
    return Object.freeze({
      count: events.length,
      successCount: events.filter((event) => event.outcome === "success").length,
      deniedCount: events.filter((event) => event.outcome === "denied").length,
      unavailableCount: events.filter((event) => event.outcome === "unavailable").length,
      serverErrorCount: events.filter((event) => event.outcome === "server_error").length,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: durations.length === 0 ? 0 : Number(Math.max(...durations).toFixed(3)),
    });
  }
}
