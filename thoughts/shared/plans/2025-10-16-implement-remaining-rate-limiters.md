# Implementing Remaining Rate Limiting Algorithms Implementation Plan

## Overview

Implement the 3 remaining optional rate limiting algorithms (Fixed Window, Sliding Window, and Sliding Log) to complete the full set of 5 algorithms specified in README.md. These algorithms provide different trade-offs between accuracy, performance, and implementation complexity.

## Current State Analysis

The codebase currently has a well-established pattern with 2 rate limiting algorithms (Token Bucket and Leaky Bucket) implemented. The architecture includes:
- Clean interface definition at `backend/src/types/rate-limiter.interface.ts:1-4`
- Factory pattern at `backend/src/limiter-factory.ts:8-17`
- Configuration constants centralized in `backend/src/constants.ts`
- Comprehensive test suite at `backend/test-algorithms.test.ts`
- REST API integration at `backend/src/index.ts`

### Key Discoveries:
- All algorithms must implement the `RateLimiter` interface with `allow()`, `reset()`, and `getStats()` methods
- Lazy evaluation pattern used - state updates happen on method calls, not continuously
- Configuration constants follow pattern: `[ALGORITHM_NAME]_[ASPECT]_[UNIT]`
- Tests verify exact burst capacity based on algorithm characteristics
- Factory pattern uses type union + switch statement for algorithm selection

## Desired End State

After implementation, the system will support 5 rate limiting algorithms total, with the 3 new algorithms fully integrated into the existing architecture. Users will be able to select any algorithm via the API or frontend UI, with each algorithm providing its specific performance characteristics as documented in README.md.

### Verification Criteria:
- All 5 algorithms selectable via POST /settings endpoint
- Frontend dropdown shows all 5 algorithm options
- Each algorithm passes comprehensive test suite
- Performance characteristics match README specifications

## What We're NOT Doing

- NOT modifying the existing RateLimiter interface
- NOT changing the API contract or endpoints
- NOT altering existing Token Bucket or Leaky Bucket implementations
- NOT adding configuration endpoints for algorithm-specific parameters (using hardcoded constants)
- NOT implementing distributed rate limiting or persistence
- NOT adding monitoring or metrics beyond existing getStats()

## Implementation Approach

Follow the established patterns exactly, implementing each algorithm as a separate class that implements the RateLimiter interface. Use configuration constants from constants.ts and integrate via the factory pattern. Each implementation will use lazy evaluation for efficiency.

## Phase 1: Fixed Window Algorithm

### Overview
Implement the simplest rate limiting algorithm that counts requests in fixed time windows with hard resets at boundaries.

### Changes Required:

#### 1. Add Configuration Constants
**File**: `backend/src/constants.ts`
**Changes**: Add Fixed Window configuration constant

```typescript
// Fixed Window Configuration
export const FIXED_WINDOW_SIZE_MS = 1000; // 1-second windows
```

#### 2. Implement Fixed Window Algorithm
**File**: `backend/src/rate-limiters/fixed-window.ts` (new file)
**Changes**: Create new implementation following interface

```typescript
import { RateLimiter } from "../types/rate-limiter.interface";
import { FIXED_WINDOW_SIZE_MS } from "../constants";

export class FixedWindow implements RateLimiter {
  private windowStart: number;
  private count: number;

  constructor(private rps: number) {
    this.windowStart = Date.now();
    this.count = 0;
  }

  allow(): boolean {
    const now = Date.now();

    // Check if we've moved to a new window
    if (now >= this.windowStart + FIXED_WINDOW_SIZE_MS) {
      this.windowStart = Math.floor(now / FIXED_WINDOW_SIZE_MS) * FIXED_WINDOW_SIZE_MS;
      this.count = 0;
    }

    // Check if we can allow this request
    if (this.count < this.rps) {
      this.count++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.count = 0;
    this.windowStart = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    const now = Date.now();

    // Update window if needed
    if (now >= this.windowStart + FIXED_WINDOW_SIZE_MS) {
      this.windowStart = Math.floor(now / FIXED_WINDOW_SIZE_MS) * FIXED_WINDOW_SIZE_MS;
      this.count = 0;
    }

    return {
      remaining: Math.max(0, this.rps - this.count),
      resetAt: this.windowStart + FIXED_WINDOW_SIZE_MS
    };
  }
}
```

