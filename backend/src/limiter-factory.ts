import { RateLimiter } from "./types/rate-limiter.interface";
import { TokenBucket } from "./rate-limiters/token-bucket";
import { LeakyBucket } from "./rate-limiters/leaky-bucket";

export type AlgorithmType = "token-bucket" | "leaky-bucket";

export class LimiterFactory {
  static create(algorithm: AlgorithmType, rps: number): RateLimiter {
    switch (algorithm) {
      case "token-bucket":
        return new TokenBucket(rps);
      case "leaky-bucket":
        return new LeakyBucket(rps);
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }
}