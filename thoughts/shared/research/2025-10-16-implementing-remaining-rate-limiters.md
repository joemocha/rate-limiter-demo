---
date: 2025-10-16T18:54:20+00:00
researcher: sam
git_commit: 8a9a44dc567b022d1ca22c0a994819682443f1f1
branch: view/fox
repository: demo-fox
topic: "Implementing the 3 remaining rate limiting algorithms from README.md"
tags: [research, codebase, rate-limiting, fixed-window, sliding-window, sliding-log]
status: complete
last_updated: 2025-10-16
last_updated_by: sam
---

# Research: Implementing the 3 Remaining Rate Limiting Algorithms

**Date**: 2025-10-16T18:54:20+00:00
**Researcher**: sam
**Git Commit**: 8a9a44dc567b022d1ca22c0a994819682443f1f1
**Branch**: view/fox
**Repository**: demo-fox

## Research Question
How to implement the 3 remaining rate limiting algorithms (Fixed Window, Sliding Window, and Sliding Log) from the README.md specification.

## Summary
The codebase currently implements two rate limiting algorithms (Token Bucket and Leaky Bucket) following a well-defined architecture pattern. To implement the three remaining optional algorithms (Fixed Window, Sliding Window, and Sliding Log), each must follow the same patterns: implementing the `RateLimiter` interface, integrating with the factory pattern, and following the established configuration and testing conventions. The README.md provides comprehensive specifications for each algorithm's behavior, configuration constants, and expected characteristics.

## Detailed Findings

### Current Architecture Pattern

#### RateLimiter Interface
All rate limiting algorithms must implement the interface defined at `backend/src/types/rate-limiter.interface.ts:1-4`:

```typescript
export interface RateLimiter {
  allow(): boolean;                       // Returns true if request allowed, false if rate limited
  reset(): void;                         // Clears internal state
  getStats(): { remaining: number; resetAt: number };  // Returns current capacity and reset time
}
```

This interface ensures consistent API across all algorithms.

#### Factory Pattern Integration
The `backend/src/limiter-factory.ts:8-17` factory creates rate limiter instances:

```typescript
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
```

New algorithms require:
1. Adding the algorithm name to the `AlgorithmType` union
2. Importing the implementation class
3. Adding a case in the switch statement

#### Configuration Constants Pattern
Constants are centralized in `backend/src/constants.ts`:
- Token Bucket uses `TOKEN_BUCKET_BURST_MULTIPLIER` (2.0) and `TOKEN_BUCKET_REFILL_INTERVAL_MS` (100)
- Leaky Bucket uses `LEAKY_BUCKET_QUEUE_MULTIPLIER` (1.5) and `LEAKY_BUCKET_DRAIN_INTERVAL_MS` (50)

Pattern: `[ALGORITHM_NAME]_[CONFIGURATION_ASPECT]_[UNIT]`

### Fixed Window Algorithm Requirements

#### Specification (README.md:203-213)
- **Mechanism**: Counts requests in fixed time windows (e.g., 0-1s, 1-2s). Counter resets at window boundaries.
- **Characteristics**:
  - Burst tolerance: None within window
  - Boundary effects: **High** - double rate possible at window edges
  - Memory: O(1) - stores count and window start time
  - CPU: O(1) per request
- **Use case**: Simple implementation where boundary burst is acceptable

#### Configuration Constants (README.md:257-261)
```typescript
FIXED_WINDOW_SIZE_MS = 1000              // Window duration (reset period)
```

Trade-off: Smaller window = more frequent resets, higher boundary burst risk.

#### Implementation Requirements
1. **File location**: `backend/src/rate-limiters/fixed-window.ts`
2. **State management**:
   - `windowStart`: Timestamp of current window start
   - `count`: Requests in current window
   - `windowSize`: Duration in milliseconds
3. **allow() implementation**:
   - Check if current time has moved to new window
   - If yes, reset count and update windowStart
   - Check if count < rps
   - Increment count if allowed
4. **getStats() implementation**:
   - `remaining`: rps - count
   - `resetAt`: windowStart + windowSize
5. **reset() implementation**:
   - Set count to 0
   - Update windowStart to current time

### Sliding Window Algorithm Requirements

#### Specification (README.md:215-225)
- **Mechanism**: Divides time into segments. Calculates weighted average of current + previous window.
- **Characteristics**:
  - Burst tolerance: Low (distributed across window)
  - Boundary effects: Low (weighted smoothing)
  - Memory: O(segments) - stores counts per segment
  - CPU: O(1) per request (weighted sum)
- **Use case**: Balance between accuracy and efficiency

