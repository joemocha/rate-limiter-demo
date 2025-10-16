# Rate Limiting Demo Implementation Plan

## Overview

Implement a fully functional rate limiting demonstration application with Token Bucket and Leaky Bucket algorithms, following TDD principles. The application will showcase contrasting rate limiting strategies through a Hono backend API and vanilla TypeScript frontend interface.

## Current State Analysis

The project exists as a comprehensive specification (README.md) with minimal implementation:
- Backend: 16-line stub server at `backend/index.ts:1-16`
- Frontend: Vite template files in `frontend/src/`
- No rate limiting algorithms implemented
- No API endpoints or UI components
- TypeScript and Bun runtime configured

## Desired End State

A working demo application where users can:
- Switch between Token Bucket and Leaky Bucket algorithms via UI
- Configure requests per second (RPS) dynamically
- Fire test bursts with configurable patterns
- Visualize allow/reject decisions in real-time
- Observe behavioral differences between algorithms

### Key Discoveries:
- Hono requires middleware (CORS) before route definitions
- Bun has built-in test runner with Jest-compatible syntax
- TypeScript strict mode already enabled project-wide
- Monorepo structure with separate frontend/backend directories

## What We're NOT Doing

- Not implementing optional algorithms (Fixed Window, Sliding Window, Sliding Log)
- Not adding external state management libraries
- Not using frontend frameworks (staying vanilla TypeScript)
- Not adding production security features (local-only app)
- Not implementing user authentication or multi-tenancy
- Not adding database persistence

## Implementation Approach

Follow test-driven development with incremental phases, using proactive agents for validation:
1. Write tests first for each component
2. Implement minimal code to pass tests
3. Use specialized agents to verify correctness
4. Build from core algorithms outward to UI

## Phase 1: Test Infrastructure & Algorithm Core

### Overview
Establish test framework and implement both rate limiting algorithms with comprehensive test coverage.

### Changes Required:

#### 1. Create Backend Package Configuration
**File**: `backend/package.json`
**Changes**: Create new package.json with Hono dependency

```json
{
  "name": "rate-limiting-backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

#### 2. Create Directory Structure
**Action**: Create backend source directories
```bash
mkdir -p backend/src/rate-limiters backend/src/types
```

#### 3. Define RateLimiter Interface
**File**: `backend/src/types/rate-limiter.interface.ts`
**Changes**: Create interface definition

```typescript
export interface RateLimiter {
  allow(): boolean;
  reset(): void;
  getStats(): { remaining: number; resetAt: number };
}
```

#### 4. Create Algorithm Constants
**File**: `backend/src/constants.ts`
**Changes**: Define tuning parameters

```typescript
// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;
```

#### 5. Write Algorithm Tests
**File**: `backend/test-algorithms.ts`
**Changes**: Create comprehensive test suite

```typescript
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

  // Additional tests per specification...
});

describe("Leaky Bucket Algorithm", () => {
  // Similar comprehensive test suite
});
```

#### 6. Implement Token Bucket Algorithm
**File**: `backend/src/rate-limiters/token-bucket.ts`
**Changes**: Implement with lazy evaluation

```typescript
import { RateLimiter } from "../types/rate-limiter.interface";
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from "../constants";

export class TokenBucket implements RateLimiter {
  private tokens: number;
  private capacity: number;
  private lastRefill: number;
  private refillRate: number;

  constructor(private rps: number) {
    this.capacity = Math.floor(rps * TOKEN_BUCKET_BURST_MULTIPLIER);
    this.tokens = this.capacity; // Start full
    this.lastRefill = Date.now();
    this.refillRate = rps;
  }

  allow(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
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
    const elapsed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(elapsed / TOKEN_BUCKET_REFILL_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      const tokensToAdd = (this.refillRate / 1000) * (intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS);
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill += intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS;
    }
  }
}
```

#### 7. Implement Leaky Bucket Algorithm
**File**: `backend/src/rate-limiters/leaky-bucket.ts`
**Changes**: Implement with queue simulation

```typescript
import { RateLimiter } from "../types/rate-limiter.interface";
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from "../constants";

export class LeakyBucket implements RateLimiter {
  private queueCount: number = 0;
  private queueCapacity: number;
  private lastDrain: number;
  private drainRate: number;

  constructor(private rps: number) {
    this.queueCapacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.lastDrain = Date.now();
    this.drainRate = rps;
  }

