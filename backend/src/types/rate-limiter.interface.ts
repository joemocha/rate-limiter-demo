/**
 * Common interface for all rate limiting algorithms
 */
export interface RateLimiter {
  /**
   * Check if a request is allowed
   * @returns true if request is allowed, false if rate limited
   */
  allow(): boolean;

  /**
   * Reset the rate limiter to its initial state
   */
  reset(): void;

  /**
   * Get current statistics
   * @returns object with remaining capacity and reset timestamp
   */
  getStats(): { remaining: number; resetAt: number };
}
