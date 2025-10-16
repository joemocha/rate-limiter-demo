import type { RateLimiter } from "../types/rate-limiter.interface";
import { FIXED_WINDOW_SIZE_MS } from "../constants";

export class FixedWindow implements RateLimiter {
  private readonly rps: number;
  private readonly maxRequests: number;
  private windowStart: number;
  private requestCount: number;

  constructor(rps: number) {
    this.rps = rps;
    // Calculate max requests based on window size
    this.maxRequests = Math.floor(rps * (FIXED_WINDOW_SIZE_MS / 1000));
    this.windowStart = this.getCurrentWindowStart();
    this.requestCount = 0;
  }

  private getCurrentWindowStart(): number {
    const now = Date.now();
    return Math.floor(now / FIXED_WINDOW_SIZE_MS) * FIXED_WINDOW_SIZE_MS;
  }

  private checkAndResetWindow(): void {
    const currentWindowStart = this.getCurrentWindowStart();

    // If we've moved to a new window, reset the counter
    if (currentWindowStart > this.windowStart) {
      this.windowStart = currentWindowStart;
      this.requestCount = 0;
    }
  }

  allow(): boolean {
    this.checkAndResetWindow();

    if (this.requestCount < this.maxRequests) {
      this.requestCount++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.windowStart = this.getCurrentWindowStart();
    this.requestCount = 0;
  }

  getStats(): { remaining: number; resetAt: number } {
    this.checkAndResetWindow();

    const remaining = Math.max(0, this.maxRequests - this.requestCount);
    const resetAt = this.windowStart + FIXED_WINDOW_SIZE_MS;

    return { remaining, resetAt };
  }
}