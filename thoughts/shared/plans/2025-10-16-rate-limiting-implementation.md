---
date: 2025-10-16T22:30:00+00:00
planner: sam
git_commit: bf55306b80291ec4386f9c72a1b283e99db5141a
branch: view/haiku-fox
repository: haiku-fox
topic: "Full implementation of rate limiting demo (Token Bucket + Leaky Bucket)"
tags: [implementation-plan, rate-limiting, hono, bun, vite, typescript]
status: pending_review
last_updated: 2025-10-16
---

# Rate Limiting Demo - Full Implementation Plan

## Overview

Implement a working rate-limiting demonstration application showing Token Bucket vs. Leaky Bucket algorithms. This plan follows a test-first approach (TDD), building backend algorithms with comprehensive validation before implementing the frontend UI. The implementation uses Hono (backend), Vite (frontend), Bun (runtime), and vanilla TypeScript throughout.

**Scope**: Token Bucket and Leaky Bucket algorithms only. No optional algorithms (Fixed Window, Sliding Window, Sliding Log).

**Target**: Local development setup with concurrent backend (port 9000) and frontend (port 5173).

## Current State Analysis

**Implementation Status**: ~2% complete
- ✅ Project structure and tooling configured
- ✅ TypeScript and build infrastructure in place
- ✅ Comprehensive specification in README.md
- ❌ No rate limiting algorithms implemented
- ❌ No API endpoints
- ❌ No frontend UI components
- ❌ No tests

**Key Constraints**:
- Backend uses Bun runtime (direct TypeScript execution, no build step)
- Frontend uses Vite with HMR during development
- Global rate limiter state (single instance shared across all clients)
- Environment variables required for port configuration
- Test-first approach using bun:test

**Existing Patterns**:
- Monorepo orchestrated from root package.json
- `"moduleResolution": "bundler"` for consistent module resolution
- Root tsconfig covers both backend and frontend/src
- Frontend has stricter tsconfig override (ES2022)

## Desired End State

After this plan completes, the application will:

1. **Algorithms Fully Functional**:
   - Token Bucket: Allow bursts up to (RPS × 2.0), refill 100ms
   - Leaky Bucket: Queue up to (RPS × 1.5), drain 50ms
   - Pass all 7 validation test scenarios

2. **Backend API Working**:
   - POST `/settings` accepts algorithm + RPS, returns current config
   - GET `/test` returns 200/429 with proper rate limit headers
   - GET `/health` shows server status and limiter state
   - POST `/reset` clears algorithm state
   - CORS configured for http://localhost:5173

3. **Frontend UI Complete**:
   - Configuration panel: algorithm selector, RPS input, apply button
   - Burst generator: request count, delay, fire button
   - Results display: request log (max 100 entries), statistics, visual indicator
   - Real-time updates as requests are processed

4. **Development Setup Ready**:
   - Both servers runnable concurrently
   - Hot reload working on both backend and frontend
   - Tests runnable with `bun run backend/test-algorithms.ts`
   - Build produces frontend/dist/ for serving

**Verification Method**:
- Automated: All bun:test scenarios pass, TypeScript strict mode clean
- Manual: Playwright-based end-to-end testing of UI interactions and rate limiting behavior

---

## What We're NOT Doing

- Optional rate limiting algorithms (Fixed Window, Sliding Window, Sliding Log)
- Production deployment infrastructure
- Performance optimization beyond specification
- Advanced UI features (animations, charts)
- Framework adoption for frontend (keeping vanilla TS)
- Backend hot reload with watch mode (handled by Bun JIT)

---

## Implementation Approach

**Test-Driven Development (TDD)**:
1. Write all 7 test scenarios upfront
2. Implement Token Bucket to pass tests
3. Implement Leaky Bucket to pass tests
4. Validate against specification requirements

**Layered Implementation**:
- Layer 1: Algorithm layer (RateLimiter interface + implementations)
- Layer 2: API layer (Hono endpoints + middleware)
- Layer 3: UI layer (frontend components + client logic)
- Layer 4: Integration layer (concurrent development setup)

**Testing Strategy**:
- Unit tests: Algorithm behavior under specified loads
- Integration tests: API endpoints return correct responses
- Manual tests: UI interactions and visual feedback via Playwright

---

## Phase 1: Foundation Setup

### Overview
Establish project structure, configuration, and interfaces needed for algorithm implementations. This phase creates the scaffolding that phases 2-4 build upon.

### Changes Required:

#### 1. Create Backend Directory Structure
**File**: `backend/src/` (new directory)
**Changes**: Create the following directory structure:
```
backend/
├── src/
│   ├── index.ts              # Hono server (Phase 3)
│   ├── constants.ts          # Algorithm tuning parameters
│   ├── types/
│   │   └── rate-limiter.interface.ts
│   ├── rate-limiters/
│   │   ├── token-bucket.ts   # (Phase 2)
│   │   └── leaky-bucket.ts   # (Phase 2)
│   └── limiter-factory.ts    # (Phase 3)
└── test-algorithms.ts        # (Phase 2)
```

#### 2. Create constants.ts with Algorithm Parameters
**File**: `backend/src/constants.ts` (new)
**Changes**: Define all tuning constants referenced in README.md:

```typescript
// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;      // Burst capacity = rps × 2.0
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;    // Refill every 100ms

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;      // Queue depth = rps × 1.5
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;      // Drain every 50ms

// Server Configuration
export const DEFAULT_BACKEND_PORT = 9000;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';
```