  allow(): boolean {
    this.drain();
    if (this.queueCount < this.queueCapacity) {
      this.queueCount++;
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
    const elapsed = now - this.lastDrain;
    const intervalsElapsed = Math.floor(elapsed / LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      const itemsToDrain = Math.floor((this.drainRate / 1000) * (intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS));
      this.queueCount = Math.max(0, this.queueCount - itemsToDrain);
      this.lastDrain += intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS;
    }
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend dependencies installed: `cd backend && bun install`
- [ ] All algorithm tests pass: `bun run backend/test-algorithms.ts`
- [ ] TypeScript compilation succeeds: `bun run backend/src/rate-limiters/token-bucket.ts`
- [ ] Proactive agent: Use **debugger** agent to verify test execution

#### Manual Verification:
- [ ] Test output shows correct pass/fail ratios for each algorithm
- [ ] Token Bucket allows 20/25 burst at 10 RPS
- [ ] Leaky Bucket allows 15/25 burst at 10 RPS

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Backend API Foundation

### Overview
Implement Hono server with four API endpoints, CORS configuration, and rate limiter factory.

### Changes Required:

#### 1. Create Limiter Factory
**File**: `backend/src/limiter-factory.ts`
**Changes**: Factory for algorithm instantiation

```typescript
import { RateLimiter } from "./types/rate-limiter.interface";
import { TokenBucket } from "./rate-limiters/token-bucket";
import { LeakyBucket } from "./rate-limiters/leaky-bucket";

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

#### 2. Implement Hono Backend
**File**: `backend/src/index.ts`
**Changes**: Replace stub with full implementation

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { LimiterFactory, AlgorithmType } from "./limiter-factory";
import { RateLimiter } from "./types/rate-limiter.interface";

const app = new Hono();

// Global state
let currentAlgorithm: AlgorithmType = "token-bucket";
let currentRps = 10;
let rateLimiter: RateLimiter = LimiterFactory.create(currentAlgorithm, currentRps);

// CORS must come before routes
app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  })
);

// POST /settings
app.post("/settings", async (c) => {
  try {
    const body = await c.req.json<{ algorithm: AlgorithmType; rps: number }>();

    // Validation
    if (!["token-bucket", "leaky-bucket"].includes(body.algorithm)) {
      return c.json({ error: "Invalid algorithm or RPS value" }, 400);
    }
    if (typeof body.rps !== "number" || body.rps <= 0) {
      return c.json({ error: "Invalid algorithm or RPS value" }, 400);
    }

    // Update configuration
    currentAlgorithm = body.algorithm;
    currentRps = body.rps;
    rateLimiter = LimiterFactory.create(currentAlgorithm, currentRps);

    return c.json({
      success: true,
      algorithm: currentAlgorithm,
      rps: currentRps,
    });
  } catch (error) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

// GET /test
app.get("/test", (c) => {
  const allowed = rateLimiter.allow();
  const stats = rateLimiter.getStats();

  // Set rate limit headers
  c.header("X-RateLimit-Limit", currentRps.toString());
  c.header("X-RateLimit-Remaining", stats.remaining.toString());
  c.header("X-RateLimit-Reset", stats.resetAt.toString());
  c.header("Cache-Control", "no-store");

  if (!allowed) {
    const retryAfter = Math.max(0, stats.resetAt - Date.now());
    c.header("Retry-After", Math.ceil(retryAfter / 1000).toString());

    return c.json(
      {
        allowed: false,
        retryAfter,
      },
      429
    );
  }

  return c.json({
    allowed: true,
    remaining: stats.remaining,
    resetAt: stats.resetAt,
  });
});

// GET /health
app.get("/health", (c) => {
  const stats = rateLimiter.getStats();

  return c.json({
    status: "ok",
    algorithm: currentAlgorithm,
    rps: currentRps,
    timestamp: Date.now(),
    stats: {
      remaining: stats.remaining,
      resetAt: stats.resetAt,
    },
  });
});

// POST /reset
app.post("/reset", (c) => {
  rateLimiter.reset();
  return c.text("", 204);
});

export default {
  port: 9000,
  fetch: app.fetch,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend compiles: `cd backend && bun run src/index.ts --dry-run`
- [ ] Server starts: `cd backend && bun run dev`
- [ ] Health check responds: `curl http://localhost:9000/health`
- [ ] Proactive agent: Use **qa-engineer** agent to test all endpoints

#### Manual Verification:
- [ ] POST /settings accepts valid algorithm/RPS combinations
- [ ] GET /test returns proper allow/reject responses
- [ ] Rate limit headers are present in responses
- [ ] POST /reset clears limiter state

---

## Phase 3: Frontend User Interface

### Overview
Build functional UI components for algorithm configuration, burst generation, and results visualization.

### Changes Required:

#### 1. Update Frontend HTML Structure
**File**: `frontend/index.html`
**Changes**: Replace template with application structure

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rate Limiting Demo - Fox vs Hedgehog</title>
  </head>
  <body>
    <div id="app">
      <h1>Rate Limiting Demo</h1>

      <section id="config-panel" class="panel">
        <h2>Configuration</h2>
        <div class="form-group">
          <label for="algorithm">Algorithm:</label>
          <select id="algorithm">
            <option value="token-bucket">Token Bucket</option>
            <option value="leaky-bucket">Leaky Bucket</option>
          </select>
        </div>
        <div class="form-group">
          <label for="rps">Requests Per Second:</label>
          <input type="number" id="rps" min="1" max="1000" value="10" />
        </div>
        <button id="apply-config">Apply Configuration</button>
        <div id="config-status"></div>
      </section>

      <section id="burst-panel" class="panel">
        <h2>Burst Generator</h2>
        <div class="form-group">
          <label for="request-count">Number of Requests:</label>
          <input type="number" id="request-count" min="1" max="100" value="10" />
        </div>
        <div class="form-group">
          <label for="request-delay">Delay Between Requests (ms):</label>
          <input type="number" id="request-delay" min="0" max="1000" value="0" />
        </div>
        <button id="fire-burst">Fire Burst</button>
      </section>

      <section id="results-panel" class="panel">
        <h2>Results</h2>
        <div id="statistics">
          <div>Total: <span id="stat-total">0</span></div>
          <div>Allowed: <span id="stat-allowed">0</span> (<span id="stat-allowed-pct">0%</span>)</div>
          <div>Rejected: <span id="stat-rejected">0</span> (<span id="stat-rejected-pct">0%</span>)</div>
        </div>
        <div id="progress-bar">
          <div id="progress-allowed"></div>
          <div id="progress-rejected"></div>
        </div>
        <div id="request-log"></div>
      </section>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

#### 2. Implement Frontend Logic
**File**: `frontend/src/main.ts`
**Changes**: Replace template with application logic

```typescript
import './style.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// State
let statistics = {
  total: 0,
  allowed: 0,
  rejected: 0,
};

// DOM Elements
const algorithmSelect = document.querySelector<HTMLSelectElement>('#algorithm')!;
const rpsInput = document.querySelector<HTMLInputElement>('#rps')!;
const applyConfigBtn = document.querySelector<HTMLButtonElement>('#apply-config')!;
const configStatus = document.querySelector<HTMLDivElement>('#config-status')!;
const requestCountInput = document.querySelector<HTMLInputElement>('#request-count')!;
const requestDelayInput = document.querySelector<HTMLInputElement>('#request-delay')!;
const fireBurstBtn = document.querySelector<HTMLButtonElement>('#fire-burst')!;
const requestLog = document.querySelector<HTMLDivElement>('#request-log')!;

// Apply Configuration
applyConfigBtn.addEventListener('click', async () => {
  const algorithm = algorithmSelect.value;
  const rps = parseInt(rpsInput.value);

  try {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, rps }),
    });

    const data = await response.json();
    if (response.ok) {
      configStatus.textContent = `✓ Applied: ${data.algorithm} @ ${data.rps} RPS`;
      configStatus.className = 'success';
    } else {
      configStatus.textContent = `✗ Error: ${data.error}`;
      configStatus.className = 'error';
    }
  } catch (error) {
    configStatus.textContent = `✗ Network error`;
    configStatus.className = 'error';
  }
});

// Fire Burst
fireBurstBtn.addEventListener('click', async () => {
  const count = parseInt(requestCountInput.value);
  const delay = parseInt(requestDelayInput.value);

  fireBurstBtn.disabled = true;
  clearLog();
  resetStatistics();

  if (delay === 0) {
    // Parallel requests
    const promises = Array.from({ length: count }, (_, i) =>
      testRequest(i + 1)
    );
    await Promise.all(promises);
  } else {
    // Sequential requests with delay
    for (let i = 0; i < count; i++) {
      await testRequest(i + 1);
      if (i < count - 1) {
        await sleep(delay);
      }
    }
  }

  fireBurstBtn.disabled = false;
});

async function testRequest(requestNum: number): Promise<void> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${API_URL}/test`);
    const data = await response.json();
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    if (data.allowed) {
      logRequest(
        `[${timestamp}] Request #${requestNum}: ✓ Allowed (remaining: ${data.remaining})`,
        'allowed'
      );
      updateStatistics('allowed');
    } else {
      logRequest(
        `[${timestamp}] Request #${requestNum}: ✗ Rejected (retry in ${data.retryAfter}ms)`,
        'rejected'
      );
      updateStatistics('rejected');
    }
  } catch (error) {
    logRequest(`Request #${requestNum}: Network error`, 'error');
  }
}

