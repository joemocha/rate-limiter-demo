export interface RateLimiter {
  allow(): boolean;
  reset(): void;
  getStats(): { remaining: number; resetAt: number };
}