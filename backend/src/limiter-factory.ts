import { RateLimiter } from './types/rate-limiter.interface';
import { TokenBucket } from './rate-limiters/token-bucket';
import { LeakyBucket } from './rate-limiters/leaky-bucket';

export function createLimiter(algorithm: string, rps: number): RateLimiter {
  switch (algorithm) {
    case 'token-bucket':
      return new TokenBucket(rps);
    case 'leaky-bucket':
      return new LeakyBucket(rps);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}