function logRequest(message: string, type: 'allowed' | 'rejected' | 'error'): void {
  const entry = document.createElement('div');
  entry.textContent = message;
  entry.className = `log-entry ${type}`;
  requestLog.insertBefore(entry, requestLog.firstChild);

  // Keep only last 100 entries
  while (requestLog.children.length > 100) {
    requestLog.removeChild(requestLog.lastChild!);
  }
}

function updateStatistics(result: 'allowed' | 'rejected'): void {
  statistics.total++;
  statistics[result]++;

  // Update DOM
  document.querySelector('#stat-total')!.textContent = statistics.total.toString();
  document.querySelector('#stat-allowed')!.textContent = statistics.allowed.toString();
  document.querySelector('#stat-rejected')!.textContent = statistics.rejected.toString();

  const allowedPct = statistics.total > 0 ? (statistics.allowed / statistics.total * 100).toFixed(1) : '0';
  const rejectedPct = statistics.total > 0 ? (statistics.rejected / statistics.total * 100).toFixed(1) : '0';

  document.querySelector('#stat-allowed-pct')!.textContent = `${allowedPct}%`;
  document.querySelector('#stat-rejected-pct')!.textContent = `${rejectedPct}%`;

  // Update progress bar
  const progressAllowed = document.querySelector<HTMLDivElement>('#progress-allowed')!;
  const progressRejected = document.querySelector<HTMLDivElement>('#progress-rejected')!;

  progressAllowed.style.width = `${allowedPct}%`;
  progressRejected.style.width = `${rejectedPct}%`;
}