#### Configuration Constants (README.md:263-268)
```typescript
SLIDING_WINDOW_SIZE_MS = 1000            // Total window duration
SLIDING_WINDOW_SEGMENTS = 10             // Sub-window count (100ms each)
```

Trade-off: More segments = smoother enforcement, higher memory/CPU cost.

#### Implementation Requirements
1. **File location**: `backend/src/rate-limiters/sliding-window.ts`
2. **State management**:
   - `segments`: Array of segment counts
   - `segmentDuration`: windowSize / segmentCount
   - `currentSegmentStart`: Timestamp of current segment
   - `currentSegmentIndex`: Index in segments array
3. **allow() implementation**:
   - Update segments if time has moved forward
   - Calculate weighted sum of current and previous segments
   - Check if sum < rps
   - Increment current segment if allowed
4. **getStats() implementation**:
   - Calculate weighted sum
   - `remaining`: rps - weightedSum
   - `resetAt`: currentSegmentStart + segmentDuration
5. **reset() implementation**:
   - Clear all segments to 0
   - Update currentSegmentStart

### Sliding Log Algorithm Requirements

#### Specification (README.md:227-237)
- **Mechanism**: Maintains log of exact request timestamps. Counts requests within sliding window.
- **Characteristics**:
  - Burst tolerance: None (precise enforcement)
  - Boundary effects: None (continuous sliding)
  - Memory: O(rps * window_size) - grows with rate
  - CPU: O(log_size) per request (filter expired)
- **Use case**: Strict rate enforcement where precision is critical

#### Configuration Constants (README.md:270-275)
```typescript
SLIDING_LOG_WINDOW_MS = 1000             // Tracking window duration
SLIDING_LOG_MAX_ENTRIES = 10000          // Maximum log size (prevents memory leak)
```

Trade-off: Larger max entries = supports higher burst rates, more memory consumption.

#### Implementation Requirements
1. **File location**: `backend/src/rate-limiters/sliding-log.ts`
2. **State management**:
   - `log`: Array of request timestamps
   - `windowSize`: Duration in milliseconds
   - `maxEntries`: Maximum log size
3. **allow() implementation**:
   - Remove expired timestamps (older than now - windowSize)
   - Check if log.length < rps
   - Add current timestamp if allowed
   - Enforce maxEntries limit
4. **getStats() implementation**:
   - Clean expired entries
   - `remaining`: rps - log.length
   - `resetAt`: oldest timestamp + windowSize (or now + 1000 if empty)
5. **reset() implementation**:
   - Clear log array

### Implementation Steps for Each Algorithm

#### Step 1: Create Implementation File
Each algorithm needs a TypeScript file in `backend/src/rate-limiters/` implementing the `RateLimiter` interface.

Example structure:
```typescript
import { RateLimiter } from "../types/rate-limiter.interface";
import { ALGORITHM_CONSTANTS } from "../constants";

export class AlgorithmName implements RateLimiter {
  // Private state variables

  constructor(private rps: number) {
    // Initialize state
  }

  allow(): boolean {
    // Algorithm-specific logic
    return allowed;
  }

  reset(): void {
    // Clear state
  }

  getStats(): { remaining: number; resetAt: number } {
    // Return current state info
    return { remaining, resetAt };
  }

  // Private helper methods as needed
}
```

#### Step 2: Add Configuration Constants
Add to `backend/src/constants.ts`:
```typescript
// Fixed Window Configuration
export const FIXED_WINDOW_SIZE_MS = 1000;

// Sliding Window Configuration
export const SLIDING_WINDOW_SIZE_MS = 1000;
export const SLIDING_WINDOW_SEGMENTS = 10;

// Sliding Log Configuration
export const SLIDING_LOG_WINDOW_MS = 1000;
export const SLIDING_LOG_MAX_ENTRIES = 10000;
```

#### Step 3: Update Factory
Modify `backend/src/limiter-factory.ts`:

1. Update type union:
```typescript
export type AlgorithmType = "token-bucket" | "leaky-bucket" | "fixed-window" | "sliding-window" | "sliding-log";
```

2. Add imports:
```typescript
import { FixedWindow } from "./rate-limiters/fixed-window";
import { SlidingWindow } from "./rate-limiters/sliding-window";
import { SlidingLog } from "./rate-limiters/sliding-log";
```

3. Add cases:
```typescript
case "fixed-window":
  return new FixedWindow(rps);
case "sliding-window":
  return new SlidingWindow(rps);
case "sliding-log":
  return new SlidingLog(rps);
```

#### Step 4: Update API Validation
Modify `backend/src/index.ts:30`:
```typescript
if (!["token-bucket", "leaky-bucket", "fixed-window", "sliding-window", "sliding-log"].includes(body.algorithm)) {
  return c.json({ error: "Invalid algorithm or RPS value" }, 400);
}
```

