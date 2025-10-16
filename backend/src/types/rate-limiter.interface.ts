export interface RateLimiter {
  allow(): boolean;                       // Returns boolean (true = allow, false = reject)
  reset(): void;                          // Clear internal state
  getStats(): { remaining: number; resetAt: number }; // Returns { remaining, resetAt }
}
