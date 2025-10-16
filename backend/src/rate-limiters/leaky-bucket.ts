import { RateLimiter } from '../types/rate-limiter.interface';
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from '../constants';

export class LeakyBucket implements RateLimiter {
  private queueCount: number = 0;
  private lastDrain: number;
  private queueCapacity: number;

  constructor(private rps: number) {
    this.queueCapacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.lastDrain = Date.now();
  }

  allow(): boolean {
    this.drain();

    if (this.queueCount < this.queueCapacity) {
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
    this.drain();
    return {
      remaining: this.queueCapacity - this.queueCount,
      resetAt: this.lastDrain + LEAKY_BUCKET_DRAIN_INTERVAL_MS
    };
  }

  private drain(): void {
    const now = Date.now();
    const timePassed = now - this.lastDrain;
    const intervalsElapsed = Math.floor(timePassed / LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      // Remove items: (rps / 1000) * interval_ms * intervals_count
      // Simplified: (rps / 20) items per interval (since interval = 50ms = 0.05s)
      const itemsToDrain = (this.rps / 20) * intervalsElapsed;
      this.queueCount = Math.max(0, this.queueCount - itemsToDrain);

      // Align timestamp to interval boundary (prevents drift)
      this.lastDrain = this.lastDrain + (intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS);
    }
  }
}
