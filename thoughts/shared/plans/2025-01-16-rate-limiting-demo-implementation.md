# Rate Limiting Demo Implementation Plan

## Overview

Implement a functional rate limiting demonstration application with Token Bucket and Leaky Bucket algorithms, exposing configuration and testing endpoints through a Hono backend, with a vanilla TypeScript frontend for interactive testing.

## Current State Analysis

The project exists as minimal scaffolding:
- Backend: Basic Bun server stub at `backend/index.ts:1-16` without Hono framework
- Frontend: Vite template at `frontend/src/main.ts:1-24` with counter example
- No rate limiting algorithms implemented
- No API endpoints or CORS configuration
- Hono dependency not installed

### Key Discoveries:
- TypeScript strict mode enabled across project (`tsconfig.json:10`)
- Bun runtime configured for backend (`package.json:7`)
- Vite dev server configured for frontend (`frontend/package.json:7`)
- Port 9000 designated for backend (`backend/index.ts:3`)

## Desired End State

A fully functional rate limiting demo where users can:
- Switch between Token Bucket and Leaky Bucket algorithms via UI
- Configure requests per second (1-1000 RPS)
- Fire bursts of test requests with configurable delays
- View real-time results with color-coded success/failure indicators
- See statistics and remaining capacity

### Verification:
- Backend serves API on port 9000 with CORS enabled
- Frontend runs on port 5173 and connects to backend
- Both algorithms correctly enforce rate limits
- UI displays accurate statistics and visual feedback

## What We're NOT Doing

- Optional algorithms (Fixed Window, Sliding Window, Sliding Log)
- Performance benchmarking or metrics collection
- Production optimizations or database persistence
- Authentication or multi-tenant support
- WebSocket real-time updates
- React/Vue/other frameworks (vanilla TypeScript only)

## Implementation Approach

Build backend-first with testable API endpoints, then create frontend UI to interact with the rate limiting system. Each phase produces working functionality that can be verified independently.

## Phase 1: Backend Foundation & Hono Setup

### Overview
Establish backend structure, install Hono framework, and create basic server with CORS configuration.

### Changes Required:

#### 1. Backend Package Configuration
**File**: `backend/package.json` (create new)
**Changes**: Create package.json with Hono dependency

```json
{
  "name": "rate-limiting-backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

#### 2. Backend Directory Structure
**Action**: Create directory structure
```bash
mkdir -p backend/src/rate-limiters
```

#### 3. Hono Server Setup
**File**: `backend/src/index.ts` (create new)
**Changes**: Implement Hono server with CORS

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS configuration
app.use('*', cors({
  origin: 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

export default {
  port: 9000,
  fetch: app.fetch,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend dependencies install: `cd backend && bun install`
- [ ] Backend starts without errors: `cd backend && bun run dev`
- [ ] Health endpoint responds: `curl http://localhost:9000/health`
- [ ] TypeScript compiles: `cd backend && bun run src/index.ts`

#### Manual Verification:
- [ ] CORS headers present when accessed from frontend origin
- [ ] Server handles requests on port 9000
- [ ] No TypeScript errors in IDE

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Rate Limiter Algorithm Implementation

### Overview
Implement Token Bucket and Leaky Bucket algorithms with common interface, configuration constants, and factory pattern.

### Changes Required:

#### 1. Configuration Constants
**File**: `backend/src/constants.ts` (create new)
**Changes**: Define tunable parameters

```typescript
// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;      // Burst capacity = rps × multiplier
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;    // Token addition frequency

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;      // Queue depth = rps × multiplier
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;      // Request processing tick rate
```

#### 2. Base Rate Limiter Interface
**File**: `backend/src/rate-limiters/base.ts` (create new)
**Changes**: Define common interface

```typescript
export abstract class RateLimiter {
  protected rps: number;

  constructor(rps: number) {
    this.rps = rps;
  }

  abstract allow(): boolean;
  abstract reset(): void;
  abstract getStats(): { remaining: number; resetAt: number };
}
```

#### 3. Token Bucket Implementation
**File**: `backend/src/rate-limiters/token-bucket.ts` (create new)
**Changes**: Implement token bucket algorithm