#### 3. Add Tests for Fixed Window
**File**: `backend/test-algorithms.test.ts`
**Changes**: Add test suite for Fixed Window

```typescript
import { FixedWindow } from "./src/rate-limiters/fixed-window";

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
```

### Success Criteria:

#### Automated Verification:
- [ ] Fixed Window implementation compiles: `cd backend && bun run build`
- [ ] Fixed Window unit tests pass: `cd backend && bun test --grep "Fixed Window"`
- [ ] Type checking passes: `cd backend && bun run typecheck`
- [ ] No linting errors: `cd backend && bun run lint`

#### Manual Verification:
- [ ] Fixed Window shows no burst tolerance (exact RPS limit)
- [ ] Window boundary behavior verified (potential double burst at edges)
- [ ] Stats API returns accurate remaining count and reset time

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Sliding Window Algorithm

### Overview
Implement the segment-based weighted average algorithm that provides smoother rate limiting than Fixed Window.

### Changes Required:

#### 1. Add Configuration Constants
**File**: `backend/src/constants.ts`
**Changes**: Add Sliding Window configuration constants

```typescript
// Sliding Window Configuration
export const SLIDING_WINDOW_SIZE_MS = 1000; // Total window duration
export const SLIDING_WINDOW_SEGMENTS = 10;  // 10 segments of 100ms each
```

#### 2. Implement Sliding Window Algorithm
**File**: `backend/src/rate-limiters/sliding-window.ts` (new file)
**Changes**: Create weighted average implementation

```typescript
import { RateLimiter } from "../types/rate-limiter.interface";
import { SLIDING_WINDOW_SIZE_MS, SLIDING_WINDOW_SEGMENTS } from "../constants";

export class SlidingWindow implements RateLimiter {
  private segments: number[];
  private segmentDuration: number;
  private currentSegmentStart: number;
  private currentSegmentIndex: number;

  constructor(private rps: number) {
    this.segments = new Array(SLIDING_WINDOW_SEGMENTS).fill(0);
    this.segmentDuration = SLIDING_WINDOW_SIZE_MS / SLIDING_WINDOW_SEGMENTS;
    this.currentSegmentStart = Date.now();
    this.currentSegmentIndex = 0;
  }

  allow(): boolean {
    this.updateSegments();

    // Calculate weighted sum of current and previous window
    const weightedSum = this.calculateWeightedSum();

    if (weightedSum < this.rps) {
      this.segments[this.currentSegmentIndex]++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.segments.fill(0);
    this.currentSegmentStart = Date.now();
    this.currentSegmentIndex = 0;
  }

  getStats(): { remaining: number; resetAt: number } {
    this.updateSegments();
    const weightedSum = this.calculateWeightedSum();

    return {
      remaining: Math.max(0, Math.floor(this.rps - weightedSum)),
      resetAt: this.currentSegmentStart + this.segmentDuration
    };
  }

  private updateSegments(): void {
    const now = Date.now();
    const elapsed = now - this.currentSegmentStart;
    const segmentsPassed = Math.floor(elapsed / this.segmentDuration);

    if (segmentsPassed > 0) {
      // Clear old segments and advance
      for (let i = 0; i < Math.min(segmentsPassed, SLIDING_WINDOW_SEGMENTS); i++) {
        this.currentSegmentIndex = (this.currentSegmentIndex + 1) % SLIDING_WINDOW_SEGMENTS;
        this.segments[this.currentSegmentIndex] = 0;
      }

      this.currentSegmentStart += segmentsPassed * this.segmentDuration;
    }
  }

  private calculateWeightedSum(): number {
    const now = Date.now();
    const currentSegmentElapsed = (now - this.currentSegmentStart) / this.segmentDuration;

    // Sum all segments with appropriate weights
    let total = 0;
    for (let i = 0; i < SLIDING_WINDOW_SEGMENTS; i++) {
      if (i === this.currentSegmentIndex) {
        // Current segment - partial weight based on elapsed time
        total += this.segments[i];
      } else {
        // Previous segments - check if they're within the window
        const segmentAge = this.getSegmentAge(i);
        if (segmentAge < SLIDING_WINDOW_SEGMENTS) {
          const weight = Math.max(0, 1 - (segmentAge / SLIDING_WINDOW_SEGMENTS));
          total += this.segments[i] * weight;
        }
      }
    }

    return total;
  }

  private getSegmentAge(index: number): number {
    if (index === this.currentSegmentIndex) return 0;

    const distance = (this.currentSegmentIndex - index + SLIDING_WINDOW_SEGMENTS) % SLIDING_WINDOW_SEGMENTS;
    return distance;
  }
}
```