#### Step 5: Add Tests
Create test cases in `backend/test-algorithms.test.ts` for each algorithm following the existing pattern:

1. Burst capacity test (verify exact capacity)
2. Recovery after exhaustion (1 second wait)
3. Full recovery (2 second wait)
4. Low rate configuration (1 RPS)
5. High rate configuration (100 RPS)
6. Reset functionality
7. Stats accuracy

Expected values per README.md specifications:
- Fixed Window: capacity = rps (no burst multiplier)
- Sliding Window: capacity = rps (distributed across segments)
- Sliding Log: capacity = rps (precise enforcement)

#### Step 6: Update Frontend
Modify `frontend/index.html:18-20` to add options:
```html
<select id="algorithm">
  <option value="token-bucket">Token Bucket</option>
  <option value="leaky-bucket">Leaky Bucket</option>
  <option value="fixed-window">Fixed Window</option>
  <option value="sliding-window">Sliding Window</option>
  <option value="sliding-log">Sliding Log</option>
</select>
```

### Testing Requirements

Based on the existing test patterns in `backend/test-algorithms.test.ts`, each new algorithm needs:

1. **Unit tests** with `beforeEach()` setup creating fresh instance
2. **Exact capacity validation** based on algorithm characteristics
3. **Time-based recovery tests** with tolerance ranges
4. **Configuration boundary tests** (1 RPS and 100 RPS)
5. **Reset mechanism validation**
6. **Stats API accuracy checks**

Integration tests in `test-integration.test.ts` should automatically work once algorithms are added to the factory.

## Code References

### Existing Implementations
- `backend/src/rate-limiters/token-bucket.ts` - Token Bucket implementation pattern
- `backend/src/rate-limiters/leaky-bucket.ts` - Leaky Bucket implementation pattern
- `backend/src/types/rate-limiter.interface.ts:1-4` - Interface all algorithms must implement
- `backend/src/limiter-factory.ts:8-17` - Factory pattern for algorithm instantiation
- `backend/src/constants.ts` - Configuration constants location
- `backend/src/index.ts:30` - API validation that needs updating
- `backend/test-algorithms.test.ts` - Test patterns to follow
- `README.md:203-237` - Detailed specifications for optional algorithms
- `README.md:257-275` - Configuration constants for optional algorithms

### Implementation Locations (To Be Created)
- `backend/src/rate-limiters/fixed-window.ts` - Fixed Window implementation
- `backend/src/rate-limiters/sliding-window.ts` - Sliding Window implementation
- `backend/src/rate-limiters/sliding-log.ts` - Sliding Log implementation

## Architecture Documentation

### Common Patterns
1. **Constructor Pattern**: All algorithms accept `rps: number` as the only parameter
2. **Lazy Evaluation**: State updates happen on `allow()` and `getStats()` calls, not continuously
3. **State Encapsulation**: Private variables and methods handle internal logic
4. **Consistent Interface**: Three public methods (`allow()`, `reset()`, `getStats()`)
5. **Configuration Constants**: Centralized in `constants.ts` following naming convention
6. **Factory Integration**: Type union + import + switch case pattern

### Algorithm Characteristics Summary

| Algorithm | Burst Tolerance | Boundary Effects | Memory | CPU | Best Use Case |
|-----------|----------------|------------------|---------|-----|---------------|
| Token Bucket | High (2.0×) | None | O(1) | O(1) | APIs with burst traffic |
| Leaky Bucket | Medium (1.5×) | None | O(queue) | O(1) | Smooth output rate |
| Fixed Window | None | High | O(1) | O(1) | Simple implementation |
| Sliding Window | Low | Low | O(segments) | O(1) | Balance accuracy/efficiency |
| Sliding Log | None | None | O(log) | O(log) | Precise enforcement |

## Related Research
- `thoughts/shared/plans/2025-10-16-rate-limiting-implementation.md` - Implementation plan (marked optional algorithms as out of scope)
- `thoughts/shared/research/2025-10-16-rate-limiting-implementation.md` - Initial research (confirmed 2 required, 3 optional)

## Implementation Decisions

Based on design review, the following implementation decisions have been made:

1. **No configuration multipliers for optional algorithms** - They will use exact RPS as capacity (no burst multipliers)
2. **Sliding Window will use a simple array** - No circular buffer needed for the expected use case
3. **Sliding Log will use a deque for efficiency** - Better performance for adding/removing timestamps at both ends
4. **When `SLIDING_LOG_MAX_ENTRIES` is reached: reject new requests** - Prevents unbounded memory growth and maintains rate limit integrity