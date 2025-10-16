import type { RateLimiter } from "./types/rate-limiter.interface";
import { TokenBucket } from "./rate-limiters/token-bucket";
import { LeakyBucket } from "./rate-limiters/leaky-bucket";
import { FixedWindow } from "./rate-limiters/fixed-window";
import { SlidingWindow } from "./rate-limiters/sliding-window";
import { SlidingLog } from "./rate-limiters/sliding-log";

export type AlgorithmType =
  | "token-bucket"
  | "leaky-bucket"
  | "fixed-window"
  | "sliding-window"
  | "sliding-log";

export function createRateLimiter(algorithm: AlgorithmType, rps: number): RateLimiter {
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

export function isValidAlgorithm(algorithm: string): algorithm is AlgorithmType {
  return [
    "token-bucket",
    "leaky-bucket",
    "fixed-window",
    "sliding-window",
    "sliding-log"
  ].includes(algorithm);
}
