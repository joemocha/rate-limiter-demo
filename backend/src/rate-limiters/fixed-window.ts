import { RateLimiter } from "../types/rate-limiter.interface";
import { FIXED_WINDOW_SIZE_MS } from "../constants";

export class FixedWindow implements RateLimiter {
  private windowStart: number;
  private count: number;

  constructor(private rps: number) {
    this.windowStart = Date.now();
    this.count = 0;
  }

  allow(): boolean {
    const now = Date.now();

    // Check if we've moved to a new window
    if (now >= this.windowStart + FIXED_WINDOW_SIZE_MS) {
      this.windowStart = Math.floor(now / FIXED_WINDOW_SIZE_MS) * FIXED_WINDOW_SIZE_MS;
      this.count = 0;
    }

    // Check if we can allow this request
    if (this.count < this.rps) {
      this.count++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.count = 0;
    this.windowStart = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    const now = Date.now();

    // Update window if needed
    if (now >= this.windowStart + FIXED_WINDOW_SIZE_MS) {
      this.windowStart = Math.floor(now / FIXED_WINDOW_SIZE_MS) * FIXED_WINDOW_SIZE_MS;
      this.count = 0;
    }

    return {
      remaining: Math.max(0, this.rps - this.count),
      resetAt: this.windowStart + FIXED_WINDOW_SIZE_MS
    };
  }
}