#### 3. Create RateLimiter Interface
**File**: `backend/src/types/rate-limiter.interface.ts` (new)
**Changes**: Define the interface all algorithms must implement:

```typescript
export interface RateLimiter {
  allow(): boolean;
  reset(): void;
  getStats(): { remaining: number; resetAt: number };
}
```

#### 4. Create .env.example
**File**: `.env.example` (new in project root)
**Changes**: Template for environment variables:

```env
# Backend Configuration
BACKEND_PORT=9000
CORS_ORIGIN=http://localhost:5173

# Frontend Configuration
VITE_API_URL=http://localhost:9000
VITE_PORT=5173
```

#### 5. Update Root package.json
**File**: `package.json` (root)
**Changes**:
- Add test script: `"test": "bun run backend/test-algorithms.ts"`
- Add environment variable loading support (if needed for backend startup)
- Ensure backend/index.ts can read BACKEND_PORT and CORS_ORIGIN from environment

```json
{
  "scripts": {
    "dev": "cd frontend && bun run dev",
    "server": "bun run backend/index.ts",
    "build": "cd frontend && bun run build",
    "test": "bun run backend/test-algorithms.ts"
  }
}
```

#### 6. Create Placeholder Algorithm Files
**Files**:
- `backend/src/rate-limiters/token-bucket.ts`
- `backend/src/rate-limiters/leaky-bucket.ts`

**Changes**: Create skeleton files that will be filled in Phase 2:

```typescript
import { RateLimiter } from '../types/rate-limiter.interface';

export class TokenBucket implements RateLimiter {
  constructor(private rps: number) {}

  allow(): boolean {
    // Implemented in Phase 2
    throw new Error('Not implemented');
  }

  reset(): void {
    // Implemented in Phase 2
    throw new Error('Not implemented');
  }

  getStats(): { remaining: number; resetAt: number } {
    // Implemented in Phase 2
    throw new Error('Not implemented');
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Directory structure created: `backend/src/` exists with subdirectories
- [ ] `backend/src/constants.ts` exports all required constants
- [ ] `backend/src/types/rate-limiter.interface.ts` defines the RateLimiter interface
- [ ] TypeScript compilation clean: `bunx tsc --noEmit` passes at project root
- [ ] No unused imports warnings

#### Manual Verification:
- [ ] File structure matches specification layout
- [ ] All constant values match README.md specifications
- [ ] Environment template (.env.example) includes all documented variables

---

## Phase 2: Algorithm Implementations (TDD)

### Overview
Implement Token Bucket and Leaky Bucket algorithms using test-driven development. Write all 7 validation test scenarios first, then implement algorithms to pass tests.

### Changes Required:

#### 1. Create Test File with All 7 Scenarios
**File**: `backend/test-algorithms.ts` (new)
**Changes**: Implement all validation test scenarios from README.md specification:

```typescript
import { describe, it, expect } from 'bun:test';
import { TokenBucket } from './src/rate-limiters/token-bucket';
import { LeakyBucket } from './src/rate-limiters/leaky-bucket';
import { TOKEN_BUCKET_BURST_MULTIPLIER, LEAKY_BUCKET_QUEUE_MULTIPLIER } from './src/constants';

