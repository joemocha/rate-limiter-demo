import type { RateLimiter } from "../types/rate-limiter.interface";
import {
  TOKEN_BUCKET_BURST_MULTIPLIER,
  TOKEN_BUCKET_REFILL_INTERVAL_MS,
} from "../constants";

/**
 * Token Bucket Rate Limiter
 *
 * Maintains a bucket with a maximum capacity of tokens. Tokens are added at a
 * fixed rate (refill). Each request consumes one token. Allows bursts up to
 * bucket capacity.
 *
 * Characteristics:
 * - Burst tolerance: High (permits `capacity` requests instantly)
 * - Initial state: Full (starts with capacity tokens)
 * - Memory: O(1) - stores token count and last refill timestamp
 * - CPU: O(1) per request
 *
 * Use case: Systems that tolerate controlled bursts but enforce long-term average rate.
 */
export class TokenBucket implements RateLimiter {
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per interval
  private tokens: number;
  private lastRefill: number;

  /**
   * Creates a new Token Bucket rate limiter.
   *
   * @param rps - Requests per second to allow
   */
  constructor(private readonly rps: number) {
    // Calculate capacity based on burst multiplier
    this.capacity = Math.floor(rps * TOKEN_BUCKET_BURST_MULTIPLIER);

    // Calculate how many tokens to add per refill interval
    // Example: 10 RPS with 100ms interval = 1 token per interval
    this.refillRate = (rps * TOKEN_BUCKET_REFILL_INTERVAL_MS) / 1000;

    // Start with full bucket (high burst tolerance)
    this.tokens = this.capacity;

    // Initialize last refill to current time aligned to interval boundary
    const now = Date.now();
    this.lastRefill =
      Math.floor(now / TOKEN_BUCKET_REFILL_INTERVAL_MS) *
      TOKEN_BUCKET_REFILL_INTERVAL_MS;
  }

  /**
   * Checks if a request should be allowed.
   *
   * Refills tokens based on elapsed time, then attempts to consume one token.
   *
   * @returns true if request is allowed (token consumed), false if rate limited
   */
  allow(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Refills tokens based on elapsed time since last refill.
   *
   * Uses interval-aligned timestamps to prevent timing drift.
   * This is CRITICAL for consistent behavior under sustained load.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed < TOKEN_BUCKET_REFILL_INTERVAL_MS) {
      // Not enough time has passed for a refill
      return;
    }

    // Calculate how many complete intervals have elapsed
    const intervalsElapsed = Math.floor(
      elapsed / TOKEN_BUCKET_REFILL_INTERVAL_MS
    );

    // Add tokens for each elapsed interval
    const tokensToAdd = intervalsElapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

    // CRITICAL: Use interval-aligned timestamp to prevent drift
    // CORRECT: this.lastRefill = this.lastRefill + (intervalsElapsed * INTERVAL_MS)
    // WRONG: this.lastRefill = now (accumulates timing errors)
    this.lastRefill =
      this.lastRefill + intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS;
  }

  /**
   * Resets the rate limiter to initial state.
   *
   * Refills bucket to capacity and resets timestamp.
   */
  reset(): void {
    this.tokens = this.capacity;
    const now = Date.now();
    this.lastRefill =
      Math.floor(now / TOKEN_BUCKET_REFILL_INTERVAL_MS) *
      TOKEN_BUCKET_REFILL_INTERVAL_MS;
  }

  /**
   * Returns current rate limiter statistics.
   *
   * @returns Object with remaining tokens and next reset time
   */
  getStats(): { remaining: number; resetAt: number } {
    this.refill(); // Ensure tokens are up-to-date

    return {
      remaining: Math.floor(this.tokens),
      resetAt: this.lastRefill + TOKEN_BUCKET_REFILL_INTERVAL_MS,
    };
  }
}
