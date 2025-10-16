import type { RateLimiter } from "../types/rate-limiter.interface";
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from "../constants";

export class TokenBucket implements RateLimiter {
  private readonly capacity: number;
  private readonly rps: number;
  private readonly tokensPerInterval: number;
  private tokens: number;
  private lastRefill: number;

  constructor(rps: number) {
    this.rps = rps;
    this.capacity = Math.floor(rps * TOKEN_BUCKET_BURST_MULTIPLIER);
    this.tokensPerInterval = (rps * TOKEN_BUCKET_REFILL_INTERVAL_MS) / 1000;
    this.tokens = this.capacity; // Start FULL
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervals = Math.floor(elapsed / TOKEN_BUCKET_REFILL_INTERVAL_MS);

    if (intervals > 0) {
      const tokensToAdd = intervals * this.tokensPerInterval;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

      // Align to interval boundaries to prevent timing drift
      // Example: if 250ms elapsed with 100ms intervals, advance by 200ms not 250ms
      this.lastRefill = this.lastRefill + (intervals * TOKEN_BUCKET_REFILL_INTERVAL_MS);
    }
  }

  allow(): boolean {
    this.refill(); // Lazy evaluation

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    this.refill(); // Ensure stats are current

    const remaining = Math.floor(this.tokens);

    // Calculate when bucket will be full again
    const tokensNeeded = this.capacity - this.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.tokensPerInterval);
    const resetAt = this.lastRefill + (intervalsNeeded * TOKEN_BUCKET_REFILL_INTERVAL_MS);

    return { remaining, resetAt };
  }
}
