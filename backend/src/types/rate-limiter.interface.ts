/**
 * RateLimiter Interface
 *
 * Common contract for all rate limiting algorithm implementations.
 * Each implementation must provide methods to:
 * - Check if a request should be allowed
 * - Reset internal state to initial conditions
 * - Retrieve current capacity statistics
 */
export interface RateLimiter {
  /**
   * Evaluates whether the current request should be allowed.
   *
   * @returns true if request is allowed, false if rate limited
   */
  allow(): boolean;

  /**
   * Resets the rate limiter to its initial state.
   * Clears all accumulated state (tokens, queue, timestamps).
   */
  reset(): void;

  /**
   * Returns current rate limiter statistics.
   *
   * @returns Object containing:
   *   - remaining: Available capacity (tokens for Token Bucket, queue slots for Leaky Bucket)
   *   - resetAt: Unix timestamp (milliseconds) when limiter resets or next processes requests
   */
  getStats(): { remaining: number; resetAt: number };
}