```typescript
import { RateLimiter } from './base';
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from '../constants';

export class TokenBucket extends RateLimiter {
  private capacity: number;
  private tokens: number;
  private lastRefill: number;
  private refillRate: number;

  constructor(rps: number) {
    super(rps);
    this.capacity = Math.floor(rps * TOKEN_BUCKET_BURST_MULTIPLIER);
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.refillRate = rps / (1000 / TOKEN_BUCKET_REFILL_INTERVAL_MS);
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
      resetAt: Date.now() + TOKEN_BUCKET_REFILL_INTERVAL_MS
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / TOKEN_BUCKET_REFILL_INTERVAL_MS) * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

#### 4. Leaky Bucket Implementation
**File**: `backend/src/rate-limiters/leaky-bucket.ts` (create new)
**Changes**: Implement leaky bucket algorithm

```typescript
import { RateLimiter } from './base';
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from '../constants';

export class LeakyBucket extends RateLimiter {
  private queueSize: number;
  private queue: number[];
  private lastDrain: number;
  private drainRate: number;

  constructor(rps: number) {
    super(rps);
    this.queueSize = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.queue = [];
    this.lastDrain = Date.now();
    this.drainRate = rps / (1000 / LEAKY_BUCKET_DRAIN_INTERVAL_MS);
  }

  allow(): boolean {
    this.drain();

    if (this.queue.length < this.queueSize) {
      this.queue.push(Date.now());
      return true;
    }
    return false;
  }

  reset(): void {
    this.queue = [];
    this.lastDrain = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    this.drain();
    return {
      remaining: this.queueSize - this.queue.length,
      resetAt: this.queue.length > 0 ?
        this.queue[0] + LEAKY_BUCKET_DRAIN_INTERVAL_MS :
        Date.now() + LEAKY_BUCKET_DRAIN_INTERVAL_MS
    };
  }

  private drain(): void {
    const now = Date.now();
    const elapsed = now - this.lastDrain;
    const itemsToDrain = Math.floor((elapsed / LEAKY_BUCKET_DRAIN_INTERVAL_MS) * this.drainRate);

    if (itemsToDrain > 0) {
      this.queue = this.queue.slice(itemsToDrain);
      this.lastDrain = now;
    }
  }
}
```

#### 5. Limiter Factory
**File**: `backend/src/limiter-factory.ts` (create new)
**Changes**: Create factory for algorithm instantiation

```typescript
import { RateLimiter } from './rate-limiters/base';
import { TokenBucket } from './rate-limiters/token-bucket';
import { LeakyBucket } from './rate-limiters/leaky-bucket';

export type AlgorithmType = 'token-bucket' | 'leaky-bucket';

export function createRateLimiter(algorithm: AlgorithmType, rps: number): RateLimiter {
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

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `cd backend && bun run src/index.ts`
- [ ] Unit test for Token Bucket (create simple test file and run)
- [ ] Unit test for Leaky Bucket (create simple test file and run)

#### Manual Verification:
- [ ] Token Bucket allows burst up to capacity
- [ ] Leaky Bucket smooths request rate
- [ ] Reset methods clear state correctly
- [ ] Stats return accurate remaining capacity

---

## Phase 3: API Endpoints Implementation

### Overview
Implement POST /settings and GET /test endpoints with validation, rate limiting logic, and proper headers.

### Changes Required:

#### 1. Update Hono Server with Endpoints
**File**: `backend/src/index.ts`
**Changes**: Add API endpoints and state management

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRateLimiter, type AlgorithmType } from './limiter-factory';
import type { RateLimiter } from './rate-limiters/base';

const app = new Hono();

// Global state
let currentAlgorithm: AlgorithmType = 'token-bucket';
let currentRPS = 10;
let rateLimiter: RateLimiter = createRateLimiter(currentAlgorithm, currentRPS);

// CORS configuration
app.use('*', cors({
  origin: 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  credentials: true,
}));

// POST /settings - Configure rate limiter
app.post('/settings', async (c) => {
  const body = await c.req.json();

  // Validation
  const validAlgorithms = ['token-bucket', 'leaky-bucket'];
  if (!validAlgorithms.includes(body.algorithm)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }

  if (typeof body.rps !== 'number' || body.rps <= 0 || body.rps > 1000) {
    return c.json({ error: 'Invalid RPS value (must be 1-1000)' }, 400);
  }

  // Update configuration
  currentAlgorithm = body.algorithm as AlgorithmType;
  currentRPS = body.rps;
  rateLimiter = createRateLimiter(currentAlgorithm, currentRPS);

  return c.json({
    success: true,
    algorithm: currentAlgorithm,
    rps: currentRPS
  });
});

