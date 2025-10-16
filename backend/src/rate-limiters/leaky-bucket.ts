import { RateLimiter } from "../types/rate-limiter.interface";
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from "../constants";

export class LeakyBucket implements RateLimiter {
  private queueCount: number = 0;
  private queueCapacity: number;
  private lastDrain: number;
  private drainRate: number;

  constructor(private rps: number) {
    this.queueCapacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.lastDrain = Date.now();
    this.drainRate = rps;
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
  }

  getStats(): { remaining: number; resetAt: number } {
    this.drain();
    return {
      remaining: this.queueCapacity - this.queueCount,
      resetAt: this.lastDrain + LEAKY_BUCKET_DRAIN_INTERVAL_MS
    };
  }

  private drain(): void {
    const now = Date.now();
    const elapsed = now - this.lastDrain;
    const intervalsElapsed = Math.floor(elapsed / LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      const itemsToDrain = Math.floor((this.drainRate / 1000) * (intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS));
      this.queueCount = Math.max(0, this.queueCount - itemsToDrain);
      this.lastDrain = now; // Fix: Set to current time instead of accumulating
    }
  }
}