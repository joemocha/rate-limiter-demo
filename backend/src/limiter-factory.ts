import type { RateLimiter } from "./types/rate-limiter.interface.ts";
import { TokenBucket } from "./rate-limiters/token-bucket.ts";
import { LeakyBucket } from "./rate-limiters/leaky-bucket.ts";

export type AlgorithmName = "token-bucket" | "leaky-bucket";

/**
 * Factory function to create rate limiter instances
 * @param algorithm Name of the algorithm
 * @param rps Requests per second
 * @returns RateLimiter instance or null if algorithm not found
 */
export function createLimiter(
  algorithm: string,
  rps: number
): RateLimiter | null {
  switch (algorithm.toLowerCase()) {
    case "token-bucket":
      return new TokenBucket(rps);
    case "leaky-bucket":
      return new LeakyBucket(rps);
    default:
      return null;
  }
}

/**
 * Get list of available algorithms
 */
export function getAvailableAlgorithms(): AlgorithmName[] {
  return ["token-bucket", "leaky-bucket"];
}

/**
 * Validate if algorithm is available
 */
export function isValidAlgorithm(algorithm: string): boolean {
  return getAvailableAlgorithms().includes(
    algorithm.toLowerCase() as AlgorithmName
  );
}