// GET /test - Test rate limiting
app.get('/test', (c) => {
  const allowed = rateLimiter.allow();
  const stats = rateLimiter.getStats();

  // Set rate limit headers
  c.header('X-RateLimit-Limit', currentRPS.toString());
  c.header('X-RateLimit-Remaining', stats.remaining.toString());
  c.header('X-RateLimit-Reset', stats.resetAt.toString());
  c.header('Cache-Control', 'no-store');

  if (allowed) {
    return c.json({
      allowed: true,
      remaining: stats.remaining,
      resetAt: stats.resetAt
    });
  } else {
    const retryAfter = Math.max(1, Math.ceil((stats.resetAt - Date.now()) / 1000));
    c.header('Retry-After', retryAfter.toString());

    return c.json({
      allowed: false,
      retryAfter: stats.resetAt - Date.now()
    }, 429);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    algorithm: currentAlgorithm,
    rps: currentRPS,
    timestamp: Date.now()
  });
});

export default {
  port: 9000,
  fetch: app.fetch,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend starts: `cd backend && bun run dev`
- [ ] POST /settings accepts valid config: `curl -X POST http://localhost:9000/settings -H "Content-Type: application/json" -d '{"algorithm":"token-bucket","rps":10}'`
- [ ] POST /settings rejects invalid algorithm: `curl -X POST http://localhost:9000/settings -H "Content-Type: application/json" -d '{"algorithm":"invalid","rps":10}'`
- [ ] GET /test returns 200 or 429: `curl -i http://localhost:9000/test`
- [ ] Response headers present: `curl -I http://localhost:9000/test | grep X-RateLimit`

#### Manual Verification:
- [ ] Rate limiting enforces configured RPS
- [ ] Algorithm switch changes behavior
- [ ] Headers update correctly with remaining capacity
- [ ] 429 responses include Retry-After header

---

## Phase 4: Frontend UI Implementation

### Overview
Build configuration panel, burst generator, and results display with vanilla TypeScript.

### Changes Required:

#### 1. HTML Structure
**File**: `frontend/index.html`
**Changes**: Replace boilerplate with application structure

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Rate Limiting Demo</title>
  </head>
  <body>
    <div id="app">
      <h1>Rate Limiting Demo</h1>

      <div class="panel" id="config-panel">
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
        <button id="apply-config">Apply Settings</button>
        <div id="config-status"></div>
      </div>

      <div class="panel" id="burst-panel">
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
      </div>

      <div class="panel" id="results-panel">
        <h2>Results</h2>
        <div id="stats">
          <div>Total: <span id="total-requests">0</span></div>
          <div>Allowed: <span id="allowed-requests">0</span> (<span id="allowed-percent">0</span>%)</div>
          <div>Rejected: <span id="rejected-requests">0</span> (<span id="rejected-percent">0</span>%)</div>
          <div>Current: <span id="current-config">-</span></div>
        </div>
        <div id="progress-bar">
          <div id="progress-allowed"></div>
          <div id="progress-rejected"></div>
        </div>
        <div id="request-log"></div>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

#### 2. TypeScript Application Logic
**File**: `frontend/src/main.ts`
**Changes**: Replace template with application logic

```typescript
import './style.css';

const API_BASE = 'http://localhost:9000';

// State
let totalRequests = 0;
let allowedRequests = 0;
let rejectedRequests = 0;
const requestLog: string[] = [];

// DOM Elements
const algorithmSelect = document.getElementById('algorithm') as HTMLSelectElement;
const rpsInput = document.getElementById('rps') as HTMLInputElement;
const applyButton = document.getElementById('apply-config') as HTMLButtonElement;
const configStatus = document.getElementById('config-status') as HTMLDivElement;
const requestCountInput = document.getElementById('request-count') as HTMLInputElement;
const requestDelayInput = document.getElementById('request-delay') as HTMLInputElement;
const fireButton = document.getElementById('fire-burst') as HTMLButtonElement;
const requestLogDiv = document.getElementById('request-log') as HTMLDivElement;

// Configuration
applyButton.addEventListener('click', async () => {
  const config = {
    algorithm: algorithmSelect.value,
    rps: parseInt(rpsInput.value)
  };

  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (response.ok) {
      configStatus.textContent = `✓ Applied: ${data.algorithm} at ${data.rps} RPS`;
      configStatus.className = 'success';
      updateCurrentConfig(data.algorithm, data.rps);
    } else {
      configStatus.textContent = `✗ Error: ${data.error}`;
      configStatus.className = 'error';
    }
  } catch (error) {
    configStatus.textContent = `✗ Network error`;
    configStatus.className = 'error';
  }
});

// Burst Generator
fireButton.addEventListener('click', async () => {
  const count = parseInt(requestCountInput.value);
  const delay = parseInt(requestDelayInput.value);

  fireButton.disabled = true;

  if (delay === 0) {
    // Parallel execution
    const promises = Array.from({ length: count }, (_, i) =>
      testRequest(i + 1)
    );
    await Promise.all(promises);
  } else {
    // Sequential execution with delay
    for (let i = 0; i < count; i++) {
      await testRequest(i + 1);
      if (i < count - 1) {
        await sleep(delay);
      }
    }
  }

  fireButton.disabled = false;
});

async function testRequest(requestNum: number): Promise<void> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${API_BASE}/test`);
    const data = await response.json();

    totalRequests++;

    if (response.ok) {
      allowedRequests++;
      logRequest(requestNum, true, data.remaining);
    } else {
      rejectedRequests++;
      logRequest(requestNum, false, data.retryAfter);
    }

    updateStats();
  } catch (error) {
    totalRequests++;
    rejectedRequests++;
    logRequest(requestNum, false, 0);
    updateStats();
  }
}

