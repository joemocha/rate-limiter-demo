import { RateLimiter } from "../types/rate-limiter.interface";
import { SLIDING_LOG_WINDOW_MS, SLIDING_LOG_MAX_ENTRIES } from "../constants";

export class SlidingLog implements RateLimiter {
  private log: number[]; // Array of timestamps

  constructor(private rps: number) {
    this.log = [];
  }

  allow(): boolean {
    const now = Date.now();

    // Remove expired entries
    this.cleanExpiredEntries(now);

    // Enforce max entries limit BEFORE adding to prevent exceeding bound
    // This protects against memory exhaustion in high-load scenarios
    if (this.log.length >= SLIDING_LOG_MAX_ENTRIES) {
      return false;
    }

    // Check if we can allow this request
    if (this.log.length < this.rps) {
      this.log.push(now);
      return true;
    }

    return false;
  }

  reset(): void {
    this.log = [];
  }

  getStats(): { remaining: number; resetAt: number } {
    const now = Date.now();
    this.cleanExpiredEntries(now);

    const remaining = Math.max(0, this.rps - this.log.length);
    const resetAt = this.log.length > 0
      ? this.log[0] + SLIDING_LOG_WINDOW_MS
      : now + SLIDING_LOG_WINDOW_MS;

    return { remaining, resetAt };
  }

  private cleanExpiredEntries(now: number): void {
    const windowStart = now - SLIDING_LOG_WINDOW_MS;

    // Remove all entries older than the window
    while (this.log.length > 0 && this.log[0] < windowStart) {
      this.log.shift();
    }
  }
}