function resetStatistics(): void {
  statistics = { total: 0, allowed: 0, rejected: 0 };
  updateStatistics('allowed'); // Trigger UI update
  statistics.allowed = 0; // Reset after UI update
}

function clearLog(): void {
  requestLog.innerHTML = '';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  // Fetch initial health status
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    algorithmSelect.value = data.algorithm;
    rpsInput.value = data.rps.toString();
    configStatus.textContent = `Connected: ${data.algorithm} @ ${data.rps} RPS`;
    configStatus.className = 'success';
  } catch (error) {
    configStatus.textContent = 'Cannot connect to backend';
    configStatus.className = 'error';
  }
});
```

#### 3. Update Styles
**File**: `frontend/src/style.css`
**Changes**: Application-specific styling

```css
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #213547;
  background-color: #ffffff;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  margin-bottom: 2rem;
  color: #1a1a1a;
}

.panel {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border: 1px solid #e0e0e0;
}

.panel h2 {
  margin-bottom: 1rem;
  color: #333;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: inline-block;
  width: 200px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
}

button:hover:not(:disabled) {
  background: #0056b3;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

#config-status {
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
}

#config-status.success {
  color: #155724;
  background: #d4edda;
}

#config-status.error {
  color: #721c24;
  background: #f8d7da;
}

#statistics {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

#statistics div {
  font-weight: 500;
}

#progress-bar {
  display: flex;
  height: 30px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

#progress-allowed {
  background: #28a745;
  transition: width 0.3s;
}

#progress-rejected {
  background: #dc3545;
  transition: width 0.3s;
}

#request-log {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem;
  background: white;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.log-entry {
  padding: 0.25rem;
  border-bottom: 1px solid #f0f0f0;
}

.log-entry.allowed {
  color: #155724;
}

.log-entry.rejected {
  color: #721c24;
}

