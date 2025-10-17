/**
 * Rate Limiting Algorithm Validation Test Suite
 *
 * Tests all rate limiting algorithms against specification requirements.
 * Validates burst capacity, rate enforcement, recovery behavior, and edge cases.
 *
 * Run with: bun run backend/test-algorithms.ts
 */

import { test, expect, describe } from "bun:test";
import { TokenBucket } from "./src/rate-limiters/token-bucket";
import { LeakyBucket } from "./src/rate-limiters/leaky-bucket";
import type { RateLimiter } from "./src/types/rate-limiter.interface";

/**
 * Helper: Simulate delay for time-based testing
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper: Fire multiple requests and count results
 */
function fireRequests(limiter: RateLimiter, count: number): {
  allowed: number;
  rejected: number;
} {
  let allowed = 0;
  let rejected = 0;

  for (let i = 0; i < count; i++) {
    if (limiter.allow()) {
      allowed++;
    } else {
      rejected++;
    }
  }

  return { allowed, rejected };
}

// ============================================================================
// Test 1: Burst Capacity (Instant Load)
// ============================================================================

describe("Test 1: Burst Capacity at 10 RPS", () => {
  test("Token Bucket: allows 20/25 requests instantly", () => {
    const limiter = new TokenBucket(10);
    const result = fireRequests(limiter, 25);

    expect(result.allowed).toBe(20); // capacity = 10 × 2.0
    expect(result.rejected).toBe(5);
  });

  test("Leaky Bucket: allows 15/25 requests instantly", () => {
    const limiter = new LeakyBucket(10);
    const result = fireRequests(limiter, 25);

    expect(result.allowed).toBe(15); // capacity = 10 × 1.5
    expect(result.rejected).toBe(10);
  });
});

// ============================================================================
// Test 2: Rate Enforcement (Sustained Load)
// ============================================================================

describe("Test 2: Rate Enforcement at 10 RPS", () => {
  test(
    "Token Bucket: allows ~100/100 requests with 100ms delay",
    async () => {
      const limiter = new TokenBucket(10);
      let allowed = 0;
      let rejected = 0;

      for (let i = 0; i < 100; i++) {
        if (limiter.allow()) {
          allowed++;
        } else {
          rejected++;
        }
        await delay(100); // 100ms = 10 RPS
      }

      // Should allow most requests (some variance acceptable)
      expect(allowed).toBeGreaterThanOrEqual(95);
      expect(rejected).toBeLessThanOrEqual(5);
    },
    { timeout: 15000 }
  ); // 100 * 100ms = 10s + buffer

  test(
    "Leaky Bucket: allows ~100/100 requests with 100ms delay",
    async () => {
      const limiter = new LeakyBucket(10);
      let allowed = 0;
      let rejected = 0;

      for (let i = 0; i < 100; i++) {
        if (limiter.allow()) {
          allowed++;
        } else {
          rejected++;
        }
        await delay(100); // 100ms = 10 RPS
      }

      // Should allow most requests (some variance acceptable)
      expect(allowed).toBeGreaterThanOrEqual(95);
      expect(rejected).toBeLessThanOrEqual(5);
    },
    { timeout: 15000 }
  ); // 100 * 100ms = 10s + buffer
});

// ============================================================================
// Test 3: Recovery After Exhaustion
// ============================================================================

describe("Test 3: Recovery After Exhaustion at 10 RPS", () => {
  test("Token Bucket: refills 10 tokens in 1 second", async () => {
    const limiter = new TokenBucket(10);

    // Burst 1: exhaust bucket
    const burst1 = fireRequests(limiter, 25);
    expect(burst1.allowed).toBe(20);

    // Wait 1 second (should refill 10 tokens)
    await delay(1000);

    // Burst 2: should allow 10 more
    const burst2 = fireRequests(limiter, 15);
    expect(burst2.allowed).toBeGreaterThanOrEqual(9); // Allow for timing variance
    expect(burst2.allowed).toBeLessThanOrEqual(11);
  });

  test("Leaky Bucket: drains ~10 items in 1 second", async () => {
    const limiter = new LeakyBucket(10);

    // Burst 1: fill queue
    const burst1 = fireRequests(limiter, 25);
    expect(burst1.allowed).toBe(15);

    // Wait 1 second (should drain ~10 items)
    await delay(1000);

    // Burst 2: should allow ~10 more
    const burst2 = fireRequests(limiter, 15);
    expect(burst2.allowed).toBeGreaterThanOrEqual(9); // Allow for timing variance
    expect(burst2.allowed).toBeLessThanOrEqual(11);
  });
});

// ============================================================================
// Test 4: Full Recovery After Idle Period
// ============================================================================

