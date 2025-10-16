import {
  LEAKY_BUCKET_QUEUE_MULTIPLIER,
  LEAKY_BUCKET_DRAIN_INTERVAL_MS,
} from "../constants.ts";
import type { RateLimiter } from "../types/rate-limiter.interface.ts";

/**
 * Leaky Bucket Rate Limiter
 * Requests are added to a queue (bucket) and processed at a fixed rate (leak rate).
 * If queue is full, requests are rejected.
 * Provides smooth, predictable output rate.
 */
export class LeakyBucket implements RateLimiter {
  private queueCount: number;
  private queueCapacity: number;
  private rps: number;
  private lastDrain: number;
  private resetAt: number;

  constructor(rps: number) {
    this.rps = rps;
    this.queueCapacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.queueCount = 0;
    this.lastDrain = Date.now();
    this.resetAt = this.lastDrain + 1000;
  }

  allow(): boolean {
    this.drain();

    if (this.queueCount < this.queueCapacity) {
      this.queueCount++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.queueCount = 0;
    this.lastDrain = Date.now();
    this.resetAt = this.lastDrain + 1000;
  }

  getStats(): { remaining: number; resetAt: number } {
    this.drain();
    return {
      remaining: this.queueCapacity - this.queueCount,
      resetAt: this.resetAt,
    };
  }

  private drain(): void {
    const now = Date.now();
    const timeSinceDrain = now - this.lastDrain;

    // Calculate intervals elapsed since last drain
    // CRITICAL: Align to interval boundaries to prevent timing drift
    const intervalsElapsed = Math.floor(
      timeSinceDrain / LEAKY_BUCKET_DRAIN_INTERVAL_MS
    );

    if (intervalsElapsed > 0) {
      // Calculate items to drain based on elapsed intervals
      // drain rate = (rps * DRAIN_INTERVAL_MS / 1000)
      const itemsToDrain = Math.min(
        this.queueCount,
        (this.rps * intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS) / 1000
      );
      this.queueCount -= itemsToDrain;

      // CRITICAL: Update lastDrain to aligned timestamp to prevent drift
      this.lastDrain =
        this.lastDrain + intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS;

      // Update resetAt timestamp
      this.resetAt = this.lastDrain + 1000;
    }
  }
}
