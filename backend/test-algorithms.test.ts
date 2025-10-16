import { describe, test, expect, beforeEach } from "bun:test";
import { TokenBucket } from "./src/rate-limiters/token-bucket";
import { LeakyBucket } from "./src/rate-limiters/leaky-bucket";
import { FixedWindow } from "./src/rate-limiters/fixed-window";
import { SlidingWindow } from "./src/rate-limiters/sliding-window";
import { SlidingLog } from "./src/rate-limiters/sliding-log";
import { FIXED_WINDOW_SIZE_MS, SLIDING_LOG_MAX_ENTRIES } from "./src/constants";

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

describe("Fixed Window Algorithm", () => {
  let limiter: FixedWindow;

  beforeEach(() => {
    limiter = new FixedWindow(10);
  });

  test("Test 1: Burst Capacity - allows exactly 10/15 requests at 10 RPS", () => {
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10); // No burst multiplier
  });

  test("Test 3: Recovery After Window Reset", async () => {
    // Exhaust window
    for (let i = 0; i < 15; i++) limiter.allow();

    // Wait for new window
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should allow exactly 10 more
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10);
  });

  test("Test 4: Full Recovery After Idle Period", async () => {
    // Exhaust window
    let firstWindowAllowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) firstWindowAllowed++;
    }
    expect(firstWindowAllowed).toBe(10);

    // Wait 2 seconds for new window
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should allow exactly 10 more
    let secondWindowAllowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) secondWindowAllowed++;
    }
    expect(secondWindowAllowed).toBe(10);
  });

  test("Test 5: Low Rate Configuration", () => {
    limiter = new FixedWindow(1);
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(1);
  });

  test("Test 6: High Rate Configuration", () => {
    limiter = new FixedWindow(100);
    let allowed = 0;
    for (let i = 0; i < 150; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(100);
  });

  test("Reset functionality", () => {
    // Use some capacity
    for (let i = 0; i < 5; i++) limiter.allow();

    // Reset
    limiter.reset();

    // Should allow 10 again
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10);
  });

  test("getStats returns correct information", () => {
    const stats = limiter.getStats();
    expect(stats.remaining).toBe(10);
    expect(stats.resetAt).toBeGreaterThan(Date.now());
    expect(stats.resetAt).toBeLessThanOrEqual(Date.now() + FIXED_WINDOW_SIZE_MS);

    // Use some capacity
    limiter.allow();
    limiter.allow();

    const stats2 = limiter.getStats();
    expect(stats2.remaining).toBe(8);
  });
});

describe("Sliding Window Algorithm", () => {
  let limiter: SlidingWindow;

  beforeEach(() => {
    limiter = new SlidingWindow(10);
  });

  test("Test 1: Burst Capacity - allows exactly 10/15 requests at 10 RPS", () => {
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10); // No burst multiplier, distributed capacity
  });

  test("Test 3: Recovery with Weighted Average", async () => {
    // Use capacity
    for (let i = 0; i < 15; i++) limiter.allow();

    // Wait for partial recovery
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should allow ~5 more (half window passed)
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBeGreaterThanOrEqual(4);
    expect(allowed).toBeLessThanOrEqual(6);
  });

  test("Test 4: Full Recovery After Window", async () => {
    // Use capacity
    let firstAllowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) firstAllowed++;
    }
    expect(firstAllowed).toBe(10);

    // Wait for full window
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should allow 10 more
    let secondAllowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) secondAllowed++;
    }
    expect(secondAllowed).toBe(10);
  });

  test("Test 5: Low Rate Configuration", () => {
    limiter = new SlidingWindow(1);
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(1);
  });

  test("Test 6: High Rate Configuration", () => {
    limiter = new SlidingWindow(100);
    let allowed = 0;
    for (let i = 0; i < 150; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(100);
  });

  test("Reset functionality", () => {
    // Use some capacity
    for (let i = 0; i < 5; i++) limiter.allow();

    // Reset
    limiter.reset();

    // Should allow 10 again
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10);
  });

  test("getStats returns correct information", () => {
    const stats = limiter.getStats();
    expect(stats.remaining).toBe(10);
    expect(stats.resetAt).toBeGreaterThan(Date.now());

    // Use some capacity
    limiter.allow();
    limiter.allow();

    const stats2 = limiter.getStats();
    expect(stats2.remaining).toBe(8);
  });
});

describe("Sliding Log Algorithm", () => {
  let limiter: SlidingLog;

  beforeEach(() => {
    limiter = new SlidingLog(10);
  });

  test("Test 1: Burst Capacity - allows exactly 10/15 requests at 10 RPS", () => {
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10); // Precise enforcement
  });

  test("Test 3: Continuous Sliding Window", async () => {
    // Use capacity
    for (let i = 0; i < 10; i++) limiter.allow();

    // Wait 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    // Shouldn't allow any yet (still within window)
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(0);

    // Wait another 600ms (total 1100ms)
    await new Promise(resolve => setTimeout(resolve, 600));

    // Now should allow exactly 10
    allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10);
  });

  test("Test 4: Precise Sliding Recovery", async () => {
    // Add 5 requests
    for (let i = 0; i < 5; i++) limiter.allow();

    // Wait 500ms
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add 5 more (total 10)
    for (let i = 0; i < 5; i++) limiter.allow();

    // Shouldn't allow more
    expect(limiter.allow()).toBe(false);

    // Wait 600ms (first 5 expire)
    await new Promise(resolve => setTimeout(resolve, 600));

    // Should allow exactly 5 more
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(5);
  });

  test("Test 5: Low Rate Configuration", () => {
    limiter = new SlidingLog(1);
    let allowed = 0;
    for (let i = 0; i < 5; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(1);
  });

  test("Test 6: High Rate Configuration", () => {
    limiter = new SlidingLog(100);
    let allowed = 0;
    for (let i = 0; i < 150; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(100);
  });

  test("Reset functionality", () => {
    // Use some capacity
    for (let i = 0; i < 5; i++) limiter.allow();

    // Reset
    limiter.reset();

    // Should allow 10 again
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) allowed++;
    }
    expect(allowed).toBe(10);
  });

  test("getStats returns correct information", () => {
    const stats = limiter.getStats();
    expect(stats.remaining).toBe(10);
    expect(stats.resetAt).toBeGreaterThan(Date.now());

    // Use some capacity
    limiter.allow();
    limiter.allow();

    const stats2 = limiter.getStats();
    expect(stats2.remaining).toBe(8);
  });

  test("Max entries limit enforcement", () => {
    // Create limiter with very high RPS
    const highRpsLimiter = new SlidingLog(SLIDING_LOG_MAX_ENTRIES + 100);

    let allowed = 0;
    for (let i = 0; i < SLIDING_LOG_MAX_ENTRIES + 200; i++) {
      if (highRpsLimiter.allow()) allowed++;
    }

    // Should stop at max entries
    expect(allowed).toBeLessThanOrEqual(SLIDING_LOG_MAX_ENTRIES);
  });
});