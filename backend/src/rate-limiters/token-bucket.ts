import { RateLimiter } from '../types/rate-limiter.interface';
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from '../constants';

export class TokenBucket implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;

  constructor(private rps: number) {
    this.capacity = rps * TOKEN_BUCKET_BURST_MULTIPLIER;
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  allow(): boolean {
    this.refill();

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
    this.refill();
    return {
      remaining: Math.floor(this.tokens),
      resetAt: this.lastRefill + TOKEN_BUCKET_REFILL_INTERVAL_MS
    };
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / TOKEN_BUCKET_REFILL_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      // Add tokens: (rps / 1000) * interval_ms * intervals_count
      // Simplified: (rps / 10) tokens per interval (since interval = 100ms = 0.1s)
      const tokensToAdd = (this.rps / 10) * intervalsElapsed;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

      // Align timestamp to interval boundary (prevents drift)
      this.lastRefill = this.lastRefill + (intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS);
    }
  }
}