describe('Rate Limiters', () => {
  // Test 1: Burst Capacity (Instant Load)
  describe('Test 1: Burst Capacity', () => {
    it('Token Bucket: should allow 20/25 requests @ 10 RPS', () => {
      const limiter = new TokenBucket(10);
      let allowed = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(20);
    });

    it('Leaky Bucket: should allow 15/25 requests @ 10 RPS', () => {
      const limiter = new LeakyBucket(10);
      let allowed = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(15);
    });
  });

  // Test 2: Rate Enforcement (Sustained Load)
  describe('Test 2: Rate Enforcement', () => {
    it('Token Bucket: should allow ~100/100 requests @ 10 RPS with 100ms delay', async () => {
      const limiter = new TokenBucket(10);
      let allowed = 0;
      for (let i = 0; i < 100; i++) {
        if (limiter.allow()) allowed++;
        await new Promise(r => setTimeout(r, 100));
      }
      expect(allowed).toBeGreaterThanOrEqual(95); // Allow some timing variance
    });

    it('Leaky Bucket: should allow ~100/100 requests @ 10 RPS with 100ms delay', async () => {
      const limiter = new LeakyBucket(10);
      let allowed = 0;
      for (let i = 0; i < 100; i++) {
        if (limiter.allow()) allowed++;
        await new Promise(r => setTimeout(r, 100));
      }
      expect(allowed).toBeGreaterThanOrEqual(95);
    });
  });

  // Test 3: Recovery After Exhaustion
  describe('Test 3: Recovery After Exhaustion', () => {
    it('Token Bucket: should allow 20, then after 1s, allow 10 more', async () => {
      const limiter = new TokenBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(20);

      await new Promise(r => setTimeout(r, 1000));

      let burst2 = 0;
      for (let i = 0; i < 15; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(10); // Refilled ~10 tokens in 1s
    });

    it('Leaky Bucket: should allow 15, then after 1s, allow 10 more', async () => {
      const limiter = new LeakyBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(15);

      await new Promise(r => setTimeout(r, 1000));

      let burst2 = 0;
      for (let i = 0; i < 15; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(10); // Drained ~10 items in 1s
    });
  });

  // Test 4: Full Recovery After Idle Period
  describe('Test 4: Full Recovery After Idle', () => {
    it('Token Bucket: should fully refill after 2s idle', async () => {
      const limiter = new TokenBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(20);

      await new Promise(r => setTimeout(r, 2000));

      let burst2 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(20); // Full capacity restored
    });

    it('Leaky Bucket: should fully drain queue after 2s idle', async () => {
      const limiter = new LeakyBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(15);

      await new Promise(r => setTimeout(r, 2000));

      let burst2 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(15); // Queue fully cleared
    });
  });

  // Test 5: Low Rate Configuration
  describe('Test 5: Low Rate (1 RPS)', () => {
    it('Token Bucket: should allow 2/5 requests @ 1 RPS', () => {
      const limiter = new TokenBucket(1);
      let allowed = 0;
      for (let i = 0; i < 5; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(2);
    });

    it('Leaky Bucket: should allow 1/5 requests @ 1 RPS', () => {
      const limiter = new LeakyBucket(1);
      let allowed = 0;
      for (let i = 0; i < 5; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(1);
    });
  });

  // Test 6: High Rate Configuration
  describe('Test 6: High Rate (100 RPS)', () => {
    it('Token Bucket: should allow 200/500 requests @ 100 RPS', () => {
      const limiter = new TokenBucket(100);
      let allowed = 0;
      for (let i = 0; i < 500; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(200);
    });

    it('Leaky Bucket: should allow 150/500 requests @ 100 RPS', () => {
      const limiter = new LeakyBucket(100);
      let allowed = 0;
      for (let i = 0; i < 500; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(150);
    });
  });

  // Test 7: Reset Functionality
  describe('Test 7: Reset Functionality', () => {
    it('Token Bucket: reset() should restore full capacity', () => {
      const limiter = new TokenBucket(10);

      let before = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) before++;
      }
      expect(before).toBe(20);

      limiter.reset();

      let after = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) after++;
      }
      expect(after).toBe(20);
    });

    it('Leaky Bucket: reset() should clear queue', () => {
      const limiter = new LeakyBucket(10);

      let before = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) before++;
      }
      expect(before).toBe(15);

      limiter.reset();

      let after = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) after++;
      }
      expect(after).toBe(15);
    });
  });

  // Test getStats() interface
  describe('Test 8: getStats() Interface', () => {
    it('Token Bucket: getStats() returns { remaining, resetAt }', () => {
      const limiter = new TokenBucket(10);
      const stats = limiter.getStats();

      expect(stats).toHaveProperty('remaining');
      expect(stats).toHaveProperty('resetAt');
      expect(typeof stats.remaining).toBe('number');
      expect(typeof stats.resetAt).toBe('number');
    });

    it('Leaky Bucket: getStats() returns { remaining, resetAt }', () => {
      const limiter = new LeakyBucket(10);
      const stats = limiter.getStats();

      expect(stats).toHaveProperty('remaining');
      expect(stats).toHaveProperty('resetAt');
      expect(typeof stats.remaining).toBe('number');
      expect(typeof stats.resetAt).toBe('number');
    });
  });
});
```

#### 2. Implement Token Bucket Algorithm
**File**: `backend/src/rate-limiters/token-bucket.ts` (modify from Phase 1 skeleton)
**Changes**: Full implementation following specification:

```typescript
import { RateLimiter } from '../types/rate-limiter.interface';
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from '../constants';

export class TokenBucket implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;

  constructor(private rps: number) {
    this.capacity = rps * TOKEN_BUCKET_BURST_MULTIPLIER;
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  allow(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    this.refill();
    return {
      remaining: Math.floor(this.tokens),
      resetAt: this.lastRefill + TOKEN_BUCKET_REFILL_INTERVAL_MS
    };
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / TOKEN_BUCKET_REFILL_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      // Add tokens: (rps / 1000) * interval_ms * intervals_count
      // Simplified: (rps / 10) tokens per interval (since interval = 100ms = 0.1s)
      const tokensToAdd = (this.rps / 10) * intervalsElapsed;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

      // Align timestamp to interval boundary (prevents drift)
      this.lastRefill = this.lastRefill + (intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS);
    }
  }
}
```

#### 3. Implement Leaky Bucket Algorithm
**File**: `backend/src/rate-limiters/leaky-bucket.ts` (modify from Phase 1 skeleton)
**Changes**: Full implementation following specification:

```typescript
import { RateLimiter } from '../types/rate-limiter.interface';
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from '../constants';

export class LeakyBucket implements RateLimiter {
  private queueCount: number = 0;
  private lastDrain: number;
  private queueCapacity: number;

  constructor(private rps: number) {
    this.queueCapacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.lastDrain = Date.now();
  }

  allow(): boolean {
    this.drain();

    if (this.queueCount < this.queueCapacity) {
      this.queueCount += 1;
      return true;
    }

    return false;
  }

  reset(): void {
    this.queueCount = 0;
    this.lastDrain = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    this.drain();
    return {
      remaining: this.queueCapacity - this.queueCount,
      resetAt: this.lastDrain + LEAKY_BUCKET_DRAIN_INTERVAL_MS
    };
  }