#### 3. Add Tests for Sliding Window
**File**: `backend/test-algorithms.test.ts`
**Changes**: Add test suite for Sliding Window

```typescript
import { SlidingWindow } from "./src/rate-limiters/sliding-window";

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
```

### Success Criteria:

#### Automated Verification:
- [ ] Sliding Window implementation compiles: `cd backend && bun run build`
- [ ] Sliding Window unit tests pass: `cd backend && bun test --grep "Sliding Window"`
- [ ] Type checking passes: `cd backend && bun run typecheck`
- [ ] No linting errors: `cd backend && bun run lint`

#### Manual Verification:
- [ ] Sliding Window shows low burst tolerance (distributed across segments)
- [ ] Weighted average calculation provides smooth rate limiting
- [ ] No boundary effects (smooth transitions between segments)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Sliding Log Algorithm

### Overview
Implement the most precise rate limiting algorithm using timestamp logging for exact rate enforcement.

### Changes Required:

#### 1. Add Configuration Constants
**File**: `backend/src/constants.ts`
**Changes**: Add Sliding Log configuration constants

```typescript
// Sliding Log Configuration
export const SLIDING_LOG_WINDOW_MS = 1000;    // Tracking window
export const SLIDING_LOG_MAX_ENTRIES = 10000; // Max log size to prevent memory issues
```

#### 2. Implement Sliding Log Algorithm
**File**: `backend/src/rate-limiters/sliding-log.ts` (new file)
**Changes**: Create timestamp-based implementation

```typescript
import { RateLimiter } from "../types/rate-limiter.interface";
import { SLIDING_LOG_WINDOW_MS, SLIDING_LOG_MAX_ENTRIES } from "../constants";

export class SlidingLog implements RateLimiter {
  private log: number[]; // Array of timestamps

  constructor(private rps: number) {
    this.log = [];
  }

  allow(): boolean {
    const now = Date.now();

    // Remove expired entries
    this.cleanExpiredEntries(now);

    // Check if we can allow this request
    if (this.log.length < this.rps) {
      this.log.push(now);

      // Enforce max entries limit (reject if at limit)
      if (this.log.length > SLIDING_LOG_MAX_ENTRIES) {
        this.log.pop(); // Remove the entry we just added
        return false;
      }

      return true;
    }

    return false;
  }

  reset(): void {
    this.log = [];
  }

  getStats(): { remaining: number; resetAt: number } {
    const now = Date.now();
    this.cleanExpiredEntries(now);

    const remaining = Math.max(0, this.rps - this.log.length);
    const resetAt = this.log.length > 0
      ? this.log[0] + SLIDING_LOG_WINDOW_MS
      : now + SLIDING_LOG_WINDOW_MS;

    return { remaining, resetAt };
  }

  private cleanExpiredEntries(now: number): void {
    const windowStart = now - SLIDING_LOG_WINDOW_MS;

    // Remove all entries older than the window
    while (this.log.length > 0 && this.log[0] < windowStart) {
      this.log.shift();
    }
  }
}
```

#### 3. Add Tests for Sliding Log
**File**: `backend/test-algorithms.test.ts`
**Changes**: Add test suite for Sliding Log

```typescript
import { SlidingLog } from "./src/rate-limiters/sliding-log";

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
```

### Success Criteria:

#### Automated Verification:
- [ ] Sliding Log implementation compiles: `cd backend && bun run build`
- [ ] Sliding Log unit tests pass: `cd backend && bun test --grep "Sliding Log"`
- [ ] Type checking passes: `cd backend && bun run typecheck`
- [ ] No linting errors: `cd backend && bun run lint`
- [ ] Max entries limit test passes

#### Manual Verification:
- [ ] Sliding Log shows zero burst tolerance (precise enforcement)
- [ ] No boundary effects (continuous sliding window)
- [ ] Memory usage remains bounded with high request rates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Integration & Testing

### Overview
Integrate all three new algorithms into the factory pattern, update API validation, frontend UI, and ensure comprehensive test coverage.

### Changes Required:

