import { describe, test, expect, beforeEach } from "bun:test";
import { TokenBucket } from "./src/rate-limiters/token-bucket";
import { LeakyBucket } from "./src/rate-limiters/leaky-bucket";

describe("Token Bucket Algorithm", () => {
  let limiter: TokenBucket;

  beforeEach(() => {
    limiter = new TokenBucket(10);
  });

  test("Test 1: Burst Capacity - allows 20/25 requests at 10 RPS", () => {
    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(20);
  });

  test("Test 3: Recovery After Exhaustion", async () => {
    // Exhaust tokens
    for (let i = 0; i < 25; i++) limiter.allow();

    // Wait 1 second for refill
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should allow ~10 more
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBeGreaterThanOrEqual(9);
    expect(allowed).toBeLessThanOrEqual(11);
  });

  test("Test 4: Full Recovery After Idle Period", async () => {
    // Exhaust tokens
    let firstBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) firstBurstAllowed++;
    }
    expect(firstBurstAllowed).toBe(20);

    // Wait 2 seconds for full refill
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should allow 20 more
    let secondBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) secondBurstAllowed++;
    }
    expect(secondBurstAllowed).toBe(20);
  });

  test("Test 5: Low Rate Configuration", () => {
    limiter = new TokenBucket(1);
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(2);
  });

  test("Test 6: High Rate Configuration", () => {
    limiter = new TokenBucket(100);
    let allowed = 0;
    for (let i = 0; i < 500; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(200);
  });

  test("Reset functionality", () => {
    // Exhaust tokens
    for (let i = 0; i < 25; i++) limiter.allow();

    // Reset
    limiter.reset();

    // Should allow 20 again
    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(20);
  });

  test("getStats returns correct information", () => {
    const stats = limiter.getStats();
    expect(stats.remaining).toBe(20); // Full capacity at start
    expect(stats.resetAt).toBeGreaterThan(Date.now());

    // Use some tokens
    limiter.allow();
    limiter.allow();

    const stats2 = limiter.getStats();
    expect(stats2.remaining).toBe(18);
  });
});

describe("Leaky Bucket Algorithm", () => {
  let limiter: LeakyBucket;

  beforeEach(() => {
    limiter = new LeakyBucket(10);
  });

  test("Test 1: Burst Capacity - allows 15/25 requests at 10 RPS", () => {
    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(15);
  });

  test("Test 3: Recovery After Exhaustion", async () => {
    // Fill queue
    for (let i = 0; i < 25; i++) limiter.allow();

    // Wait 1 second for drain
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should allow ~10 more
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBeGreaterThanOrEqual(9);
    expect(allowed).toBeLessThanOrEqual(11);
  });

  test("Test 4: Full Recovery After Idle Period", async () => {
    // Fill queue
    let firstBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) firstBurstAllowed++;
    }
    expect(firstBurstAllowed).toBe(15);

    // Wait 2 seconds for full drain
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should allow 15 more
    let secondBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) secondBurstAllowed++;
    }
    expect(secondBurstAllowed).toBe(15);
  });

  test("Test 5: Low Rate Configuration", () => {
    limiter = new LeakyBucket(1);
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(1); // 1 * 1.5 = 1.5 rounded down to 1
  });

  test("Test 6: High Rate Configuration", () => {
    limiter = new LeakyBucket(100);
    let allowed = 0;
    for (let i = 0; i < 500; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(150);
  });

  test("Reset functionality", () => {
    // Fill queue
    for (let i = 0; i < 25; i++) limiter.allow();

    // Reset
    limiter.reset();

    // Should allow 15 again
    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(15);
  });

  test("getStats returns correct information", () => {
    const stats = limiter.getStats();
    expect(stats.remaining).toBe(15); // Full capacity at start
    expect(stats.resetAt).toBeGreaterThan(Date.now());

    // Fill some queue
    limiter.allow();
    limiter.allow();

    const stats2 = limiter.getStats();
    expect(stats2.remaining).toBe(13);
  });
});