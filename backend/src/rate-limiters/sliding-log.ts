import type { RateLimiter } from "../types/rate-limiter.interface";
import { SLIDING_LOG_WINDOW_MS, SLIDING_LOG_MAX_ENTRIES } from "../constants";

export class SlidingLog implements RateLimiter {
  private readonly rps: number;
  private readonly maxRequests: number;
  private timestamps: number[];

  constructor(rps: number) {
    this.rps = rps;
    this.maxRequests = Math.floor(rps * (SLIDING_LOG_WINDOW_MS / 1000));
    this.timestamps = [];
  }

  private cleanExpiredTimestamps(): void {
    const now = Date.now();
    const cutoff = now - SLIDING_LOG_WINDOW_MS;

    // Binary search to find the first timestamp that's not expired
    let left = 0;
    let right = this.timestamps.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.timestamps[mid] <= cutoff) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Remove all expired timestamps
    if (left > 0) {
      this.timestamps = this.timestamps.slice(left);
    }

    // Prevent memory leak by capping the array size
    if (this.timestamps.length > SLIDING_LOG_MAX_ENTRIES) {
      // Keep only the most recent entries
      this.timestamps = this.timestamps.slice(-SLIDING_LOG_MAX_ENTRIES);
    }
  }

  allow(): boolean {
    const now = Date.now();
    this.cleanExpiredTimestamps();

    // Check if we're under the limit
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return true;
    }

    return false;
  }

  reset(): void {
    this.timestamps = [];
  }

  getStats(): { remaining: number; resetAt: number } {
    const now = Date.now();
    this.cleanExpiredTimestamps();

    const remaining = Math.max(0, this.maxRequests - this.timestamps.length);

    // Calculate when the oldest request will expire
    let resetAt = now + SLIDING_LOG_WINDOW_MS;
    if (this.timestamps.length > 0) {
      // The next reset happens when the oldest timestamp expires
      resetAt = this.timestamps[0] + SLIDING_LOG_WINDOW_MS;
    }

    return { remaining, resetAt };
  }
}