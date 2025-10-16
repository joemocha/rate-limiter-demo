import {
  TOKEN_BUCKET_BURST_MULTIPLIER,
  TOKEN_BUCKET_REFILL_INTERVAL_MS,
} from "../constants.ts";
import type { RateLimiter } from "../types/rate-limiter.interface.ts";

/**
 * Token Bucket Rate Limiter
 * Maintains a bucket with maximum capacity of tokens.
 * Tokens are added at a fixed rate (refill).
 * Each request consumes one token.
 * Allows bursts up to bucket capacity.
 */
export class TokenBucket implements RateLimiter {
  private tokens: number;
  private capacity: number;
  private rps: number;
  private lastRefill: number;
  private readonly refillRate: number; // tokens per ms
  private resetAt: number;

  constructor(rps: number) {
    this.rps = rps;
    this.capacity = Math.ceil(rps * TOKEN_BUCKET_BURST_MULTIPLIER);
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.refillRate = rps / 1000; // convert rps to tokens per ms
    this.resetAt = this.lastRefill + 1000;
  }

  allow(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    return false;
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.resetAt = this.lastRefill + 1000;
  }

  getStats(): { remaining: number; resetAt: number } {
    this.refill();
    return {
      remaining: Math.floor(this.tokens),
      resetAt: this.resetAt,
    };
  }

  private refill(): void {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefill;

    // Calculate intervals elapsed since last refill
    // CRITICAL: Align to interval boundaries to prevent timing drift
    const intervalsElapsed = Math.floor(
      timeSinceLastRefill / TOKEN_BUCKET_REFILL_INTERVAL_MS
    );

    if (intervalsElapsed > 0) {
      // Calculate tokens to add based on elapsed intervals
      // tokens per interval = (rps * REFILL_INTERVAL_MS / 1000)
      const tokensToAdd =
        (this.rps * intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS) / 1000;
      this.tokens = Math.min(this.tokens + tokensToAdd, this.capacity);

      // CRITICAL: Update lastRefill to aligned timestamp to prevent drift
      this.lastRefill =
        this.lastRefill + intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS;

      // Update resetAt timestamp
      this.resetAt = this.lastRefill + 1000;
    }
  }
}