describe("Test 4: Full Recovery at 10 RPS", () => {
  test("Token Bucket: fully refills to 20 tokens after 2 seconds", async () => {
    const limiter = new TokenBucket(10);

    // Burst 1: exhaust bucket
    const burst1 = fireRequests(limiter, 25);
    expect(burst1.allowed).toBe(20);

    // Wait 2 seconds (should fully refill to 20)
    await delay(2000);

    // Burst 2: should allow 20 again
    const burst2 = fireRequests(limiter, 25);
    expect(burst2.allowed).toBe(20);
    expect(burst2.rejected).toBe(5);
  });

  test("Leaky Bucket: fully drains queue after 2 seconds", async () => {
    const limiter = new LeakyBucket(10);

    // Burst 1: fill queue
    const burst1 = fireRequests(limiter, 25);
    expect(burst1.allowed).toBe(15);

    // Wait 2 seconds (should fully drain queue)
    await delay(2000);

    // Burst 2: should allow 15 again
    const burst2 = fireRequests(limiter, 25);
    expect(burst2.allowed).toBe(15);
    expect(burst2.rejected).toBe(10);
  });
});

// ============================================================================
// Test 5: Low Rate Configuration
// ============================================================================

describe("Test 5: Low Rate Configuration at 1 RPS", () => {
  test("Token Bucket: capacity = 2 tokens", () => {
    const limiter = new TokenBucket(1);
    const result = fireRequests(limiter, 5);

    expect(result.allowed).toBe(2); // capacity = 1 × 2.0
    expect(result.rejected).toBe(3);
  });

  test("Leaky Bucket: capacity = 1 slot", () => {
    const limiter = new LeakyBucket(1);
    const result = fireRequests(limiter, 5);

    expect(result.allowed).toBe(1); // capacity = floor(1 × 1.5) = 1
    expect(result.rejected).toBe(4);
  });
});

// ============================================================================
// Test 6: High Rate Configuration
// ============================================================================

describe("Test 6: High Rate Configuration at 100 RPS", () => {
  test("Token Bucket: capacity = 200 tokens", () => {
    const limiter = new TokenBucket(100);
    const result = fireRequests(limiter, 500);

    expect(result.allowed).toBe(200); // capacity = 100 × 2.0
    expect(result.rejected).toBe(300);
  });

  test("Leaky Bucket: capacity = 150 slots", () => {
    const limiter = new LeakyBucket(100);
    const result = fireRequests(limiter, 500);

    expect(result.allowed).toBe(150); // capacity = 100 × 1.5
    expect(result.rejected).toBe(350);
  });
});

// ============================================================================
// Test 7: Reset Functionality
// ============================================================================

describe("Test 7: Reset Functionality", () => {
  test("Token Bucket: reset refills to capacity", () => {
    const limiter = new TokenBucket(10);

    // Exhaust bucket
    fireRequests(limiter, 25);

    // Reset should refill to capacity
    limiter.reset();
    const result = fireRequests(limiter, 25);

    expect(result.allowed).toBe(20);
    expect(result.rejected).toBe(5);
  });

  test("Leaky Bucket: reset clears queue", () => {
    const limiter = new LeakyBucket(10);

    // Fill queue
    fireRequests(limiter, 25);

    // Reset should clear queue
    limiter.reset();
    const result = fireRequests(limiter, 25);

    expect(result.allowed).toBe(15);
    expect(result.rejected).toBe(10);
  });
});

// ============================================================================
// Test 8: getStats() Accuracy
// ============================================================================

describe("Test 8: getStats() Accuracy", () => {
  test("Token Bucket: reports accurate remaining tokens", () => {
    const limiter = new TokenBucket(10);

    // Initial stats
    let stats = limiter.getStats();
    expect(stats.remaining).toBe(20); // Full capacity

    // Consume 5 tokens
    fireRequests(limiter, 5);
    stats = limiter.getStats();
    expect(stats.remaining).toBe(15);

    // Consume all remaining
    fireRequests(limiter, 15);
    stats = limiter.getStats();
    expect(stats.remaining).toBe(0);
  });

  test("Leaky Bucket: reports accurate remaining capacity", () => {
    const limiter = new LeakyBucket(10);

    // Initial stats
    let stats = limiter.getStats();
    expect(stats.remaining).toBe(15); // Empty queue = full capacity

    // Add 5 items
    fireRequests(limiter, 5);
    stats = limiter.getStats();
    expect(stats.remaining).toBe(10); // 15 - 5 = 10

    // Fill queue
    fireRequests(limiter, 10);
    stats = limiter.getStats();
    expect(stats.remaining).toBe(0); // Queue full
  });

  test("Stats include valid resetAt timestamp", () => {
    const tokenBucket = new TokenBucket(10);
    const leakyBucket = new LeakyBucket(10);

    const tbStats = tokenBucket.getStats();
    const lbStats = leakyBucket.getStats();

    // resetAt should be a future timestamp
    expect(tbStats.resetAt).toBeGreaterThan(Date.now() - 1000);
    expect(lbStats.resetAt).toBeGreaterThan(Date.now() - 1000);
  });
});

// ============================================================================
// Summary
// ============================================================================

console.log("\n✅ All validation tests defined");
console.log("Run with: bun test backend/test-algorithms.ts");