function logRequest(num: number, allowed: boolean, info: number): void {
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });

  const message = allowed
    ? `✓ Allowed (remaining: ${info})`
    : `✗ Rejected (retry in ${info}ms)`;

  const entry = `[${time}] Request #${num}: ${message}`;

  requestLog.unshift(entry);
  if (requestLog.length > 100) {
    requestLog.pop();
  }

  updateLog();
}

function updateStats(): void {
  document.getElementById('total-requests')!.textContent = totalRequests.toString();
  document.getElementById('allowed-requests')!.textContent = allowedRequests.toString();
  document.getElementById('rejected-requests')!.textContent = rejectedRequests.toString();

  const allowedPercent = totalRequests > 0 ? (allowedRequests / totalRequests * 100).toFixed(1) : '0';
  const rejectedPercent = totalRequests > 0 ? (rejectedRequests / totalRequests * 100).toFixed(1) : '0';

  document.getElementById('allowed-percent')!.textContent = allowedPercent;
  document.getElementById('rejected-percent')!.textContent = rejectedPercent;

  // Update progress bar
  const progressAllowed = document.getElementById('progress-allowed') as HTMLDivElement;
  const progressRejected = document.getElementById('progress-rejected') as HTMLDivElement;

  progressAllowed.style.width = `${allowedPercent}%`;
  progressRejected.style.width = `${rejectedPercent}%`;
}

function updateLog(): void {
  requestLogDiv.innerHTML = requestLog
    .map(entry => {
      const className = entry.includes('✓') ? 'log-allowed' : 'log-rejected';
      return `<div class="${className}">${entry}</div>`;
    })
    .join('');
}

