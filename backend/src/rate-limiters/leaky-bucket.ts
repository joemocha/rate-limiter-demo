import type { RateLimiter } from "../types/rate-limiter.interface";
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from "../constants";

export class LeakyBucket implements RateLimiter {
  private readonly capacity: number;
  private readonly rps: number;
  private readonly itemsPerInterval: number;
  private queueCount: number;
  private lastDrain: number;

  constructor(rps: number) {
    this.rps = rps;
    this.capacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.itemsPerInterval = (rps * LEAKY_BUCKET_DRAIN_INTERVAL_MS) / 1000;
    this.queueCount = 0; // Start EMPTY
    this.lastDrain = Date.now();
  }

  private drain(): void {
    const now = Date.now();
    const elapsed = now - this.lastDrain;
    const intervals = Math.floor(elapsed / LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    if (intervals > 0) {
      const itemsToDrain = intervals * this.itemsPerInterval;
      this.queueCount = Math.max(0, this.queueCount - itemsToDrain);
      this.lastDrain = now;
    }
  }

  allow(): boolean {
    this.drain(); // Lazy evaluation - process queue first

    if (this.queueCount < this.capacity) {
      this.queueCount += 1;
      return true;
    }

    return false;
  }

  reset(): void {
    this.queueCount = 0;
    this.lastDrain = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    this.drain(); // Ensure stats are current

    const remaining = Math.floor(this.capacity - this.queueCount);

    // Calculate when queue will be empty
    const intervalsNeeded = Math.ceil(this.queueCount / this.itemsPerInterval);
    const resetAt = this.lastDrain + (intervalsNeeded * LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    return { remaining, resetAt };
  }
}
