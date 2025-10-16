import { RateLimiter } from "../types/rate-limiter.interface";
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from "../constants";

export class TokenBucket implements RateLimiter {
  private tokens: number;
  private capacity: number;
  private lastRefill: number;
  private refillRate: number;

  constructor(private rps: number) {
    this.capacity = Math.floor(rps * TOKEN_BUCKET_BURST_MULTIPLIER);
    this.tokens = this.capacity; // Start full
    this.lastRefill = Date.now();
    this.refillRate = rps;
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
  }

  getStats(): { remaining: number; resetAt: number } {
    this.refill();
    return {
      remaining: Math.floor(this.tokens),
      resetAt: this.lastRefill + TOKEN_BUCKET_REFILL_INTERVAL_MS
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / TOKEN_BUCKET_REFILL_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      const tokensToAdd = (this.refillRate / 1000) * (intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS);
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now; // Fix: Set to current time instead of accumulating
    }
  }
}