function updateCurrentConfig(algorithm: string, rps: number): void {
  document.getElementById('current-config')!.textContent = `${algorithm} @ ${rps} RPS`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize
updateStats();
```

#### 3. Styling
**File**: `frontend/src/style.css`
**Changes**: Replace template styles with application styles

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

body {
  padding: 2rem;
  min-height: 100vh;
}

h1 {
  color: #1a1a1a;
  margin-bottom: 2rem;
}

.panel {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.panel h2 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.25rem;
}

.form-group {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.form-group label {
  min-width: 180px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 150px;
}

button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s;
}

button:hover:not(:disabled) {
  background: #0056b3;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

#config-status {
  margin-top: 1rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

#config-status.success {
  color: #155724;
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

#config-status.error {
  color: #721c24;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

#stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  font-weight: 500;
}

#stats span {
  font-weight: 700;
  color: #007bff;
}

#progress-bar {
  height: 30px;
  background: #e0e0e0;
  border-radius: 4px;
  display: flex;
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
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
}

.log-allowed {
  color: #155724;
  padding: 2px 0;
}

.log-rejected {
  color: #721c24;
  padding: 2px 0;
}
```

#### 4. Remove Template Files
**Action**: Delete unused template file
```bash
rm frontend/src/counter.ts
```

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds: `cd frontend && bun run build`
- [ ] TypeScript compiles: `cd frontend && bun run build`
- [ ] Dev server starts: `cd frontend && bun run dev`

#### Manual Verification:
- [ ] Configuration panel updates backend settings
- [ ] Burst generator fires requests correctly (parallel and sequential)
- [ ] Request log displays with proper formatting and colors
- [ ] Statistics update in real-time
- [ ] Progress bar shows visual representation
- [ ] UI is responsive and handles errors gracefully

---

## Phase 5: Integration Testing & Verification

### Overview
Test the complete system with various scenarios to ensure algorithms work correctly.

### Changes Required:

#### 1. Test Script
**File**: `test-scenarios.ts` (create in root)
**Changes**: Create automated test scenarios

```typescript
const API_BASE = 'http://localhost:9000';

async function testScenario(name: string, test: () => Promise<void>) {
  console.log(`\nTesting: ${name}`);
  try {
    await test();
    console.log(`✓ ${name} passed`);
  } catch (error) {
    console.error(`✗ ${name} failed:`, error);
  }
}

// Test 1: Token Bucket allows burst
async function testTokenBucketBurst() {
  // Configure token bucket with 10 RPS
  await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm: 'token-bucket', rps: 10 })
  });

  // Fire 20 requests instantly (burst)
  const results = await Promise.all(
    Array.from({ length: 20 }, () => fetch(`${API_BASE}/test`))
  );

  const allowed = results.filter(r => r.status === 200).length;
  console.log(`  Allowed: ${allowed}/20`);

  if (allowed < 15) {
    throw new Error('Token bucket should allow burst up to capacity');
  }
}

// Test 2: Leaky Bucket smooths rate
async function testLeakyBucketSmoothing() {
  // Configure leaky bucket with 5 RPS
  await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ algorithm: 'leaky-bucket', rps: 5 })
  });

  // Fire 10 requests with small delays
  let allowed = 0;
  for (let i = 0; i < 10; i++) {
    const response = await fetch(`${API_BASE}/test`);
    if (response.status === 200) allowed++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`  Allowed: ${allowed}/10 over 1 second`);

  if (allowed < 4 || allowed > 8) {
    throw new Error('Leaky bucket should smooth request rate');
  }
}

// Run tests
async function runTests() {
  console.log('Starting integration tests...');

  await testScenario('Token Bucket Burst', testTokenBucketBurst);
  await testScenario('Leaky Bucket Smoothing', testLeakyBucketSmoothing);

  console.log('\nTests complete!');
}

runTests();
```

### Success Criteria:

#### Automated Verification:
- [ ] Test script runs: `bun run test-scenarios.ts`
- [ ] Token bucket test passes
- [ ] Leaky bucket test passes
- [ ] Backend handles concurrent requests
- [ ] Frontend connects to backend successfully

#### Manual Verification:
- [ ] Complete user flow works: configure → fire burst → view results
- [ ] Algorithm switching changes behavior noticeably
- [ ] Rate limits are enforced accurately
- [ ] UI updates reflect backend state
- [ ] No console errors during operation

**Implementation Note**: After all verification passes, the implementation is complete.

---

## Testing Strategy

### Unit Tests:
- Token Bucket algorithm correctness
- Leaky Bucket algorithm correctness
- Factory pattern instantiation
- Input validation

### Integration Tests:
- API endpoint responses
- CORS headers presence
- Rate limit enforcement
- Algorithm switching

### Manual Testing Steps:
1. Start backend: `cd backend && bun run dev`
2. Start frontend: `cd frontend && bun run dev`
3. Open http://localhost:5173
4. Configure Token Bucket with 10 RPS
5. Fire 50 requests instantly - verify burst handling
6. Switch to Leaky Bucket with 10 RPS
7. Fire 50 requests with 10ms delay - verify smoothing
8. Test invalid configurations - verify error handling

## Performance Considerations

- In-memory state means no persistence across restarts
- Global rate limiting shared across all clients
- Token refill and queue drain use time-based calculations
- Maximum 100 log entries kept in frontend to prevent memory issues

## Migration Notes

Not applicable for initial implementation.

## References

- Original specification: `README.md`
- Research document: `thoughts/shared/research/2025-10-16-rate-limiting-demo-implementation-status.md`
- TypeScript strict mode config: `tsconfig.json:10`
- Bun server pattern: `backend/index.ts:1-16`