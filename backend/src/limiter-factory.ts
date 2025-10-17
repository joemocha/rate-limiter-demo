import type { RateLimiter } from "./types/rate-limiter.interface";
import { TokenBucket } from "./rate-limiters/token-bucket";
import { LeakyBucket } from "./rate-limiters/leaky-bucket";

/**
 * Algorithm types supported by the rate limiter factory
 */
export type AlgorithmType = "token-bucket" | "leaky-bucket";

/**
 * Rate Limiter Factory
 *
 * Creates rate limiter instances based on algorithm type.
 * Provides centralized instantiation logic for all rate limiting algorithms.
 */
export class LimiterFactory {
  /**
   * Creates a rate limiter instance for the specified algorithm.
   *
   * @param algorithm - The rate limiting algorithm to use
   * @param rps - Requests per second to allow
   * @returns A configured RateLimiter instance
   * @throws Error if algorithm type is not supported
   */
  static create(algorithm: AlgorithmType, rps: number): RateLimiter {
    switch (algorithm) {
      case "token-bucket":
        return new TokenBucket(rps);

      case "leaky-bucket":
        return new LeakyBucket(rps);

      default:
        throw new Error(
          `Unsupported algorithm: ${algorithm}. Supported: token-bucket, leaky-bucket`
        );
    }
  }

  /**
   * Validates whether an algorithm type is supported.
   *
   * @param algorithm - The algorithm name to validate
   * @returns true if supported, false otherwise
   */
  static isSupported(algorithm: string): algorithm is AlgorithmType {
    return algorithm === "token-bucket" || algorithm === "leaky-bucket";
  }
}
