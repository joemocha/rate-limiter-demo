import { RateLimiter } from "./types/rate-limiter.interface";
import { TokenBucket } from "./rate-limiters/token-bucket";
import { LeakyBucket } from "./rate-limiters/leaky-bucket";
import { FixedWindow } from "./rate-limiters/fixed-window";
import { SlidingWindow } from "./rate-limiters/sliding-window";
import { SlidingLog } from "./rate-limiters/sliding-log";

export type AlgorithmType = "token-bucket" | "leaky-bucket" | "fixed-window" | "sliding-window" | "sliding-log";

export class LimiterFactory {
  static create(algorithm: AlgorithmType, rps: number): RateLimiter {
    switch (algorithm) {
      case "token-bucket":
        return new TokenBucket(rps);
      case "leaky-bucket":
        return new LeakyBucket(rps);
      case "fixed-window":
        return new FixedWindow(rps);
      case "sliding-window":
        return new SlidingWindow(rps);
      case "sliding-log":
        return new SlidingLog(rps);
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }
}