#### 1. Update Factory Pattern
**File**: `backend/src/limiter-factory.ts`
**Changes**: Add new algorithms to factory

```typescript
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
```

#### 2. Update API Validation
**File**: `backend/src/index.ts`
**Changes**: Update algorithm validation on line 30

```typescript
// Line 30 - update the validation
if (!["token-bucket", "leaky-bucket", "fixed-window", "sliding-window", "sliding-log"].includes(body.algorithm)) {
  return c.json({ error: "Invalid algorithm or RPS value" }, 400);
}
```

#### 3. Update Frontend UI
**File**: `frontend/index.html`
**Changes**: Add new algorithm options to dropdown (around lines 18-20)

```html
<select id="algorithm" class="select select-bordered">
  <option value="token-bucket">Token Bucket</option>
  <option value="leaky-bucket">Leaky Bucket</option>
  <option value="fixed-window">Fixed Window</option>
  <option value="sliding-window">Sliding Window</option>
  <option value="sliding-log">Sliding Log</option>
</select>
```

#### 4. Run Integration Tests
**File**: `backend/test-integration.test.ts`
**Changes**: Verify integration tests work with new algorithms

The existing integration tests should automatically work once the factory is updated. No changes needed unless tests fail.

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `cd backend && bun test`
- [ ] Integration tests pass: `cd backend && bun test test-integration.test.ts`
- [ ] Build succeeds: `cd backend && bun run build`
- [ ] Type checking passes: `cd backend && bun run typecheck`
- [ ] Linting passes: `cd backend && bun run lint`
- [ ] Frontend builds: `cd frontend && npm run build`

#### Manual Verification:
- [ ] All 5 algorithms appear in frontend dropdown
- [ ] Each algorithm can be selected and applied via UI
- [ ] Rate limiting behavior matches algorithm characteristics
- [ ] API returns correct headers for each algorithm
- [ ] Performance is acceptable with all algorithms

**Implementation Note**: After all verification passes, the implementation is complete. Document any issues or optimizations discovered during testing.

---

## Testing Strategy

### Unit Tests:
- Each algorithm has 7-8 tests covering:
  - Exact burst capacity (no multipliers for new algorithms)
  - Recovery behavior specific to algorithm
  - Low/high rate configurations
  - Reset functionality
  - Stats accuracy
  - Algorithm-specific behaviors (e.g., max entries for Sliding Log)

### Integration Tests:
- API endpoint validation with all algorithms
- Factory pattern instantiation
- Configuration switching at runtime
- Rate limit header accuracy

### Manual Testing Steps:
1. Start backend: `cd backend && bun run dev`
2. Start frontend: `cd frontend && npm run dev`
3. For each algorithm:
   - Select algorithm in dropdown
   - Set RPS to 10
   - Click "Send Requests" rapidly
   - Verify rate limiting kicks in at expected capacity
   - Wait for recovery
   - Test again
4. Test edge cases:
   - Very low RPS (1)
   - Very high RPS (1000)
   - Rapid algorithm switching

## Performance Considerations

### Memory Usage:
- **Fixed Window**: O(1) - minimal memory (2 numbers)
- **Sliding Window**: O(segments) - 10 numbers array
- **Sliding Log**: O(rps) - grows with rate, capped at 10,000 entries

### CPU Usage:
- **Fixed Window**: O(1) - simple counter check
- **Sliding Window**: O(segments) - weighted sum calculation
- **Sliding Log**: O(log size) - array cleanup on each request

### Recommendations:
- Use Fixed Window for simple, low-overhead rate limiting
- Use Sliding Window for balanced accuracy and performance
- Use Sliding Log only when precise enforcement is critical

## Migration Notes

No data migration required as rate limiters maintain only in-memory state. When switching algorithms:
1. Existing rate limiter is discarded
2. New instance created with fresh state
3. No persistence layer affected

## References

- Original research: `thoughts/shared/research/2025-10-16-implementing-remaining-rate-limiters.md`
- README specifications: `README.md:203-275`
- Existing Token Bucket: `backend/src/rate-limiters/token-bucket.ts`
- Existing Leaky Bucket: `backend/src/rate-limiters/leaky-bucket.ts`
- Interface definition: `backend/src/types/rate-limiter.interface.ts:1-4`
- Factory pattern: `backend/src/limiter-factory.ts:8-17`