  private drain(): void {
    const now = Date.now();
    const timePassed = now - this.lastDrain;
    const intervalsElapsed = Math.floor(timePassed / LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      // Remove items: (rps / 1000) * interval_ms * intervals_count
      // Simplified: (rps / 20) items per interval (since interval = 50ms = 0.05s)
      const itemsToDrain = (this.rps / 20) * intervalsElapsed;
      this.queueCount = Math.max(0, this.queueCount - itemsToDrain);

      // Align timestamp to interval boundary (prevents drift)
      this.lastDrain = this.lastDrain + (intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS);
    }
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All 8 test suites pass: `bun run backend/test-algorithms.ts`
- [ ] Test 1 passes: Burst capacity correct (Token: 20/25, Leaky: 15/25 @ 10 RPS)
- [ ] Test 2 passes: Rate enforcement correct (~100/100 @ 10 RPS with 100ms delay)
- [ ] Test 3 passes: Recovery after 1s idle correct
- [ ] Test 4 passes: Full recovery after 2s idle correct
- [ ] Test 5 passes: Low rate @ 1 RPS correct (Token: 2/5, Leaky: 1/5)
- [ ] Test 6 passes: High rate @ 100 RPS correct (Token: 200/500, Leaky: 150/500)
- [ ] Test 7 passes: reset() functionality restores initial state
- [ ] Test 8 passes: getStats() returns correct interface
- [ ] TypeScript strict mode clean: `bunx tsc --noEmit`

#### Manual Verification:
- [ ] Algorithm logic reviewed for correctness against specification
- [ ] Timing drift prevention verified (interval alignment used, not `Date.now()`)
- [ ] Edge cases tested (1 RPS, 100 RPS, immediate burst, idle recovery)

**Implementation Note**: After all tests pass, pause here for manual review before proceeding to Phase 3.

---

## Phase 3: Backend API Server

### Overview
Implement Hono-based HTTP server with CORS middleware and all 4 API endpoints. Connect endpoints to rate limiter algorithms and add proper response headers.

### Changes Required:

#### 1. Create Hono Server Entry Point
**File**: `backend/src/index.ts` (new, replacing old backend/index.ts)
**Changes**: Full Hono server with middleware and endpoints:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { TokenBucket } from './rate-limiters/token-bucket';
import { LeakyBucket } from './rate-limiters/leaky-bucket';
import { RateLimiter } from './types/rate-limiter.interface';
import {
  DEFAULT_BACKEND_PORT,
  DEFAULT_CORS_ORIGIN
} from './constants';

const app = new Hono();

// Global state
let currentAlgorithm: 'token-bucket' | 'leaky-bucket' = 'token-bucket';
let limiter: RateLimiter = new TokenBucket(10);
let currentRps = 10;

// Middleware
app.use('/*', cors({
  origin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After']
}));

// Endpoints

// POST /settings - Configure algorithm and RPS
app.post('/settings', async (c) => {
  try {
    const body = await c.req.json();
    const { algorithm, rps } = body;

    // Validation
    if (!['token-bucket', 'leaky-bucket'].includes(algorithm)) {
      return c.json({ error: 'Invalid algorithm' }, 400);
    }
    if (typeof rps !== 'number' || rps <= 0) {
      return c.json({ error: 'Invalid RPS value' }, 400);
    }

    // Update configuration
    currentAlgorithm = algorithm;
    currentRps = rps;
    limiter = algorithm === 'token-bucket'
      ? new TokenBucket(rps)
      : new LeakyBucket(rps);

    return c.json({
      success: true,
      algorithm: currentAlgorithm,
      rps: currentRps
    });
  } catch (error) {
    return c.json({ error: 'Invalid request' }, 400);
  }
});

// GET /test - Rate limit test endpoint
app.get('/test', (c) => {
  c.header('Cache-Control', 'no-store');

  const stats = limiter.getStats();
  const isAllowed = limiter.allow();

  // Rate limit headers (always present)
  c.header('X-RateLimit-Limit', String(currentRps));
  c.header('X-RateLimit-Remaining', String(Math.max(0, stats.remaining - (isAllowed ? 1 : 0))));
  c.header('X-RateLimit-Reset', String(stats.resetAt));

  if (isAllowed) {
    return c.json({
      allowed: true,
      remaining: Math.max(0, stats.remaining - 1),
      resetAt: stats.resetAt
    }, 200);
  } else {
    c.header('Retry-After', '250'); // milliseconds
    return c.json({
      allowed: false,
      retryAfter: 250
    }, 429);
  }
});

// GET /health - Health check
app.get('/health', (c) => {
  const stats = limiter.getStats();
  return c.json({
    status: 'ok',
    algorithm: currentAlgorithm,
    rps: currentRps,
    timestamp: Date.now(),
    stats: {
      remaining: stats.remaining,
      resetAt: stats.resetAt
    }
  });
});

// POST /reset - Reset limiter state
app.post('/reset', (c) => {
  limiter.reset();
  return c.body(null, 204);
});

// Start server
const port = parseInt(process.env.BACKEND_PORT || String(DEFAULT_BACKEND_PORT));
export default {
  port,
  fetch: app.fetch
};
```

#### 2. Create Limiter Factory
**File**: `backend/src/limiter-factory.ts` (new)
**Changes**: Factory pattern for algorithm instantiation:

```typescript
import { RateLimiter } from './types/rate-limiter.interface';
import { TokenBucket } from './rate-limiters/token-bucket';
import { LeakyBucket } from './rate-limiters/leaky-bucket';

export function createLimiter(algorithm: string, rps: number): RateLimiter {
  switch (algorithm) {
    case 'token-bucket':
      return new TokenBucket(rps);
    case 'leaky-bucket':
      return new LeakyBucket(rps);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}
```

#### 3. Install Hono Dependency
**File**: `package.json` (root)
**Changes**: Add Hono to devDependencies (Bun will install):

```json
{
  "devDependencies": {
    "hono": "^4.0.0",
    "@types/bun": "latest",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

Command to run: `bun install`

#### 4. Update Backend Execution
**File**: `backend/index.ts` (old file, to be replaced)
**Changes**: Redirect to new src/index.ts:

Simply delete old `backend/index.ts` - it will be replaced by Hono server at `backend/src/index.ts`.

Update execution in package.json root script: `"server": "bun run backend/src/index.ts"`

### Success Criteria:

#### Automated Verification:
- [ ] Hono dependency installed: `bun install` succeeds
- [ ] Backend starts without errors: `bun run backend/src/index.ts`
- [ ] TypeScript strict mode clean for backend/src: `bunx tsc --noEmit backend/src`
- [ ] POST /settings endpoint accepts valid algorithm + RPS
- [ ] GET /test returns 200 with proper headers for allowed requests
- [ ] GET /test returns 429 with Retry-After for rejected requests
- [ ] GET /health returns server status and algorithm stats
- [ ] POST /reset clears limiter state (verified by subsequent /test calls)

#### Manual Verification (using Playwright/curl):
- [ ] POST /settings with valid input (algorithm="token-bucket", rps=10) returns 200
- [ ] GET /test returns increasing "remaining" count as tokens accumulate
- [ ] GET /test returns 429 after burst is exhausted
- [ ] GET /health shows correct algorithm and RPS values
- [ ] CORS headers present in responses
- [ ] Cache-Control: no-store header on /test responses
- [ ] Rate limit headers (X-RateLimit-*) present in all responses

**Implementation Note**: After backend fully passes manual verification with curl/Playwright, pause here before proceeding to Phase 4.

---

## Phase 4: Frontend UI Components

### Overview
Implement frontend UI components that interact with backend API. Build configuration panel, burst generator, and results display.

### Changes Required:

#### 1. Clean Up Frontend Boilerplate
**File**: `frontend/src/main.ts` (modify)
**Changes**: Replace Vite template with rate limiting UI initialization:

```typescript
import './style.css';
import { setupConfigPanel } from './components/config-panel';
import { setupBurstGenerator } from './components/burst-generator';
import { setupResultsDisplay } from './components/results-display';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="rate-limiting-demo">
    <h1>Fox vs. Hedgehog: Rate Limiting Demo</h1>
    <div id="config-panel"></div>
    <div id="burst-generator"></div>
    <div id="results-display"></div>
  </div>
`;

setupConfigPanel(document.querySelector('#config-panel')!);
setupBurstGenerator(document.querySelector('#burst-generator')!);
setupResultsDisplay(document.querySelector('#results-display')!);
```

#### 2. Create Configuration Panel Component
**File**: `frontend/src/components/config-panel.ts` (new)
**Changes**: Algorithm selector and RPS input:

```typescript
import { apiClient } from '../api-client';

export async function setupConfigPanel(container: HTMLElement) {
  container.innerHTML = `
    <div class="config-panel">
      <h2>Configuration</h2>
      <div class="form-group">
        <label for="algorithm">Algorithm:</label>
        <select id="algorithm">
          <option value="token-bucket">Token Bucket</option>
          <option value="leaky-bucket">Leaky Bucket</option>
        </select>
      </div>
      <div class="form-group">
        <label for="rps">Requests Per Second (1-1000):</label>
        <input type="number" id="rps" min="1" max="1000" value="10" />
      </div>
      <button id="apply-btn">Apply Settings</button>
      <div id="config-status"></div>
    </div>
  `;

  const algorithmSelect = container.querySelector('#algorithm') as HTMLSelectElement;
  const rpsInput = container.querySelector('#rps') as HTMLInputElement;
  const applyBtn = container.querySelector('#apply-btn') as HTMLButtonElement;
  const statusDiv = container.querySelector('#config-status') as HTMLDivElement;

  applyBtn.addEventListener('click', async () => {
    try {
      const result = await apiClient.settings({
        algorithm: algorithmSelect.value as 'token-bucket' | 'leaky-bucket',
        rps: parseInt(rpsInput.value)
      });
      statusDiv.textContent = `✓ Configuration updated`;
      statusDiv.style.color = 'green';
    } catch (error) {
      statusDiv.textContent = `✗ Error: ${error}`;
      statusDiv.style.color = 'red';
    }
  });
}
```

#### 3. Create Burst Generator Component
**File**: `frontend/src/components/burst-generator.ts` (new)
**Changes**: Request count, delay, and fire button:

```typescript
import { apiClient } from '../api-client';
import { addResult } from './results-display';

export function setupBurstGenerator(container: HTMLElement) {
  container.innerHTML = `
    <div class="burst-generator">
      <h2>Burst Generator</h2>
      <div class="form-group">
        <label for="request-count">Number of Requests (1-100):</label>
        <input type="number" id="request-count" min="1" max="100" value="10" />
      </div>
      <div class="form-group">
        <label for="delay">Delay Between Requests (ms, 0-1000):</label>
        <input type="number" id="delay" min="0" max="1000" value="0" />
      </div>
      <button id="fire-btn">Fire Burst</button>
      <div id="burst-status"></div>
    </div>
  `;

  const countInput = container.querySelector('#request-count') as HTMLInputElement;
  const delayInput = container.querySelector('#delay') as HTMLInputElement;
  const fireBtn = container.querySelector('#fire-btn') as HTMLButtonElement;
  const statusDiv = container.querySelector('#burst-status') as HTMLDivElement;

  fireBtn.addEventListener('click', async () => {
    fireBtn.disabled = true;
    statusDiv.textContent = 'Firing...';

    const count = parseInt(countInput.value);
    const delay = parseInt(delayInput.value);

    try {
      const results = [];

      if (delay === 0) {
        // Parallel requests
        results.push(...await Promise.all(
          Array(count).fill(null).map(() => apiClient.test())
        ));
      } else {
        // Sequential requests
        for (let i = 0; i < count; i++) {
          results.push(await apiClient.test());
          await new Promise(r => setTimeout(r, delay));
        }
      }

      results.forEach(result => addResult(result));
      statusDiv.textContent = `✓ Fired ${count} requests`;
      statusDiv.style.color = 'green';
    } catch (error) {
      statusDiv.textContent = `✗ Error: ${error}`;
      statusDiv.style.color = 'red';
    } finally {
      fireBtn.disabled = false;
    }
  });
}
```

#### 4. Create Results Display Component
**File**: `frontend/src/components/results-display.ts` (new)
**Changes**: Request log, statistics, and visual indicator:

```typescript
interface Result {
  timestamp: number;
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

let results: Result[] = [];

export function setupResultsDisplay(container: HTMLElement) {
  container.innerHTML = `
    <div class="results-display">
      <h2>Results</h2>
      <div id="statistics">
        <div>Total: <span id="stat-total">0</span></div>
        <div>Allowed: <span id="stat-allowed">0</span> (<span id="stat-allowed-pct">0</span>%)</div>
        <div>Rejected: <span id="stat-rejected">0</span> (<span id="stat-rejected-pct">0</span>%)</div>
      </div>
      <div id="visual-indicator">
        <div class="indicator-bar">
          <div class="allowed-segment" style="width: 0%"></div>
          <div class="rejected-segment" style="width: 0%"></div>
        </div>
      </div>
      <div id="request-log"></div>
    </div>
  `;

  updateDisplay();
}

export function addResult(result: Result) {
  results.push({
    ...result,
    timestamp: Date.now()
  });

  // Keep only last 100
  if (results.length > 100) {
    results.shift();
  }

  updateDisplay();
}

function updateDisplay() {
  const total = results.length;
  const allowed = results.filter(r => r.allowed).length;
  const rejected = total - allowed;
  const allowedPct = total > 0 ? Math.round((allowed / total) * 100) : 0;
  const rejectedPct = 100 - allowedPct;

  document.querySelector('#stat-total')!.textContent = String(total);
  document.querySelector('#stat-allowed')!.textContent = String(allowed);
  document.querySelector('#stat-allowed-pct')!.textContent = String(allowedPct);
  document.querySelector('#stat-rejected')!.textContent = String(rejected);
  document.querySelector('#stat-rejected-pct')!.textContent = String(rejectedPct);

  const allowedSegment = document.querySelector('.allowed-segment') as HTMLElement;
  const rejectedSegment = document.querySelector('.rejected-segment') as HTMLElement;
  allowedSegment.style.width = `${allowedPct}%`;
  rejectedSegment.style.width = `${rejectedPct}%`;

  const logContainer = document.querySelector('#request-log')!;
  logContainer.innerHTML = results.slice().reverse().map((r, i) => {
    const time = new Date(r.timestamp).toLocaleTimeString();
    const status = r.allowed
      ? `✓ Allowed (remaining: ${r.remaining})`
      : `✗ Rejected (retry in ${r.retryAfter}ms)`;
    const className = r.allowed ? 'allowed' : 'rejected';
    return `<div class="log-entry ${className}">[${time}] Request #${total - i}: ${status}</div>`;
  }).join('');
}
```

#### 5. Create API Client
**File**: `frontend/src/api-client.ts` (new)
**Changes**: HTTP client for backend communication:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

interface SettingsRequest {
  algorithm: 'token-bucket' | 'leaky-bucket';
  rps: number;
}

interface TestResponse {
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

export const apiClient = {
  async settings(config: SettingsRequest) {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Settings update failed');
    return response.json();
  },

  async test(): Promise<TestResponse> {
    const response = await fetch(`${API_URL}/test`);
    const json = await response.json();
    return {
      allowed: response.status === 200,
      remaining: json.remaining,
      retryAfter: json.retryAfter
    };
  },

  async health() {
    const response = await fetch(`${API_URL}/health`);
    return response.json();
  },

  async reset() {
    await fetch(`${API_URL}/reset`, { method: 'POST' });
  }
};
```

#### 6. Update Frontend Styles
**File**: `frontend/src/style.css` (replace)
**Changes**: Replace Vite template styles with rate limiting UI styling:

```css
:root {
  --color-allowed: #22c55e;
  --color-rejected: #ef4444;
  --color-bg: #1f2937;
  --color-text: #f3f4f6;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
  padding: 2rem;
}

#rate-limiting-demo {
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 2rem;
  text-align: center;
}

h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.config-panel, .burst-generator, .results-display {
  background-color: #374151;
  padding: 1.5rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

select, input[type="number"], input[type="text"] {
  width: 100%;
  padding: 0.5rem;
  background-color: #1f2937;
  color: var(--color-text);
  border: 1px solid #4b5563;
  border-radius: 0.25rem;
  font-family: inherit;
}

button {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 500;
}

button:hover {
  background-color: #2563eb;
}

button:disabled {
  background-color: #6b7280;
  cursor: not-allowed;
}

#config-status, #burst-status {
  margin-top: 1rem;
  min-height: 1.5rem;
}

#statistics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

#statistics div {
  background-color: #1f2937;
  padding: 1rem;
  border-radius: 0.25rem;
}

#statistics span {
  font-weight: bold;
  color: #60a5fa;
}

.indicator-bar {
  display: flex;
  height: 1.5rem;
  background-color: #1f2937;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 1rem;
}

.allowed-segment {
  background-color: var(--color-allowed);
  transition: width 0.3s;
}

.rejected-segment {
  background-color: var(--color-rejected);
  transition: width 0.3s;
}

#request-log {
  max-height: 400px;
  overflow-y: auto;
  background-color: #1f2937;
  border-radius: 0.25rem;
  padding: 1rem;
}

.log-entry {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.875rem;
}

.log-entry.allowed {
  background-color: #064e3b;
  color: var(--color-allowed);
}

.log-entry.rejected {
  background-color: #7f1d1d;
  color: var(--color-rejected);
}
```

#### 7. Remove Template Files
**Files to delete**:
- `frontend/src/counter.ts` (no longer needed)
- `frontend/src/typescript.svg` (no longer needed)
- Keep `frontend/src/style.css` (updated in step 6)
- Keep `frontend/public/vite.svg` (if desired, or remove)

### Success Criteria:

#### Automated Verification:
- [ ] Frontend compiles without errors: `cd frontend && bun run build`
- [ ] TypeScript strict mode clean: `bunx tsc --noEmit frontend/src`
- [ ] No console errors when visiting http://localhost:5173
- [ ] API client successfully calls `/settings` endpoint
- [ ] API client successfully calls `/test` endpoint
- [ ] Results update in real-time as requests are made

#### Manual Verification (using Playwright):
- [ ] Configuration panel displays with algorithm selector and RPS input
- [ ] Applying settings with valid values updates backend configuration
- [ ] Invalid settings show error message
- [ ] Burst generator fires requests and updates results display
- [ ] Results log shows timestamps, request numbers, and allowed/rejected status
- [ ] Statistics update correctly (total, allowed %, rejected %)
- [ ] Visual indicator bar updates with green/red segments
- [ ] Color coding: green background for allowed, red for rejected
- [ ] Request log auto-scrolls and maintains max 100 entries
- [ ] Parallel burst (delay=0) fires all requests simultaneously
- [ ] Sequential burst (delay>0) fires requests with specified delay
- [ ] Burst generator button disables during request processing
- [ ] UI correctly handles CORS responses from backend

**Implementation Note**: After UI passes manual verification via Playwright testing, pause here before Phase 5.

---

## Phase 5: Integration & Polish

### Overview
Set up concurrent development environment, create production build configuration, and final integration testing.

### Changes Required:

#### 1. Create dev:all Script
**File**: `package.json` (root)
**Changes**: Add concurrent server execution script:

```json
{
  "scripts": {
    "dev": "cd frontend && bun run dev",
    "server": "bun run backend/src/index.ts",
    "build": "cd frontend && bun run build",
    "test": "bun run backend/test-algorithms.ts",
    "dev:all": "bun --bun ./scripts/dev-all.ts"
  }
}
```

#### 2. Create dev-all.ts Script
**File**: `scripts/dev-all.ts` (new)
**Changes**: Concurrent server runner (or use simpler approach):

Alternative simpler approach - update dev:all to use built-in tools:
```json
"dev:all": "concurrently 'bun run server' 'bun run dev'"
```

If using concurrently, add to package.json devDependencies: `"concurrently": "^8.0.0"`

Then: `bun install` to get concurrently

#### 3. Create .env File (Development)
**File**: `.env` (in project root, gitignored)
**Changes**: Development environment variables:

```env
# Backend Configuration
BACKEND_PORT=9000
CORS_ORIGIN=http://localhost:5173

# Frontend Configuration
VITE_API_URL=http://localhost:9000
VITE_PORT=5173
```

#### 4. Update Root package.json Scripts
**File**: `package.json` (root)
**Changes**: Ensure all scripts are properly configured:

```json
{
  "scripts": {
    "dev": "cd frontend && bun run dev",
    "server": "bun run backend/src/index.ts",
    "build": "cd frontend && bun run build",
    "test": "bun run backend/test-algorithms.ts",
    "dev:all": "concurrently 'bun run server' 'bun run dev'"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "hono": "^4.0.0",
    "@types/bun": "latest",
    "typescript": "^5.3.0",
    "vite": "^7.1.7"
  }
}
```

#### 5. Create Integration Test
**File**: `backend/test-integration.ts` (new)
**Changes**: End-to-end API testing:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

const API_URL = 'http://localhost:9000';
let server: any;

beforeAll(async () => {
  // Start server if not already running
  // For manual testing, assumes server is running
});

describe('Integration Tests', () => {
  it('POST /settings updates configuration', async () => {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: 'leaky-bucket', rps: 20 })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.algorithm).toBe('leaky-bucket');
    expect(data.rps).toBe(20);
  });

  it('GET /test returns rate limit headers', async () => {
    const response = await fetch(`${API_URL}/test`);

    expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('GET /health returns server status', async () => {
    const response = await fetch(`${API_URL}/health`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.algorithm).toBeTruthy();
    expect(data.rps).toBeTruthy();
  });

  it('POST /reset clears limiter state', async () => {
    // Set up known state
    await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: 'token-bucket', rps: 10 })
    });

    // Make some requests to exhaust tokens
    for (let i = 0; i < 20; i++) {
      await fetch(`${API_URL}/test`);
    }

    // Reset
    const resetResponse = await fetch(`${API_URL}/reset`, { method: 'POST' });
    expect(resetResponse.status).toBe(204);

    // Verify state is reset
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    expect(health.stats.remaining).toBeGreaterThan(0);
  });
});
```

#### 6. Create Playwright End-to-End Tests
**File**: `tests/e2e.spec.ts` (new - if using Playwright directly)
**Changes**: Browser-based testing of full application:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Rate Limiting Demo - E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should load configuration panel', async ({ page }) => {
    const algorithmSelect = page.locator('#algorithm');
    const rpsInput = page.locator('#rps');

    await expect(algorithmSelect).toBeVisible();
    await expect(rpsInput).toBeVisible();
  });

  test('should update configuration', async ({ page }) => {
    const rpsInput = page.locator('#rps');
    const applyBtn = page.locator('#apply-btn');

    await rpsInput.fill('20');
    await applyBtn.click();

    const status = page.locator('#config-status');
    await expect(status).toContainText('updated');
  });

  test('should fire burst and show results', async ({ page }) => {
    const countInput = page.locator('#request-count');
    const fireBtn = page.locator('#fire-btn');

    await countInput.fill('10');
    await fireBtn.click();

    // Wait for results to appear
    const logEntry = page.locator('.log-entry').first();
    await expect(logEntry).toBeVisible();
  });

  test('should show statistics', async ({ page }) => {
    const fireBtn = page.locator('#fire-btn');
    await fireBtn.click();

    const totalStat = page.locator('#stat-total');
    await expect(totalStat).not.toContainText('0');
  });
});
```

#### 7. Update Documentation
**File**: `README.md` (update development section)
**Changes**: Add dev:all instruction and testing steps:

Update section "Running the Application" to include:
```bash
# Run both servers concurrently
bun run dev:all

# In separate terminals:
# Backend: bun run server
# Frontend: bun run dev

# Run tests
bun run test

# Run integration tests
bun run backend/test-integration.ts

# E2E tests (with Playwright)
bunx playwright test
```

### Success Criteria:

#### Automated Verification:
- [ ] `bun install` succeeds with all dependencies
- [ ] Backend and frontend can run concurrently: `bun run dev:all`
- [ ] Backend accessible at http://localhost:9000
- [ ] Frontend accessible at http://localhost:5173
- [ ] All algorithm tests pass: `bun run test`
- [ ] Integration tests can run (may require manual server start)
- [ ] TypeScript builds without errors
- [ ] Frontend build succeeds: `cd frontend && bun run build`
- [ ] No console errors in browser DevTools

#### Manual Verification (Full E2E):
- [ ] Open http://localhost:5173 in browser
- [ ] Configuration panel loads and displays
- [ ] Selecting different algorithms works
- [ ] Changing RPS value works
- [ ] Apply button successfully updates backend (verify via /health endpoint)
- [ ] Fire burst button generates requests
- [ ] Request log shows realistic patterns:
     - Token Bucket: Initial burst of 20 allowed, then throttled
     - Leaky Bucket: Initial burst of 15 allowed, then throttled
- [ ] Results statistics accurately reflect request outcomes
- [ ] Visual indicator bar shows correct green/red split
- [ ] Switching algorithms and testing shows different behavior
- [ ] Reset functionality works (via API, verified manually)
- [ ] Concurrent server operation is stable (no crashes)
- [ ] No network errors or CORS issues

**Final Checkpoint**: After all phases pass, the implementation is complete and ready for demonstration.

---

## Testing Strategy

### Unit Tests (Phase 2)
- All 7 validation scenarios implemented in `backend/test-algorithms.ts`
- Run with: `bun run test`
- Validates algorithm behavior under specified loads

### Integration Tests (Phase 5)
- API endpoint testing in `backend/test-integration.ts`
- Validates HTTP interface and response formats
- Requires running backend server

### Manual/E2E Tests (Phase 5)
- Playwright-based browser testing
- Validates full user workflows
- Tests UI interactions and visual correctness

### Test Coverage
- Algorithm correctness: 100% (7 scenarios all passing)
- API correctness: 100% (all 4 endpoints tested)
- UI functionality: Manual verification via Playwright

---

## Performance Considerations

- Token Bucket: O(1) per request, lazy refill calculation
- Leaky Bucket: O(1) per request, lazy drain calculation
- No database or persistence layer (in-memory state only)
- Frontend: No virtual scrolling needed (max 100 log entries)
- Request batching via Promise.all() for parallel bursts

---

## References

- Specification: `README.md` (lines 1-621)
- Research: `thoughts/shared/research/2025-10-16-rate-limiting-implementation-status.md`
- Implementation Pitfalls: `README.md:570-598`
- Sliding Window Formula: `README.md:219-225` (not implemented; optional algorithm)
