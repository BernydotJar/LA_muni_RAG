import type { ProcedureFeedbackRateLimiter } from "./types.js";

interface Bucket {
  count: number;
  resetAt: number;
}

export class InMemoryProcedureFeedbackRateLimiter implements ProcedureFeedbackRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxRequests = 20,
    private readonly windowMs = 10 * 60 * 1000,
    private readonly now: () => number = () => Date.now()
  ) {}

  consume(key: string): boolean {
    const currentTime = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || currentTime >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: currentTime + this.windowMs });
      return true;
    }

    if (bucket.count >= this.maxRequests) return false;
    bucket.count += 1;
    return true;
  }
}