.log-entry.error {
  color: #856404;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds: `cd frontend && bun run build`
- [ ] TypeScript compiles: `cd frontend && bun run build`
- [ ] Proactive agent: Use **ux-designer** agent to review UI implementation

#### Manual Verification:
- [ ] Configuration panel updates backend settings
- [ ] Burst generator fires requests correctly
- [ ] Results display shows real-time statistics
- [ ] Request log displays with proper formatting
- [ ] Progress bar visualizes allow/reject ratio

---

## Phase 4: Integration & Validation

### Overview
Connect all components, run comprehensive tests, and validate against specification requirements using proactive agents.

### Changes Required:

#### 1. Add Concurrent Run Script
**File**: `package.json` (root)
**Changes**: Add script for running both servers

```json
{
  "name": "rate-limiting-demo",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "cd frontend && bun run dev",
    "server": "cd backend && bun run dev",
    "build": "cd frontend && bun run build",
    "dev:all": "bun run server & bun run dev",
    "test": "bun run backend/test-algorithms.ts"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

#### 2. Create Integration Test
**File**: `test-integration.ts`
**Changes**: End-to-end validation

```typescript
import { test, describe, expect } from "bun:test";

const API_URL = "http://localhost:9000";

describe("End-to-End Integration", () => {
  test("Health check returns correct status", async () => {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.algorithm).toBeOneOf(["token-bucket", "leaky-bucket"]);
  });

  test("Settings endpoint updates configuration", async () => {
    const response = await fetch(`${API_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        algorithm: "token-bucket",
        rps: 5
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.rps).toBe(5);
  });

  test("Test endpoint enforces rate limits", async () => {
    // Set low rate
    await fetch(`${API_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ algorithm: "token-bucket", rps: 2 })
    });

    // Reset to start fresh
    await fetch(`${API_URL}/reset`, { method: "POST" });

    // Fire 10 requests
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${API_URL}/test`))
    );

    const allowed = results.filter(r => r.status === 200).length;
    const rejected = results.filter(r => r.status === 429).length;

    // Token bucket at 2 RPS should allow 4 (2 * 2.0 multiplier)
    expect(allowed).toBe(4);
    expect(rejected).toBe(6);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] Both servers start: `bun run dev:all`
- [ ] Algorithm tests pass: `bun test backend/test-algorithms.ts`
- [ ] Integration tests pass: `bun test test-integration.ts`
- [ ] Proactive agent: Use **qa-engineer** agent to run comprehensive test suite
- [ ] Proactive agent: Use **debugger** agent to troubleshoot any failures
- [ ] Proactive agent: Use **code-reviewer** agent to review implementation

#### Manual Verification:
- [ ] Frontend connects to backend successfully
- [ ] Algorithm switching works correctly
- [ ] Burst patterns show expected behavior per specification
- [ ] Token Bucket allows 20/25 burst at 10 RPS
- [ ] Leaky Bucket allows 15/25 burst at 10 RPS
- [ ] Recovery behavior matches specification

**Implementation Note**: Use the **whimsy-injector** agent after completion to add delightful UI touches.

---

## Testing Strategy

### Unit Tests:
- Algorithm behavior validation (6 test scenarios per README)
- Factory instantiation tests
- Edge cases (0 RPS, very high RPS)

### Integration Tests:
- API endpoint functionality
- CORS header verification
- Rate limit header accuracy
- Algorithm switching

### Manual Testing Steps:
1. Start both servers: `bun run dev:all`
2. Open browser to http://localhost:5173
3. Configure Token Bucket at 10 RPS
4. Fire 25 instant requests - verify 20 allowed
5. Switch to Leaky Bucket at 10 RPS
6. Fire 25 instant requests - verify 15 allowed
7. Test sustained load patterns
8. Verify recovery after exhaustion

## Performance Considerations

- Lazy evaluation in algorithms prevents drift
- O(1) memory for both algorithms
- No database queries or external dependencies
- Frontend limits log to 100 entries to prevent memory growth
- Interval-based calculations for precise timing

## Migration Notes

Not applicable - greenfield implementation

## References

- Original specification: `README.md`
- Research document: `thoughts/shared/research/2025-10-16-rate-limiting-implementation.md`
- Hono documentation: https://hono.dev/docs/
- Bun test documentation: https://bun.com/docs/cli/test