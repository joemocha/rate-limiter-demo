# Fox vs. Hedgehog Rate Limiting Demo - Implementation Plan

## Overview

Implement a comprehensive rate limiting demonstration application showcasing the contrasting problem-solving approaches of the fox (broad exploration) and the hedgehog (focused mastery). The application features three UI modes: a landing page, an algorithm explorer for single-algorithm testing, and an algorithm arena for head-to-head racing visualization. Implementation focuses on two core algorithms (Token Bucket and Leaky Bucket) with a frontend-first development approach.

## Current State Analysis

Based on research document: `thoughts/shared/research/2025-10-17-readme-implementation-status.md`

### What Exists Now
- **Backend**: Basic Bun HTTP server at `backend/index.ts:1-68` with placeholder API handlers returning static values
- **Frontend**: Minimal SPA with counter demo at `frontend/src/main.ts:1-23`
- **Dev Infrastructure**: Working dev server with hot reload and API proxy at `frontend/dev-server.ts:1-114`
- **Build System**: Configured TypeScript compilation and Bun bundling in `package.json` and `frontend/package.json`
- **SPA Serving**: Backend serves static files with fallback for client-side routing at `backend/index.ts:50-64`

### What's Missing
- Client-side routing infrastructure (History API router)
- All three route implementations (landing, explorer, arena)
- Shared configuration service
- Rate limiting algorithms (Token Bucket, Leaky Bucket)
- RateLimiter interface and factory
- Real API endpoint logic (currently returns hardcoded responses)
- WebSocket support for racing mode
- Canvas visualizations for algorithm states
- Configuration constants module
- Test infrastructure and validation suite

### Key Constraints Discovered
- Zero framework dependencies (vanilla TypeScript with native browser APIs)
- Bun-native APIs for bundling, serving, and WebSocket
- No Web Workers (simplified architecture per commit c13f950)
- Global rate limiting state (shared across all clients)
- 30fps target for racing visualization
- SPA catch-all routing needed in dev-server for `/explorer` and `/arena` routes

## Desired End State

A fully functional rate limiting demonstration with:
1. **Three working UI modes**: Landing page with mode selection, Algorithm Explorer for testing single algorithms, Algorithm Arena for head-to-head racing
2. **Two rate limiting algorithms**: Token Bucket and Leaky Bucket implemented with correct behavior per specification
3. **Real-time visualization**: 30fps WebSocket updates for racing mode with canvas rendering
4. **Complete API**: All endpoints (/settings, /test, /health, /reset, /ws/race) functioning with actual rate limiting logic
5. **Test infrastructure**: Bun test runner configured with validation scenarios

### Verification
- Navigate to `http://localhost:5173/` and see landing page with Fox/Hedgehog selection
- Navigate to `/explorer`, configure algorithm, fire bursts, and see accurate rate limiting responses
- Navigate to `/arena`, start a race, and see smooth 30fps visualization of both algorithms processing requests
- Run `bun test` and see all algorithm validation scenarios passing
- Fire 25 instant requests at 10 RPS: Token Bucket allows 20, Leaky Bucket allows 15

## What We're NOT Doing

1. **Optional algorithms**: Fixed Window, Sliding Window, Sliding Log (can be added later)
2. **Web Workers**: Using simplified single-threaded approach instead
3. **Test-first development**: Building functionality first, tests after
4. **Per-client rate limiting**: Using global state as specified
5. **Advanced visualizations**: Keeping particle effects simple (CSS-based, not object pooling)
6. **Production deployment**: Focus on development mode functionality
7. **Error recovery**: Frontend won't handle network failures (per README.md:1062)

## Implementation Approach

**Frontend-first strategy**: Build complete UI structure and routing before implementing backend algorithms. This allows visual development and testing with placeholder data, then wire up real backend logic in later phases.

**Phased delivery**: Each phase ends with manual verification before proceeding. Automated tests come after core functionality is complete.

**Simplified architecture**: No Web Workers, straightforward Canvas rendering, direct WebSocket connection from main thread.

---

## Phase 1: Foundation & Routing Infrastructure

### Overview
Establish the client-side routing foundation and shared configuration service. Replace the counter demo with a proper SPA structure supporting three routes.

### Changes Required

#### 1. Dev Server SPA Catch-All Route
**File**: `frontend/dev-server.ts`
**Changes**: Add catch-all route before the 404 response to serve `index.html` for unmatched paths

**Location**: After line 90, before the final 404 response
```typescript
// SPA fallback - serve index.html for all unmatched routes
// This enables client-side routing for /explorer and /arena
if (!url.pathname.startsWith('/src/')) {
  const html = await Bun.file('./index.html').text();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

return new Response('Not Found', { status: 404 });
```

#### 2. TypeScript Types Module
**File**: `frontend/src/shared/types.ts` (new file)
**Changes**: Create shared type definitions

```typescript
// API request/response types
export interface SettingsRequest {
  algorithm: 'token-bucket' | 'leaky-bucket';
  rps: number;
}

export interface SettingsResponse {
  success: boolean;
  algorithm: string;
  rps: number;
}

export interface TestResponse {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  retryAfter?: number;
}

export interface HealthResponse {
  status: string;
  algorithm: string;
  rps: number;
  timestamp: number;
  stats: {
    remaining: number;
    resetAt: number;
  };
}

// Navigation types
export type RouteHandler = () => void;

export interface NavigationState {
  lastVisited: 'explorer' | 'arena' | null;
  visitCount: number;
  preferences: {
    algorithm: 'token-bucket' | 'leaky-bucket';
    rps: number;
  };
}

// Configuration types
export interface SharedConfig {
  rps: number;
  primaryAlgorithm: 'token-bucket' | 'leaky-bucket';
  secondaryAlgorithm: 'token-bucket' | 'leaky-bucket';
}

export type ConfigListener = (config: SharedConfig) => void;
```

#### 3. Client-Side Router
**File**: `frontend/src/shared/router.ts` (new file)
**Changes**: Implement History API router per README.md:413-474

```typescript
import type { RouteHandler } from './types';

class Router {
  private routes: Map<string, RouteHandler> = new Map();
  private currentRoute: string = '/';

  constructor() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => this.handleRoute());

    // Intercept link clicks with data-route attribute
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route) {
          this.navigate(route);
        }
      }
    });
  }

  register(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  navigate(path: string): void {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  private handleRoute(): void {
    const path = window.location.pathname;
    const handler = this.routes.get(path);

    if (handler) {
      this.currentRoute = path;
      handler();
    } else {
      // 404 fallback - redirect to landing
      this.navigate('/');
    }
  }

  start(): void {
    this.handleRoute();
  }
}

// Export singleton instance
export const router = new Router();
```

#### 4. Shared Configuration Service
**File**: `frontend/src/shared/config-service.ts` (new file)
**Changes**: Create observable configuration singleton per README.md:387-406

```typescript
import type { SharedConfig, ConfigListener } from './types';

class ConfigService {
  private config: SharedConfig = {
    rps: 10,
    primaryAlgorithm: 'token-bucket',
    secondaryAlgorithm: 'leaky-bucket',
  };

  private listeners: ConfigListener[] = [];

  constructor() {
    // Load from localStorage if available
    const stored = localStorage.getItem('sharedConfig');
    if (stored) {
      try {
        this.config = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse stored config, using defaults');
      }
    }
  }

  subscribe(listener: ConfigListener): void {
    this.listeners.push(listener);
    // Immediately notify with current config
    listener(this.config);
  }

  unsubscribe(listener: ConfigListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  getConfig(): SharedConfig {
    return { ...this.config };
  }

  updateRPS(value: number): void {
    this.config.rps = value;
    this.broadcast();
    this.persist();
  }

  updatePrimaryAlgorithm(algorithm: 'token-bucket' | 'leaky-bucket'): void {
    this.config.primaryAlgorithm = algorithm;
    this.broadcast();
    this.persist();
  }

  updateSecondaryAlgorithm(algorithm: 'token-bucket' | 'leaky-bucket'): void {
    this.config.secondaryAlgorithm = algorithm;
    this.broadcast();
    this.persist();
  }

  private broadcast(): void {
    this.listeners.forEach(listener => listener(this.config));
  }

  private persist(): void {
    localStorage.setItem('sharedConfig', JSON.stringify(this.config));
  }
}

// Export singleton instance
export const configService = new ConfigService();
```

#### 5. Landing Page Component
**File**: `frontend/src/routes/landing/index.ts` (new file)
**Changes**: Create landing page with mode selection per README.md:336-359

```typescript
import { router } from '../../shared/router';
import './style.css';

export function renderLanding(): string {
  return `
    <div class="landing-container">
      <header class="landing-header">
        <h1>Fox vs. Hedgehog Rate Limiting</h1>
        <p class="subtitle">Choose Your Path</p>
      </header>

      <div class="mode-selection">
        <div class="mode-card">
          <div class="mode-icon">🦊</div>
          <h2>Algorithm Explorer</h2>
          <p class="mode-philosophy">"The Fox knows many things..."</p>
          <ul class="mode-features">
            <li>Single Algorithm</li>
            <li>Detailed Analysis</li>
            <li>Parameter Tuning</li>
          </ul>
          <a href="/explorer" data-route="/explorer" class="mode-button">Enter Explorer →</a>
        </div>

        <div class="mode-card">
          <div class="mode-icon">🦔</div>
          <h2>Algorithm Arena</h2>
          <p class="mode-philosophy">"The Hedgehog knows one big thing..."</p>
          <ul class="mode-features">
            <li>Dual Racing</li>
            <li>Visual Compare</li>
            <li>Live Metrics</li>
          </ul>
          <a href="/arena" data-route="/arena" class="mode-button">Enter Arena →</a>
        </div>
      </div>

      <footer class="landing-footer">
        <p>Powered by Bun + TypeScript (zero framework dependencies)</p>
      </footer>
    </div>
  `;
}

export function mountLanding(): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderLanding();
  }
}
```

#### 6. Landing Page Styles
**File**: `frontend/src/routes/landing/style.css` (new file)
**Changes**: Create landing page styles

```css
.landing-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.landing-header {
  text-align: center;
  margin-bottom: 3rem;
}

.landing-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.2rem;
  color: #888;
}

.mode-selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.mode-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  transition: transform 0.2s, border-color 0.2s;
}

.mode-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.3);
}

.mode-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.mode-card h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.mode-philosophy {
  font-style: italic;
  color: #888;
  margin-bottom: 1rem;
}

.mode-features {
  list-style: none;
  padding: 0;
  margin-bottom: 1.5rem;
}

.mode-features li {
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.mode-features li:last-child {
  border-bottom: none;
}

.mode-button {
  display: inline-block;
  padding: 0.75rem 2rem;
  background: #646cff;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 500;
  transition: background 0.2s;
}

.mode-button:hover {
  background: #535bf2;
}

.landing-footer {
  text-align: center;
  color: #888;
  font-size: 0.9rem;
}
```

#### 7. Update Main Entry Point
**File**: `frontend/src/main.ts`
**Changes**: Replace counter demo with router-based SPA

```typescript
import './style.css';
import { router } from './shared/router';
import { mountLanding } from './routes/landing';

// Register routes
router.register('/', mountLanding);

router.register('/explorer', () => {
  document.getElementById('app')!.innerHTML = '<h1>Explorer (Coming Soon)</h1>';
});

router.register('/arena', () => {
  document.getElementById('app')!.innerHTML = '<h1>Arena (Coming Soon)</h1>';
});

// Start routing
router.start();
```

#### 8. Remove Counter Component
**File**: `frontend/src/counter.ts`
**Changes**: Delete this file (no longer needed)

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `cd frontend && bun run build`
- [x] No console errors when loading app
- [x] Dev server starts successfully: `bun run dev:all`

#### Manual Verification:
- [x] Navigate to `http://localhost:5173/` and see landing page with two mode cards
- [x] Click "Enter Explorer →" button and URL changes to `/explorer`
- [x] Click browser back button and return to landing page
- [x] Click "Enter Arena →" button and URL changes to `/arena`
- [x] Refresh page while on `/explorer` or `/arena` and page loads correctly (SPA catch-all works)
- [x] No more counter demo visible anywhere

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Algorithm Explorer UI

### Overview
Build the complete Algorithm Explorer interface with algorithm selection, RPS configuration, burst generator, and results display. This phase creates a fully functional UI that will connect to backend placeholder endpoints (which currently return static values).

### Changes Required

#### 1. Explorer Route Implementation
**File**: `frontend/src/routes/explorer/index.ts` (new file)
**Changes**: Create complete explorer UI per README.md:485-542

```typescript
import { configService } from '../../shared/config-service';
import type { TestResponse } from '../../shared/types';
import './style.css';

interface RequestLog {
  id: number;
  timestamp: string;
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

let requestLogs: RequestLog[] = [];
let requestIdCounter = 0;
let totalRequests = 0;
let allowedRequests = 0;
let rejectedRequests = 0;

export function renderExplorer(): string {
  return `
    <div class="explorer-container">
      <header class="explorer-header">
        <a href="/" data-route="/" class="back-link">← Back to Landing</a>
        <h1>🦊 Algorithm Explorer</h1>
      </header>

      <div class="explorer-layout">
        <aside class="config-panel">
          <h2>Configuration</h2>

          <div class="form-group">
            <label for="algorithm-select">Algorithm</label>
            <select id="algorithm-select" class="form-control">
              <option value="token-bucket">Token Bucket</option>
              <option value="leaky-bucket">Leaky Bucket</option>
            </select>
          </div>

          <div class="form-group">
            <label for="rps-input">Requests Per Second</label>
            <input
              type="number"
              id="rps-input"
              class="form-control"
              min="1"
              max="1000"
              value="10"
            />
          </div>

          <button id="apply-settings-btn" class="btn btn-primary">Apply Settings</button>

          <div id="settings-feedback" class="feedback"></div>

          <div class="current-config">
            <h3>Current Settings</h3>
            <div id="current-algorithm">Algorithm: Token Bucket</div>
            <div id="current-rps">RPS: 10</div>
          </div>
        </aside>

        <main class="test-panel">
          <div class="burst-generator">
            <h2>Burst Generator</h2>

            <div class="burst-controls">
              <div class="form-group">
                <label for="request-count">Number of Requests</label>
                <input
                  type="number"
                  id="request-count"
                  class="form-control"
                  min="1"
                  max="100"
                  value="10"
                />
              </div>

              <div class="form-group">
                <label for="request-delay">Delay Between Requests (ms)</label>
                <input
                  type="number"
                  id="request-delay"
                  class="form-control"
                  min="0"
                  max="1000"
                  value="0"
                />
              </div>

              <button id="fire-burst-btn" class="btn btn-secondary">🚀 Fire Burst</button>
              <button id="reset-btn" class="btn btn-outline">Reset Rate Limiter</button>
            </div>
          </div>

          <div class="results-section">
            <div class="stats-summary">
              <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div id="total-requests" class="stat-value">0</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Allowed</div>
                <div id="allowed-count" class="stat-value success">0 (0%)</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Rejected</div>
                <div id="rejected-count" class="stat-value error">0 (0%)</div>
              </div>
            </div>

            <div class="visual-indicator">
              <div class="progress-bar">
                <div id="allowed-bar" class="progress-segment success" style="width: 0%"></div>
                <div id="rejected-bar" class="progress-segment error" style="width: 0%"></div>
              </div>
            </div>

            <div class="request-log">
              <h3>Request Log</h3>
              <button id="clear-log-btn" class="btn btn-sm">Clear Log</button>
              <div id="log-container" class="log-entries"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;
}

export function mountExplorer(): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderExplorer();
    attachEventListeners();
    loadCurrentConfig();
  }
}

function attachEventListeners(): void {
  // Apply settings
  const applyBtn = document.getElementById('apply-settings-btn');
  applyBtn?.addEventListener('click', handleApplySettings);

  // Fire burst
  const fireBurstBtn = document.getElementById('fire-burst-btn');
  fireBurstBtn?.addEventListener('click', handleFireBurst);

  // Reset rate limiter
  const resetBtn = document.getElementById('reset-btn');
  resetBtn?.addEventListener('click', handleReset);

  // Clear log
  const clearLogBtn = document.getElementById('clear-log-btn');
  clearLogBtn?.addEventListener('click', handleClearLog);
}

function loadCurrentConfig(): void {
  const config = configService.getConfig();

  const algorithmSelect = document.getElementById('algorithm-select') as HTMLSelectElement;
  const rpsInput = document.getElementById('rps-input') as HTMLInputElement;

  if (algorithmSelect) {
    algorithmSelect.value = config.primaryAlgorithm;
  }

  if (rpsInput) {
    rpsInput.value = config.rps.toString();
  }

  updateCurrentConfigDisplay(config.primaryAlgorithm, config.rps);
}

async function handleApplySettings(): Promise<void> {
  const algorithmSelect = document.getElementById('algorithm-select') as HTMLSelectElement;
  const rpsInput = document.getElementById('rps-input') as HTMLInputElement;
  const feedback = document.getElementById('settings-feedback');

  const algorithm = algorithmSelect.value as 'token-bucket' | 'leaky-bucket';
  const rps = parseInt(rpsInput.value, 10);

  if (rps < 1 || rps > 1000) {
    showFeedback('RPS must be between 1 and 1000', 'error');
    return;
  }

  try {
    const response = await fetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, rps }),
    });

    const data = await response.json();

    if (data.success) {
      configService.updatePrimaryAlgorithm(algorithm);
      configService.updateRPS(rps);
      updateCurrentConfigDisplay(algorithm, rps);
      showFeedback('Settings applied successfully!', 'success');
    } else {
      showFeedback('Failed to apply settings', 'error');
    }
  } catch (error) {
    showFeedback('Network error: Could not apply settings', 'error');
  }
}

async function handleFireBurst(): Promise<void> {
  const countInput = document.getElementById('request-count') as HTMLInputElement;
  const delayInput = document.getElementById('request-delay') as HTMLInputElement;
  const fireBurstBtn = document.getElementById('fire-burst-btn') as HTMLButtonElement;

  const count = parseInt(countInput.value, 10);
  const delay = parseInt(delayInput.value, 10);

  if (count < 1 || count > 100) {
    showFeedback('Request count must be between 1 and 100', 'error');
    return;
  }

  // Disable button during burst
  fireBurstBtn.disabled = true;
  fireBurstBtn.textContent = 'Firing...';

  if (delay === 0) {
    // Parallel burst
    const promises = Array.from({ length: count }, () => sendTestRequest());
    await Promise.all(promises);
  } else {
    // Sequential burst with delay
    for (let i = 0; i < count; i++) {
      await sendTestRequest();
      if (i < count - 1) {
        await sleep(delay);
      }
    }
  }

  // Re-enable button
  fireBurstBtn.disabled = false;
  fireBurstBtn.textContent = '🚀 Fire Burst';
}

async function sendTestRequest(): Promise<void> {
  try {
    const response = await fetch('/test');
    const data: TestResponse = await response.json();

    logRequest(data);
    updateStats(data.allowed);
  } catch (error) {
    console.error('Test request failed:', error);
  }
}

async function handleReset(): Promise<void> {
  try {
    await fetch('/reset', { method: 'POST' });
    showFeedback('Rate limiter reset successfully', 'success');
  } catch (error) {
    showFeedback('Failed to reset rate limiter', 'error');
  }
}

function handleClearLog(): void {
  requestLogs = [];
  totalRequests = 0;
  allowedRequests = 0;
  rejectedRequests = 0;

  updateLogDisplay();
  updateStatsDisplay();
}

function logRequest(response: TestResponse): void {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

  const log: RequestLog = {
    id: ++requestIdCounter,
    timestamp,
    allowed: response.allowed,
    remaining: response.remaining,
    retryAfter: response.retryAfter,
  };

  requestLogs.unshift(log); // Add to front

  // Keep only last 100 entries
  if (requestLogs.length > 100) {
    requestLogs = requestLogs.slice(0, 100);
  }

  updateLogDisplay();
}

function updateLogDisplay(): void {
  const container = document.getElementById('log-container');
  if (!container) return;

  if (requestLogs.length === 0) {
    container.innerHTML = '<div class="log-empty">No requests yet. Fire a burst to see results.</div>';
    return;
  }

  container.innerHTML = requestLogs.map(log => {
    const statusClass = log.allowed ? 'success' : 'error';
    const statusIcon = log.allowed ? '✓' : '✗';
    const details = log.allowed
      ? `(remaining: ${log.remaining})`
      : `(retry in ${log.retryAfter}ms)`;

    return `
      <div class="log-entry ${statusClass}">
        <span class="log-timestamp">[${log.timestamp}]</span>
        <span class="log-status">${statusIcon}</span>
        <span class="log-details">Request #${log.id}: ${log.allowed ? 'Allowed' : 'Rejected'} ${details}</span>
      </div>
    `;
  }).join('');

  // Auto-scroll to top (latest entry)
  container.scrollTop = 0;
}

function updateStats(allowed: boolean): void {
  totalRequests++;
  if (allowed) {
    allowedRequests++;
  } else {
    rejectedRequests++;
  }

  updateStatsDisplay();
}

function updateStatsDisplay(): void {
  const allowedPercent = totalRequests > 0 ? Math.round((allowedRequests / totalRequests) * 100) : 0;
  const rejectedPercent = totalRequests > 0 ? Math.round((rejectedRequests / totalRequests) * 100) : 0;

  const totalEl = document.getElementById('total-requests');
  const allowedEl = document.getElementById('allowed-count');
  const rejectedEl = document.getElementById('rejected-count');
  const allowedBar = document.getElementById('allowed-bar');
  const rejectedBar = document.getElementById('rejected-bar');

  if (totalEl) totalEl.textContent = totalRequests.toString();
  if (allowedEl) allowedEl.textContent = `${allowedRequests} (${allowedPercent}%)`;
  if (rejectedEl) rejectedEl.textContent = `${rejectedRequests} (${rejectedPercent}%)`;
  if (allowedBar) allowedBar.style.width = `${allowedPercent}%`;
  if (rejectedBar) rejectedBar.style.width = `${rejectedPercent}%`;
}

function updateCurrentConfigDisplay(algorithm: string, rps: number): void {
  const algorithmEl = document.getElementById('current-algorithm');
  const rpsEl = document.getElementById('current-rps');

  const algorithmName = algorithm === 'token-bucket' ? 'Token Bucket' : 'Leaky Bucket';

  if (algorithmEl) algorithmEl.textContent = `Algorithm: ${algorithmName}`;
  if (rpsEl) rpsEl.textContent = `RPS: ${rps}`;
}

function showFeedback(message: string, type: 'success' | 'error'): void {
  const feedback = document.getElementById('settings-feedback');
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
  feedback.style.display = 'block';

  setTimeout(() => {
    feedback.style.display = 'none';
  }, 3000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### 2. Explorer Styles
**File**: `frontend/src/routes/explorer/style.css` (new file)
**Changes**: Create explorer UI styles

```css
.explorer-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.explorer-header {
  margin-bottom: 2rem;
}

.back-link {
  color: #646cff;
  text-decoration: none;
  display: inline-block;
  margin-bottom: 1rem;
}

.back-link:hover {
  text-decoration: underline;
}

.explorer-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 2rem;
}

/* Config Panel */
.config-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
  height: fit-content;
}

.config-panel h2 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #aaa;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 1rem;
}

.form-control:focus {
  outline: none;
  border-color: #646cff;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary {
  background: #646cff;
  color: white;
  width: 100%;
}

.btn-primary:hover {
  background: #535bf2;
}

.btn-primary:disabled {
  background: #444;
  cursor: not-allowed;
}

.feedback {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  display: none;
}

.feedback.success {
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid rgba(0, 255, 0, 0.3);
  color: #0f0;
}

.feedback.error {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  color: #f00;
}

.current-config {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.current-config h3 {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: #aaa;
}

.current-config div {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

/* Test Panel */
.test-panel {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.burst-generator {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
}

.burst-generator h2 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
}

.burst-controls {
  display: grid;
  grid-template-columns: 1fr 1fr auto auto;
  gap: 1rem;
  align-items: end;
}

.btn-secondary {
  background: #42b883;
  color: white;
}

.btn-secondary:hover {
  background: #33a372;
}

.btn-secondary:disabled {
  background: #444;
  cursor: not-allowed;
}

.btn-outline {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Results Section */
.results-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.stat-label {
  font-size: 0.9rem;
  color: #aaa;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
}

.stat-value.success {
  color: #0f0;
}

.stat-value.error {
  color: #f00;
}

.visual-indicator {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
}

.progress-bar {
  height: 40px;
  display: flex;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}

.progress-segment {
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.progress-segment.success {
  background: #0f0;
}

.progress-segment.error {
  background: #f00;
}

/* Request Log */
.request-log {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
}

.request-log h3 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  display: inline-block;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  float: right;
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.log-entries {
  margin-top: 1rem;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 0.5rem;
}

.log-empty {
  text-align: center;
  color: #888;
  padding: 2rem;
}

.log-entry {
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
}

.log-entry.success {
  background: rgba(0, 255, 0, 0.1);
  border-left: 3px solid #0f0;
}

.log-entry.error {
  background: rgba(255, 0, 0, 0.1);
  border-left: 3px solid #f00;
}

.log-timestamp {
  color: #888;
  margin-right: 0.5rem;
}

.log-status {
  font-weight: bold;
  margin-right: 0.5rem;
}

.log-details {
  color: #ccc;
}

/* Responsive */
@media (max-width: 1024px) {
  .explorer-layout {
    grid-template-columns: 1fr;
  }

  .burst-controls {
    grid-template-columns: 1fr 1fr;
  }

  .burst-controls button {
    grid-column: span 2;
  }

  .stats-summary {
    grid-template-columns: 1fr;
  }
}
```

#### 3. Update Main Router
**File**: `frontend/src/main.ts`
**Changes**: Replace placeholder with real explorer mount

```typescript
import './style.css';
import { router } from './shared/router';
import { mountLanding } from './routes/landing';
import { mountExplorer } from './routes/explorer';

// Register routes
router.register('/', mountLanding);
router.register('/explorer', mountExplorer);

router.register('/arena', () => {
  document.getElementById('app')!.innerHTML = '<h1>Arena (Coming Soon)</h1>';
});

// Start routing
router.start();
```

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation passes: `cd frontend && bun run build`
- [x] No console errors when navigating to /explorer
- [x] Dev server serves Explorer route: `curl http://localhost:5173/explorer`

#### Manual Verification:
- [ ] Navigate to `/explorer` and see complete UI with config panel and test panel
- [ ] Select "Leaky Bucket" algorithm and enter RPS value of 25
- [ ] Click "Apply Settings" and see success feedback message
- [ ] Verify current config display updates to show "Leaky Bucket" and "RPS: 25"
- [ ] Enter 10 requests with 0ms delay and click "Fire Burst"
- [ ] See 10 log entries appear in request log (will all show "Allowed" with placeholder backend)
- [ ] Verify stats summary shows "Total Requests: 10" and "Allowed: 10 (100%)"
- [ ] Enter 5 requests with 100ms delay and click "Fire Burst"
- [ ] Verify requests appear sequentially (not all at once)
- [ ] Click "Clear Log" and verify all stats reset to 0
- [ ] Click "Reset Rate Limiter" and see success feedback
- [ ] Click "← Back to Landing" and return to landing page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Algorithm Arena UI

### Overview
Build the Algorithm Arena interface with dual-algorithm visualization, canvas rendering for token buckets and queues, and comparative metrics display. This phase creates the racing UI structure without WebSocket connectivity (added in Phase 6).

### Changes Required

#### 1. Arena Route Implementation
**File**: `frontend/src/routes/arena/index.ts` (new file)
**Changes**: Create arena UI structure

```typescript
import { configService } from '../../shared/config-service';
import './style.css';

interface AlgorithmState {
  tokens?: number;
  capacity?: number;
  queueSize?: number;
  maxQueue?: number;
  accepted: number;
  rejected: number;
}

let foxState: AlgorithmState = { accepted: 0, rejected: 0 };
let hedgehogState: AlgorithmState = { accepted: 0, rejected: 0 };
let isRacing = false;
let animationFrameId: number | null = null;

export function renderArena(): string {
  return `
    <div class="arena-container">
      <header class="arena-header">
        <a href="/" data-route="/" class="back-link">← Back to Landing</a>
        <h1>🏁 Algorithm Arena</h1>
        <div class="race-status">
          <span id="race-status-text">Ready to race</span>
        </div>
      </header>

      <div class="arena-layout">
        <div class="algorithm-column fox">
          <div class="algorithm-header">
            <div class="algorithm-icon">🦊</div>
            <h2>Fox</h2>
            <div class="algorithm-name">Token Bucket</div>
          </div>

          <div class="visualization-container">
            <canvas id="fox-canvas" width="300" height="300"></canvas>
            <div class="viz-label">Tokens: <span id="fox-tokens">0/0</span></div>
          </div>

          <div class="metrics">
            <div class="metric">
              <span class="metric-label">Accepted</span>
              <span id="fox-accepted" class="metric-value success">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rejected</span>
              <span id="fox-rejected" class="metric-value error">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rate</span>
              <span id="fox-rate" class="metric-value">0/s</span>
            </div>
          </div>
        </div>

        <div class="algorithm-column hedgehog">
          <div class="algorithm-header">
            <div class="algorithm-icon">🦔</div>
            <h2>Hedgehog</h2>
            <div class="algorithm-name">Leaky Bucket</div>
          </div>

          <div class="visualization-container">
            <canvas id="hedgehog-canvas" width="300" height="300"></canvas>
            <div class="viz-label">Queue: <span id="hedgehog-queue">0/0</span></div>
          </div>

          <div class="metrics">
            <div class="metric">
              <span class="metric-label">Accepted</span>
              <span id="hedgehog-accepted" class="metric-value success">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rejected</span>
              <span id="hedgehog-rejected" class="metric-value error">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rate</span>
              <span id="hedgehog-rate" class="metric-value">0/s</span>
            </div>
          </div>
        </div>
      </div>

      <div class="race-controls">
        <div class="control-group">
          <label for="race-rps">Requests Per Second</label>
          <input type="number" id="race-rps" class="form-control" min="1" max="1000" value="10" />
        </div>

        <div class="control-group">
          <label for="race-duration">Duration (seconds)</label>
          <input type="number" id="race-duration" class="form-control" min="5" max="60" value="30" />
        </div>

        <div class="control-group">
          <label for="race-pattern">Traffic Pattern</label>
          <select id="race-pattern" class="form-control">
            <option value="burst">Burst</option>
            <option value="sustained">Sustained</option>
            <option value="chaos">Chaos</option>
          </select>
        </div>

        <button id="start-race-btn" class="btn btn-primary">Start Race</button>
        <button id="stop-race-btn" class="btn btn-outline" disabled>Stop Race</button>
      </div>

      <div class="comparative-metrics">
        <h3>Comparative Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-card-label">Winner</div>
            <div id="winner-display" class="metric-card-value">—</div>
          </div>
          <div class="metric-card">
            <div class="metric-card-label">Fox Throughput</div>
            <div id="fox-throughput" class="metric-card-value">0%</div>
          </div>
          <div class="metric-card">
            <div class="metric-card-label">Hedgehog Throughput</div>
            <div id="hedgehog-throughput" class="metric-card-value">0%</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function mountArena(): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderArena();
    attachEventListeners();
    initializeCanvases();
  }
}

function attachEventListeners(): void {
  const startBtn = document.getElementById('start-race-btn');
  const stopBtn = document.getElementById('stop-race-btn');

  startBtn?.addEventListener('click', handleStartRace);
  stopBtn?.addEventListener('click', handleStopRace);
}

function initializeCanvases(): void {
  const foxCanvas = document.getElementById('fox-canvas') as HTMLCanvasElement;
  const hedgehogCanvas = document.getElementById('hedgehog-canvas') as HTMLCanvasElement;

  if (foxCanvas && hedgehogCanvas) {
    // Initial render with empty state
    renderTokenBucket(foxCanvas, 0, 20);
    renderLeakyBucket(hedgehogCanvas, 0, 15);
  }
}

function renderTokenBucket(canvas: HTMLCanvasElement, tokens: number, capacity: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw container
  const containerWidth = 200;
  const containerHeight = 250;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2 + 20;

  ctx.strokeStyle = '#646cff';
  ctx.lineWidth = 3;
  ctx.strokeRect(containerX, containerY, containerWidth, containerHeight);

  // Draw water level
  const fillRatio = capacity > 0 ? tokens / capacity : 0;
  const fillHeight = containerHeight * fillRatio;
  const fillY = containerY + containerHeight - fillHeight;

  const gradient = ctx.createLinearGradient(0, fillY, 0, containerY + containerHeight);
  gradient.addColorStop(0, 'rgba(100, 108, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(100, 108, 255, 0.4)');

  ctx.fillStyle = gradient;
  ctx.fillRect(containerX, fillY, containerWidth, fillHeight);

  // Draw waves on water surface
  if (fillHeight > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const waveY = fillY;
    for (let x = containerX; x <= containerX + containerWidth; x += 20) {
      const waveOffset = Math.sin((x - containerX) / 20) * 5;
      ctx.lineTo(x, waveY + waveOffset);
    }
    ctx.stroke();
  }

  // Draw label
  ctx.fillStyle = 'white';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(tokens)} / ${capacity} tokens`, width / 2, containerY - 10);
}

function renderLeakyBucket(canvas: HTMLCanvasElement, queueSize: number, maxQueue: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw container (inverted funnel)
  const containerWidth = 200;
  const containerHeight = 250;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2 + 20;

  ctx.strokeStyle = '#42b883';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(containerX, containerY);
  ctx.lineTo(containerX, containerY + containerHeight);
  ctx.lineTo(containerX + containerWidth, containerY + containerHeight);
  ctx.lineTo(containerX + containerWidth, containerY);
  ctx.stroke();

  // Draw queue blocks
  const fillRatio = maxQueue > 0 ? queueSize / maxQueue : 0;
  const blockHeight = 20;
  const blockCount = Math.ceil(fillRatio * (containerHeight / blockHeight));

  for (let i = 0; i < blockCount; i++) {
    const blockY = containerY + containerHeight - (i + 1) * blockHeight;

    ctx.fillStyle = i % 2 === 0 ? 'rgba(66, 184, 131, 0.8)' : 'rgba(66, 184, 131, 0.6)';
    ctx.fillRect(containerX + 5, blockY, containerWidth - 10, blockHeight - 2);
  }

  // Draw label
  ctx.fillStyle = 'white';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(queueSize)} / ${maxQueue} items`, width / 2, containerY - 10);
}

function handleStartRace(): void {
  const rpsInput = document.getElementById('race-rps') as HTMLInputElement;
  const durationInput = document.getElementById('race-duration') as HTMLInputElement;
  const patternSelect = document.getElementById('race-pattern') as HTMLSelectElement;
  const startBtn = document.getElementById('start-race-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-race-btn') as HTMLButtonElement;
  const statusText = document.getElementById('race-status-text');

  const rps = parseInt(rpsInput.value, 10);
  const duration = parseInt(durationInput.value, 10);
  const pattern = patternSelect.value;

  // Reset state
  foxState = { tokens: rps * 2, capacity: rps * 2, accepted: 0, rejected: 0 };
  hedgehogState = { queueSize: 0, maxQueue: Math.floor(rps * 1.5), accepted: 0, rejected: 0 };

  // Update UI
  isRacing = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  if (statusText) statusText.textContent = `Racing (${duration}s)`;

  // Start animation loop
  startRenderLoop();

  // Simulate race (this will be replaced with WebSocket in Phase 6)
  simulateRace(rps, duration, pattern);
}

function handleStopRace(): void {
  const startBtn = document.getElementById('start-race-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-race-btn') as HTMLButtonElement;
  const statusText = document.getElementById('race-status-text');

  isRacing = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (statusText) statusText.textContent = 'Race stopped';

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  updateWinnerDisplay();
}

function startRenderLoop(): void {
  let lastTime = performance.now();

  function render(currentTime: number): void {
    const deltaTime = currentTime - lastTime;

    // Target 30fps (33.33ms per frame)
    if (deltaTime >= 33.33) {
      updateVisualization();
      lastTime = currentTime;
    }

    if (isRacing) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  animationFrameId = requestAnimationFrame(render);
}

function updateVisualization(): void {
  const foxCanvas = document.getElementById('fox-canvas') as HTMLCanvasElement;
  const hedgehogCanvas = document.getElementById('hedgehog-canvas') as HTMLCanvasElement;

  if (foxCanvas && foxState.tokens !== undefined && foxState.capacity !== undefined) {
    renderTokenBucket(foxCanvas, foxState.tokens, foxState.capacity);
  }

  if (hedgehogCanvas && hedgehogState.queueSize !== undefined && hedgehogState.maxQueue !== undefined) {
    renderLeakyBucket(hedgehogCanvas, hedgehogState.queueSize, hedgehogState.maxQueue);
  }

  updateMetricsDisplay();
}

function updateMetricsDisplay(): void {
  // Fox metrics
  const foxTokensEl = document.getElementById('fox-tokens');
  const foxAcceptedEl = document.getElementById('fox-accepted');
  const foxRejectedEl = document.getElementById('fox-rejected');

  if (foxTokensEl) foxTokensEl.textContent = `${Math.round(foxState.tokens || 0)}/${foxState.capacity || 0}`;
  if (foxAcceptedEl) foxAcceptedEl.textContent = foxState.accepted.toString();
  if (foxRejectedEl) foxRejectedEl.textContent = foxState.rejected.toString();

  // Hedgehog metrics
  const hedgehogQueueEl = document.getElementById('hedgehog-queue');
  const hedgehogAcceptedEl = document.getElementById('hedgehog-accepted');
  const hedgehogRejectedEl = document.getElementById('hedgehog-rejected');

  if (hedgehogQueueEl) hedgehogQueueEl.textContent = `${Math.round(hedgehogState.queueSize || 0)}/${hedgehogState.maxQueue || 0}`;
  if (hedgehogAcceptedEl) hedgehogAcceptedEl.textContent = hedgehogState.accepted.toString();
  if (hedgehogRejectedEl) hedgehogRejectedEl.textContent = hedgehogState.rejected.toString();

  // Throughput percentages
  const foxTotal = foxState.accepted + foxState.rejected;
  const hedgehogTotal = hedgehogState.accepted + hedgehogState.rejected;

  const foxThroughput = foxTotal > 0 ? Math.round((foxState.accepted / foxTotal) * 100) : 0;
  const hedgehogThroughput = hedgehogTotal > 0 ? Math.round((hedgehogState.accepted / hedgehogTotal) * 100) : 0;

  const foxThroughputEl = document.getElementById('fox-throughput');
  const hedgehogThroughputEl = document.getElementById('hedgehog-throughput');

  if (foxThroughputEl) foxThroughputEl.textContent = `${foxThroughput}%`;
  if (hedgehogThroughputEl) hedgehogThroughputEl.textContent = `${hedgehogThroughput}%`;
}

function updateWinnerDisplay(): void {
  const winnerEl = document.getElementById('winner-display');
  if (!winnerEl) return;

  const foxTotal = foxState.accepted + foxState.rejected;
  const hedgehogTotal = hedgehogState.accepted + hedgehogState.rejected;

  if (foxTotal === 0 && hedgehogTotal === 0) {
    winnerEl.textContent = '—';
    return;
  }

  if (foxState.accepted > hedgehogState.accepted) {
    winnerEl.textContent = '🦊 Fox';
    winnerEl.style.color = '#646cff';
  } else if (hedgehogState.accepted > foxState.accepted) {
    winnerEl.textContent = '🦔 Hedgehog';
    winnerEl.style.color = '#42b883';
  } else {
    winnerEl.textContent = 'Tie';
    winnerEl.style.color = '#888';
  }
}

// Temporary simulation (will be replaced with WebSocket in Phase 6)
function simulateRace(rps: number, duration: number, pattern: string): void {
  const interval = setInterval(() => {
    if (!isRacing) {
      clearInterval(interval);
      return;
    }

    // Simulate token bucket: refill tokens
    if (foxState.tokens !== undefined && foxState.capacity !== undefined) {
      foxState.tokens = Math.min(foxState.capacity, foxState.tokens + rps / 10);
    }

    // Simulate leaky bucket: drain queue
    if (hedgehogState.queueSize !== undefined) {
      hedgehogState.queueSize = Math.max(0, hedgehogState.queueSize - rps / 10);
    }

    // Simulate random requests
    const requestsThisTick = pattern === 'burst' ? Math.random() * rps * 2 : rps / 10;

    for (let i = 0; i < requestsThisTick; i++) {
      // Fox: consume token
      if (foxState.tokens !== undefined && foxState.tokens >= 1) {
        foxState.tokens--;
        foxState.accepted++;
      } else {
        foxState.rejected++;
      }

      // Hedgehog: add to queue
      if (hedgehogState.queueSize !== undefined && hedgehogState.maxQueue !== undefined) {
        if (hedgehogState.queueSize < hedgehogState.maxQueue) {
          hedgehogState.queueSize++;
          hedgehogState.accepted++;
        } else {
          hedgehogState.rejected++;
        }
      }
    }
  }, 100);

  // Auto-stop after duration
  setTimeout(() => {
    handleStopRace();
  }, duration * 1000);
}
```

#### 2. Arena Styles
**File**: `frontend/src/routes/arena/style.css` (new file)
**Changes**: Create arena UI styles

```css
.arena-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.arena-header {
  margin-bottom: 2rem;
  text-align: center;
}

.back-link {
  color: #646cff;
  text-decoration: none;
  position: absolute;
  left: 2rem;
  top: 2rem;
}

.back-link:hover {
  text-decoration: underline;
}

.race-status {
  margin-top: 0.5rem;
  color: #888;
  font-size: 1rem;
}

.arena-layout {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  margin-bottom: 2rem;
}

.algorithm-column {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 2rem;
}

.algorithm-column.fox {
  border-top: 4px solid #646cff;
}

.algorithm-column.hedgehog {
  border-top: 4px solid #42b883;
}

.algorithm-header {
  text-align: center;
  margin-bottom: 2rem;
}

.algorithm-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.algorithm-header h2 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.algorithm-name {
  color: #888;
  font-size: 0.9rem;
}

.visualization-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
}

canvas {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
}

.viz-label {
  margin-top: 1rem;
  font-size: 1rem;
  color: #aaa;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.metric {
  text-align: center;
}

.metric-label {
  display: block;
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 0.5rem;
}

.metric-value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
}

.metric-value.success {
  color: #0f0;
}

.metric-value.error {
  color: #f00;
}

.race-controls {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto auto;
  gap: 1rem;
  align-items: end;
  margin-bottom: 2rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #aaa;
}

.comparative-metrics {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1.5rem;
}

.comparative-metrics h3 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.metric-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 1.5rem;
  text-align: center;
}

.metric-card-label {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 0.5rem;
}

.metric-card-value {
  font-size: 2rem;
  font-weight: bold;
}

/* Responsive */
@media (max-width: 1024px) {
  .arena-layout {
    grid-template-columns: 1fr;
  }

  .race-controls {
    grid-template-columns: 1fr 1fr;
  }

  .race-controls button {
    grid-column: span 2;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
```

#### 3. Update Main Router
**File**: `frontend/src/main.ts`
**Changes**: Add arena mount function

```typescript
import './style.css';
import { router } from './shared/router';
import { mountLanding } from './routes/landing';
import { mountExplorer } from './routes/explorer';
import { mountArena } from './routes/arena';

// Register routes
router.register('/', mountLanding);
router.register('/explorer', mountExplorer);
router.register('/arena', mountArena);

// Start routing
router.start();
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `cd frontend && bun run build`
- [ ] No console errors when navigating to /arena
- [ ] Canvas elements render without errors

#### Manual Verification:
- [ ] Navigate to `/arena` and see dual-column layout with Fox and Hedgehog
- [ ] Verify both canvases show empty bucket visualizations
- [ ] Enter RPS value of 20 and duration of 10 seconds
- [ ] Click "Start Race" and see:
  - Token bucket visualization showing water level changes
  - Leaky bucket visualization showing queue blocks
  - Accepted/Rejected metrics incrementing
  - Status showing "Racing (10s)"
- [ ] Verify visualization updates smoothly (~30fps)
- [ ] Click "Stop Race" before timer ends and verify race stops
- [ ] Verify winner display shows Fox, Hedgehog, or Tie based on accepted counts
- [ ] Test with different traffic patterns (Burst, Sustained, Chaos)
- [ ] Click "← Back to Landing" and return to landing page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Backend Rate Limiting Algorithms

### Overview
Implement the two core rate limiting algorithms (Token Bucket and Leaky Bucket) with the RateLimiter interface, configuration constants, and algorithm factory. This establishes the backend logic foundation.

### Changes Required

#### 1. RateLimiter Interface
**File**: `backend/src/types/rate-limiter.interface.ts` (new file)
**Changes**: Create shared interface per README.md:189-194

```typescript
export interface RateLimiter {
  allow(): boolean;
  reset(): void;
  getStats(): { remaining: number; resetAt: number };
}
```

#### 2. Configuration Constants
**File**: `backend/src/constants.ts` (new file)
**Changes**: Define algorithm parameters per README.md:275-311

```typescript
// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 100;
```

#### 3. Token Bucket Implementation
**File**: `backend/src/rate-limiters/token-bucket.ts` (new file)
**Changes**: Implement Token Bucket algorithm per README.md:202-212

```typescript
import type { RateLimiter } from '../types/rate-limiter.interface';
import { TOKEN_BUCKET_BURST_MULTIPLIER, TOKEN_BUCKET_REFILL_INTERVAL_MS } from '../constants';

export class TokenBucket implements RateLimiter {
  private capacity: number;
  private tokens: number;
  private lastRefill: number;
  private refillRate: number; // tokens per interval

  constructor(private rps: number) {
    this.capacity = Math.floor(rps * TOKEN_BUCKET_BURST_MULTIPLIER);
    this.tokens = this.capacity; // Start full
    this.lastRefill = Date.now();
    this.refillRate = rps / (1000 / TOKEN_BUCKET_REFILL_INTERVAL_MS);
  }

  allow(): boolean {
    this.refillTokens();

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
    this.refillTokens();

    // Calculate when bucket will be full again
    const tokensNeeded = this.capacity - this.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.refillRate);
    const resetAt = this.lastRefill + (intervalsNeeded * TOKEN_BUCKET_REFILL_INTERVAL_MS);

    return {
      remaining: Math.floor(this.tokens),
      resetAt,
    };
  }

  private refillTokens(): void {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefill;
    const intervalsElapsed = Math.floor(timeSinceLastRefill / TOKEN_BUCKET_REFILL_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

      // CRITICAL: Use interval-aligned timestamp to prevent drift
      this.lastRefill = this.lastRefill + (intervalsElapsed * TOKEN_BUCKET_REFILL_INTERVAL_MS);
    }
  }
}
```

#### 4. Leaky Bucket Implementation
**File**: `backend/src/rate-limiters/leaky-bucket.ts` (new file)
**Changes**: Implement Leaky Bucket algorithm per README.md:214-224

```typescript
import type { RateLimiter } from '../types/rate-limiter.interface';
import { LEAKY_BUCKET_QUEUE_MULTIPLIER, LEAKY_BUCKET_DRAIN_INTERVAL_MS } from '../constants';

export class LeakyBucket implements RateLimiter {
  private maxQueue: number;
  private queueCount: number;
  private lastDrain: number;
  private drainRate: number; // items per interval

  constructor(private rps: number) {
    this.maxQueue = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);
    this.queueCount = 0; // Start empty
    this.lastDrain = Date.now();
    this.drainRate = rps / (1000 / LEAKY_BUCKET_DRAIN_INTERVAL_MS);
  }

  allow(): boolean {
    this.drainQueue();

    if (this.queueCount < this.maxQueue) {
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
    this.drainQueue();

    // Calculate when queue will be empty
    const intervalsNeeded = Math.ceil(this.queueCount / this.drainRate);
    const resetAt = this.lastDrain + (intervalsNeeded * LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    return {
      remaining: this.maxQueue - Math.floor(this.queueCount),
      resetAt,
    };
  }

  private drainQueue(): void {
    const now = Date.now();
    const timeSinceLastDrain = now - this.lastDrain;
    const intervalsElapsed = Math.floor(timeSinceLastDrain / LEAKY_BUCKET_DRAIN_INTERVAL_MS);

    if (intervalsElapsed > 0) {
      const itemsToDrain = intervalsElapsed * this.drainRate;
      this.queueCount = Math.max(0, this.queueCount - itemsToDrain);

      // CRITICAL: Use interval-aligned timestamp to prevent drift
      this.lastDrain = this.lastDrain + (intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS);
    }
  }
}
```

#### 5. Limiter Factory
**File**: `backend/src/limiter-factory.ts` (new file)
**Changes**: Create factory for algorithm instantiation per README.md:38

```typescript
import type { RateLimiter } from './types/rate-limiter.interface';
import { TokenBucket } from './rate-limiters/token-bucket';
import { LeakyBucket } from './rate-limiters/leaky-bucket';

export type AlgorithmType = 'token-bucket' | 'leaky-bucket';

export class LimiterFactory {
  static create(algorithm: AlgorithmType, rps: number): RateLimiter {
    switch (algorithm) {
      case 'token-bucket':
        return new TokenBucket(rps);
      case 'leaky-bucket':
        return new LeakyBucket(rps);
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }
}
```

#### 6. Update Backend TypeScript Configuration
**File**: `backend/tsconfig.json` (new file)
**Changes**: Create TypeScript config for backend

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*", "index.ts"]
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compilation passes: `cd backend && bun run index.ts --check`
- [ ] No import errors when starting backend
- [ ] Backend starts successfully: `bun run dev:backend`

#### Manual Verification:
- [ ] Create test script to verify Token Bucket behavior:
  - Instantiate with RPS=10
  - Verify capacity = 20 tokens
  - Call `allow()` 20 times instantly, all return true
  - Call `allow()` once more, returns false
  - Wait 1 second
  - Call `allow()` 10 times, all return true
- [ ] Create test script to verify Leaky Bucket behavior:
  - Instantiate with RPS=10
  - Verify maxQueue = 15 slots
  - Call `allow()` 15 times instantly, all return true
  - Call `allow()` once more, returns false
  - Call `reset()` and verify queue clears
- [ ] Verify `getStats()` returns correct remaining and resetAt values
- [ ] Verify interval-aligned timestamps prevent timing drift

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Backend API Implementation

### Overview
Wire up the real rate limiting logic to the API endpoints, replacing placeholder responses with actual algorithm execution. Implement request validation, rate limit headers, and state management.

### Changes Required

#### 1. Update Backend Main File
**File**: `backend/index.ts`
**Changes**: Replace entire file with real implementation

```typescript
import type { RateLimiter } from './src/types/rate-limiter.interface';
import { LimiterFactory, type AlgorithmType } from './src/limiter-factory';

// Global state
let currentLimiter: RateLimiter = LimiterFactory.create('token-bucket', 10);
let currentAlgorithm: AlgorithmType = 'token-bucket';
let currentRPS = 10;

const PORT = Number(process.env.BACKEND_PORT) || 9000;
const DIST_DIR = new URL('../frontend/dist/', import.meta.url).pathname;

// API Handlers
function handleSettings(req: Request): Response {
  return req.json().then((body: { algorithm?: string; rps?: number }) => {
    const { algorithm, rps } = body;

    // Validation
    if (!algorithm || !['token-bucket', 'leaky-bucket'].includes(algorithm)) {
      return Response.json(
        { error: 'Invalid algorithm. Must be "token-bucket" or "leaky-bucket".' },
        { status: 400 }
      );
    }

    if (typeof rps !== 'number' || rps <= 0) {
      return Response.json(
        { error: 'Invalid RPS value. Must be a positive number.' },
        { status: 400 }
      );
    }

    // Update configuration
    currentAlgorithm = algorithm as AlgorithmType;
    currentRPS = rps;
    currentLimiter = LimiterFactory.create(currentAlgorithm, currentRPS);

    return Response.json({
      success: true,
      algorithm: currentAlgorithm,
      rps: currentRPS,
    });
  }).catch(() => {
    return Response.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  });
}

function handleTest(): Response {
  const allowed = currentLimiter.allow();
  const stats = currentLimiter.getStats();

  if (allowed) {
    return Response.json(
      {
        allowed: true,
        remaining: stats.remaining,
        resetAt: stats.resetAt,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': currentRPS.toString(),
          'X-RateLimit-Remaining': stats.remaining.toString(),
          'X-RateLimit-Reset': stats.resetAt.toString(),
        },
      }
    );
  } else {
    const retryAfter = Math.max(0, stats.resetAt - Date.now());

    return Response.json(
      {
        allowed: false,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': currentRPS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': stats.resetAt.toString(),
          'Retry-After': Math.ceil(retryAfter / 1000).toString(),
        },
      }
    );
  }
}

function handleHealth(): Response {
  const stats = currentLimiter.getStats();

  return Response.json({
    status: 'ok',
    algorithm: currentAlgorithm,
    rps: currentRPS,
    timestamp: Date.now(),
    stats: {
      remaining: stats.remaining,
      resetAt: stats.resetAt,
    },
  });
}

function handleReset(): Response {
  currentLimiter.reset();
  return new Response(null, { status: 204 });
}

// HTTP Server
Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // API routes
    if (url.pathname === '/settings' && req.method === 'POST') {
      return handleSettings(req);
    }

    if (url.pathname === '/test' && req.method === 'GET') {
      return handleTest();
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return handleHealth();
    }

    if (url.pathname === '/reset' && req.method === 'POST') {
      return handleReset();
    }

    // Static file serving (production mode)
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file(DIST_DIR + filePath);

    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback for client-side routing
    const indexFile = Bun.file(DIST_DIR + '/index.html');
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Backend server running on http://localhost:${PORT}`);
console.log(`Initial configuration: ${currentAlgorithm} @ ${currentRPS} RPS`);
```

### Success Criteria

#### Automated Verification:
- [ ] Backend starts without errors: `bun run dev:backend`
- [ ] TypeScript compilation passes
- [ ] All API endpoints respond correctly

#### Manual Verification:
- [ ] Use Explorer UI to test Token Bucket:
  - Set algorithm to "Token Bucket" and RPS to 10
  - Click "Apply Settings" and verify success feedback
  - Fire 25 instant requests
  - Verify 20 are allowed, 5 are rejected
  - Click "Reset Rate Limiter"
  - Fire 25 instant requests again
  - Verify same 20/5 split
- [ ] Use Explorer UI to test Leaky Bucket:
  - Set algorithm to "Leaky Bucket" and RPS to 10
  - Click "Apply Settings"
  - Fire 25 instant requests
  - Verify 15 are allowed, 10 are rejected
- [ ] Test sustained rate:
  - Set Token Bucket at 10 RPS
  - Fire 100 requests with 100ms delay
  - Verify ~100 requests allowed (long-term rate adherence)
- [ ] Test recovery:
  - Set Token Bucket at 10 RPS
  - Fire 25 instant requests (20 allowed, 5 rejected)
  - Wait 1 second
  - Fire 15 instant requests
  - Verify 10 allowed (refill rate working)
- [ ] Verify HTTP headers:
  - Check `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` in responses
  - Verify `Retry-After` header on 429 responses
- [ ] Test /health endpoint:
  - Navigate to `http://localhost:9000/health`
  - Verify JSON response with current algorithm, RPS, and stats
- [ ] Test configuration persistence:
  - Change to Leaky Bucket at 25 RPS
  - Fire requests and verify behavior matches new config
  - Check /health to confirm settings persisted

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: WebSocket Racing Mode

### Overview
Implement real-time WebSocket communication for the Algorithm Arena, replacing the simulation with actual dual-algorithm execution and 30fps state updates.

### Changes Required

#### 1. WebSocket Handler Module
**File**: `backend/src/websocket.ts` (new file)
**Changes**: Create WebSocket handler for racing mode

```typescript
import type { ServerWebSocket } from 'bun';
import type { RateLimiter } from './types/rate-limiter.interface';
import { LimiterFactory } from './limiter-factory';

interface RaceSession {
  foxLimiter: RateLimiter;
  hedgehogLimiter: RateLimiter;
  rps: number;
  duration: number;
  pattern: 'burst' | 'sustained' | 'chaos';
  startTime: number;
  intervalId: Timer | null;
  foxAccepted: number;
  foxRejected: number;
  hedgehogAccepted: number;
  hedgehogRejected: number;
}

interface RaceFrame {
  timestamp: number;
  foxState: {
    tokens?: number;
    capacity?: number;
    accepted: number;
    rejected: number;
  };
  hedgehogState: {
    queueSize?: number;
    maxQueue?: number;
    accepted: number;
    rejected: number;
  };
  event?: 'burst' | 'spike' | 'recovery';
}

const sessions = new Map<ServerWebSocket, RaceSession>();

export function handleWebSocket(ws: ServerWebSocket): void {
  ws.send(JSON.stringify({ type: 'connected' }));
}

export function handleWebSocketMessage(ws: ServerWebSocket, message: string): void {
  try {
    const data = JSON.parse(message);

    if (data.type === 'start-race') {
      startRace(ws, data);
    } else if (data.type === 'stop-race') {
      stopRace(ws);
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
  }
}

export function handleWebSocketClose(ws: ServerWebSocket): void {
  stopRace(ws);
}

function startRace(ws: ServerWebSocket, config: { rps: number; duration: number; pattern: string }): void {
  const { rps, duration, pattern } = config;

  // Validation
  if (!rps || rps <= 0 || rps > 1000) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid RPS value' }));
    return;
  }

  if (!duration || duration < 5 || duration > 60) {
    ws.send(JSON.stringify({ type: 'error', message: 'Duration must be between 5 and 60 seconds' }));
    return;
  }

  if (!['burst', 'sustained', 'chaos'].includes(pattern)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid pattern' }));
    return;
  }

  // Stop any existing race
  stopRace(ws);

  // Create new session
  const session: RaceSession = {
    foxLimiter: LimiterFactory.create('token-bucket', rps),
    hedgehogLimiter: LimiterFactory.create('leaky-bucket', rps),
    rps,
    duration,
    pattern: pattern as 'burst' | 'sustained' | 'chaos',
    startTime: Date.now(),
    intervalId: null,
    foxAccepted: 0,
    foxRejected: 0,
    hedgehogAccepted: 0,
    hedgehogRejected: 0,
  };

  sessions.set(ws, session);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'race-started',
    sessionId: generateSessionId(),
    rps,
    duration,
    pattern,
  }));

  // Start 30fps update loop (33.33ms per frame)
  session.intervalId = setInterval(() => {
    updateRaceFrame(ws, session);
  }, 33.33);

  // Auto-stop after duration
  setTimeout(() => {
    stopRace(ws);
  }, duration * 1000);
}

function updateRaceFrame(ws: ServerWebSocket, session: RaceSession): void {
  const elapsed = Date.now() - session.startTime;

  // Generate requests based on pattern
  const requestsThisFrame = generateRequests(session.pattern, session.rps);

  // Process requests through both algorithms
  for (let i = 0; i < requestsThisFrame; i++) {
    // Fox (Token Bucket)
    if (session.foxLimiter.allow()) {
      session.foxAccepted++;
    } else {
      session.foxRejected++;
    }

    // Hedgehog (Leaky Bucket)
    if (session.hedgehogLimiter.allow()) {
      session.hedgehogAccepted++;
    } else {
      session.hedgehogRejected++;
    }
  }

  // Get current state
  const foxStats = session.foxLimiter.getStats();
  const hedgehogStats = session.hedgehogLimiter.getStats();

  // Calculate internal state for visualization
  const foxCapacity = Math.floor(session.rps * 2.0);
  const foxTokens = foxStats.remaining;

  const hedgehogMaxQueue = Math.floor(session.rps * 1.5);
  const hedgehogQueueSize = hedgehogMaxQueue - hedgehogStats.remaining;

  const frame: RaceFrame = {
    timestamp: Date.now(),
    foxState: {
      tokens: foxTokens,
      capacity: foxCapacity,
      accepted: session.foxAccepted,
      rejected: session.foxRejected,
    },
    hedgehogState: {
      queueSize: hedgehogQueueSize,
      maxQueue: hedgehogMaxQueue,
      accepted: session.hedgehogAccepted,
      rejected: session.hedgehogRejected,
    },
  };

  // Detect events
  if (requestsThisFrame > session.rps / 10) {
    frame.event = 'burst';
  }

  ws.send(JSON.stringify({ type: 'race-frame', frame }));
}

function stopRace(ws: ServerWebSocket): void {
  const session = sessions.get(ws);
  if (!session) return;

  if (session.intervalId) {
    clearInterval(session.intervalId);
  }

  // Send final results
  const foxTotal = session.foxAccepted + session.foxRejected;
  const hedgehogTotal = session.hedgehogAccepted + session.hedgehogRejected;

  let winner: 'fox' | 'hedgehog' | 'tie';
  if (session.foxAccepted > session.hedgehogAccepted) {
    winner = 'fox';
  } else if (session.hedgehogAccepted > session.foxAccepted) {
    winner = 'hedgehog';
  } else {
    winner = 'tie';
  }

  ws.send(JSON.stringify({
    type: 'race-stopped',
    winner,
    metrics: {
      fox: { accepted: session.foxAccepted, rejected: session.foxRejected },
      hedgehog: { accepted: session.hedgehogAccepted, rejected: session.hedgehogRejected },
    },
  }));

  sessions.delete(ws);
}

function generateRequests(pattern: string, rps: number): number {
  switch (pattern) {
    case 'burst':
      // Random bursts
      return Math.random() < 0.1 ? Math.floor(rps * 2 * Math.random()) : 0;
    case 'sustained':
      // Steady rate (rps / 30fps)
      return rps / 30;
    case 'chaos':
      // Random chaos
      return Math.floor(Math.random() * rps);
    default:
      return 0;
  }
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15);
}
```

#### 2. Update Backend Main File
**File**: `backend/index.ts`
**Changes**: Add WebSocket upgrade handling

```typescript
import type { ServerWebSocket } from 'bun';
import type { RateLimiter } from './src/types/rate-limiter.interface';
import { LimiterFactory, type AlgorithmType } from './src/limiter-factory';
import { handleWebSocket, handleWebSocketMessage, handleWebSocketClose } from './src/websocket';

// Global state
let currentLimiter: RateLimiter = LimiterFactory.create('token-bucket', 10);
let currentAlgorithm: AlgorithmType = 'token-bucket';
let currentRPS = 10;

const PORT = Number(process.env.BACKEND_PORT) || 9000;
const DIST_DIR = new URL('../frontend/dist/', import.meta.url).pathname;

// API Handlers (keep existing implementation from Phase 5)
function handleSettings(req: Request): Response {
  return req.json().then((body: { algorithm?: string; rps?: number }) => {
    const { algorithm, rps } = body;

    if (!algorithm || !['token-bucket', 'leaky-bucket'].includes(algorithm)) {
      return Response.json(
        { error: 'Invalid algorithm. Must be "token-bucket" or "leaky-bucket".' },
        { status: 400 }
      );
    }

    if (typeof rps !== 'number' || rps <= 0) {
      return Response.json(
        { error: 'Invalid RPS value. Must be a positive number.' },
        { status: 400 }
      );
    }

    currentAlgorithm = algorithm as AlgorithmType;
    currentRPS = rps;
    currentLimiter = LimiterFactory.create(currentAlgorithm, currentRPS);

    return Response.json({
      success: true,
      algorithm: currentAlgorithm,
      rps: currentRPS,
    });
  }).catch(() => {
    return Response.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  });
}

function handleTest(): Response {
  const allowed = currentLimiter.allow();
  const stats = currentLimiter.getStats();

  if (allowed) {
    return Response.json(
      {
        allowed: true,
        remaining: stats.remaining,
        resetAt: stats.resetAt,
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': currentRPS.toString(),
          'X-RateLimit-Remaining': stats.remaining.toString(),
          'X-RateLimit-Reset': stats.resetAt.toString(),
        },
      }
    );
  } else {
    const retryAfter = Math.max(0, stats.resetAt - Date.now());

    return Response.json(
      {
        allowed: false,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': currentRPS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': stats.resetAt.toString(),
          'Retry-After': Math.ceil(retryAfter / 1000).toString(),
        },
      }
    );
  }
}

function handleHealth(): Response {
  const stats = currentLimiter.getStats();

  return Response.json({
    status: 'ok',
    algorithm: currentAlgorithm,
    rps: currentRPS,
    timestamp: Date.now(),
    stats: {
      remaining: stats.remaining,
      resetAt: stats.resetAt,
    },
  });
}

function handleReset(): Response {
  currentLimiter.reset();
  return new Response(null, { status: 204 });
}

// HTTP Server with WebSocket support
Bun.serve({
  port: PORT,
  async fetch(req: Request, server): Promise<Response> {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === '/ws/race') {
      const upgraded = server.upgrade(req);
      if (upgraded) {
        return undefined as any; // WebSocket connection established
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // API routes
    if (url.pathname === '/settings' && req.method === 'POST') {
      return handleSettings(req);
    }

    if (url.pathname === '/test' && req.method === 'GET') {
      return handleTest();
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return handleHealth();
    }

    if (url.pathname === '/reset' && req.method === 'POST') {
      return handleReset();
    }

    // Static file serving
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file(DIST_DIR + filePath);

    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback
    const indexFile = Bun.file(DIST_DIR + '/index.html');
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket) {
      handleWebSocket(ws);
    },
    message(ws: ServerWebSocket, message: string | Buffer) {
      const msg = typeof message === 'string' ? message : message.toString();
      handleWebSocketMessage(ws, msg);
    },
    close(ws: ServerWebSocket) {
      handleWebSocketClose(ws);
    },
  },
});

console.log(`Backend server running on http://localhost:${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws/race`);
console.log(`Initial configuration: ${currentAlgorithm} @ ${currentRPS} RPS`);
```

#### 3. Update Arena Frontend to Use WebSocket
**File**: `frontend/src/routes/arena/index.ts`
**Changes**: Replace simulation with WebSocket connection

Replace the `handleStartRace()` and simulation functions with:

```typescript
let ws: WebSocket | null = null;

function handleStartRace(): void {
  const rpsInput = document.getElementById('race-rps') as HTMLInputElement;
  const durationInput = document.getElementById('race-duration') as HTMLInputElement;
  const patternSelect = document.getElementById('race-pattern') as HTMLSelectElement;
  const startBtn = document.getElementById('start-race-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-race-btn') as HTMLButtonElement;
  const statusText = document.getElementById('race-status-text');

  const rps = parseInt(rpsInput.value, 10);
  const duration = parseInt(durationInput.value, 10);
  const pattern = patternSelect.value;

  // Reset state
  foxState = { accepted: 0, rejected: 0 };
  hedgehogState = { accepted: 0, rejected: 0 };

  // Update UI
  isRacing = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  if (statusText) statusText.textContent = `Connecting...`;

  // Connect to WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.hostname}:9000/ws/race`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (statusText) statusText.textContent = `Racing (${duration}s)`;

    // Start race
    ws?.send(JSON.stringify({
      type: 'start-race',
      rps,
      duration,
      pattern,
    }));

    // Start render loop
    startRenderLoop();
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'race-frame') {
      updateStateFromFrame(data.frame);
    } else if (data.type === 'race-stopped') {
      handleRaceComplete(data);
    } else if (data.type === 'error') {
      console.error('WebSocket error:', data.message);
      if (statusText) statusText.textContent = `Error: ${data.message}`;
      handleStopRace();
    }
  };

  ws.onerror = () => {
    if (statusText) statusText.textContent = 'Connection error';
    handleStopRace();
  };

  ws.onclose = () => {
    if (isRacing) {
      if (statusText) statusText.textContent = 'Connection closed';
      handleStopRace();
    }
  };
}

function handleStopRace(): void {
  const startBtn = document.getElementById('start-race-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-race-btn') as HTMLButtonElement;
  const statusText = document.getElementById('race-status-text');

  isRacing = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'stop-race' }));
    ws.close();
  }
  ws = null;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (statusText) statusText.textContent = 'Race stopped';
}

function updateStateFromFrame(frame: any): void {
  foxState = {
    tokens: frame.foxState.tokens,
    capacity: frame.foxState.capacity,
    accepted: frame.foxState.accepted,
    rejected: frame.foxState.rejected,
  };

  hedgehogState = {
    queueSize: frame.hedgehogState.queueSize,
    maxQueue: frame.hedgehogState.maxQueue,
    accepted: frame.hedgehogState.accepted,
    rejected: frame.hedgehogState.rejected,
  };
}

function handleRaceComplete(data: any): void {
  const statusText = document.getElementById('race-status-text');
  if (statusText) statusText.textContent = 'Race complete';

  updateWinnerDisplay();
  handleStopRace();
}
```

### Success Criteria

#### Automated Verification:
- [ ] Backend starts with WebSocket support: `bun run dev:backend`
- [ ] TypeScript compilation passes for both frontend and backend
- [ ] No console errors when connecting WebSocket

#### Manual Verification:
- [ ] Navigate to `/arena` in browser
- [ ] Enter RPS=20, Duration=15s, Pattern=Burst
- [ ] Click "Start Race" and verify:
  - Status changes to "Connecting..." then "Racing (15s)"
  - WebSocket connection establishes (check browser DevTools Network tab)
  - Token bucket visualization updates smoothly (~30fps)
  - Leaky bucket visualization updates smoothly
  - Accepted/Rejected metrics increment in real-time
  - Both algorithms process the same traffic
- [ ] Verify different patterns:
  - Burst: See sporadic large spikes in requests
  - Sustained: See steady request flow
  - Chaos: See random fluctuations
- [ ] Click "Stop Race" before timer ends and verify:
  - WebSocket closes cleanly
  - Visualization stops updating
  - Winner display shows result
- [ ] Test race completion:
  - Start 10-second race
  - Wait for auto-stop
  - Verify final metrics displayed correctly
- [ ] Test reconnection:
  - Start race, stop it, start another race
  - Verify no stale state from previous race
- [ ] Verify comparative metrics:
  - Check that Fox (Token Bucket) typically accepts more burst traffic
  - Check that Hedgehog (Leaky Bucket) has smoother queue behavior
  - Verify winner calculation matches accepted counts

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 7: Testing Infrastructure & Validation

### Overview
Set up Bun's test runner infrastructure and create algorithm validation tests per the README specification. This phase focuses on automated verification of algorithm correctness.

### Changes Required

#### 1. Test Configuration
**File**: `backend/package.json` (new file)
**Changes**: Create backend package.json with test script

```json
{
  "name": "devcolor-presentation-demo-backend",
  "type": "module",
  "scripts": {
    "test": "bun test",
    "dev": "bun --watch index.ts"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

#### 2. Token Bucket Validation Tests
**File**: `backend/src/rate-limiters/token-bucket.test.ts` (new file)
**Changes**: Create test suite for Token Bucket per README.md:889-997

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { TokenBucket } from './token-bucket';

describe('Token Bucket Algorithm', () => {
  let limiter: TokenBucket;

  beforeEach(() => {
    limiter = new TokenBucket(10);
  });

  test('Test 1: Burst Capacity (Instant Load)', () => {
    // Configuration: 10 RPS
    // Expected capacity: 10 × 2.0 = 20 tokens

    let allowed = 0;
    let rejected = 0;

    // Fire 25 requests instantly
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }
    }

    expect(allowed).toBe(20);
    expect(rejected).toBe(5);
  });

  test('Test 2: Rate Enforcement (Sustained Load)', async () => {
    // Configuration: 10 RPS
    // Fire 100 requests with 100ms delay (simulates 10 RPS load)

    let allowed = 0;
    let rejected = 0;

    for (let i = 0; i < 100; i++) {
      if (limiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }

      // Wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Should allow ~100 requests (long-term rate adherence)
    expect(allowed).toBeGreaterThanOrEqual(95);
    expect(allowed).toBeLessThanOrEqual(100);
  });

  test('Test 3: Recovery After Exhaustion', async () => {
    // Fire 25 requests instantly
    let firstBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) firstBurstAllowed++;
    }
    expect(firstBurstAllowed).toBe(20);

    // Wait 1 second (should refill 10 tokens)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fire 15 requests
    let secondBurstAllowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) secondBurstAllowed++;
    }

    // Should allow 10 requests (refill rate = 10 tokens/second)
    expect(secondBurstAllowed).toBeGreaterThanOrEqual(9);
    expect(secondBurstAllowed).toBeLessThanOrEqual(11);
  });

  test('Test 4: Full Recovery After Idle Period', async () => {
    // Fire 25 requests instantly
    let firstBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) firstBurstAllowed++;
    }
    expect(firstBurstAllowed).toBe(20);

    // Wait 2 seconds (should fully refill to 20)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fire 25 requests
    let secondBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) secondBurstAllowed++;
    }

    expect(secondBurstAllowed).toBe(20);
  });

  test('Test 5: Low Rate Configuration', () => {
    const lowRateLimiter = new TokenBucket(1);

    let allowed = 0;
    let rejected = 0;

    // Fire 5 requests instantly
    for (let i = 0; i < 5; i++) {
      if (lowRateLimiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }
    }

    // Capacity = 1 × 2.0 = 2 tokens
    expect(allowed).toBe(2);
    expect(rejected).toBe(3);
  });

  test('Test 6: High Rate Configuration', () => {
    const highRateLimiter = new TokenBucket(100);

    let allowed = 0;
    let rejected = 0;

    // Fire 500 requests instantly
    for (let i = 0; i < 500; i++) {
      if (highRateLimiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }
    }

    // Capacity = 100 × 2.0 = 200 tokens
    expect(allowed).toBe(200);
    expect(rejected).toBe(300);
  });

  test('Reset Functionality', () => {
    // Exhaust bucket
    for (let i = 0; i < 25; i++) {
      limiter.allow();
    }

    // Reset should restore to full capacity
    limiter.reset();

    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) allowed++;
    }

    expect(allowed).toBe(20);
  });

  test('getStats() Returns Correct Values', () => {
    const stats = limiter.getStats();

    expect(stats.remaining).toBe(20); // Full capacity initially
    expect(stats.resetAt).toBeGreaterThan(Date.now()); // Reset time in future
  });
});
```

#### 3. Leaky Bucket Validation Tests
**File**: `backend/src/rate-limiters/leaky-bucket.test.ts` (new file)
**Changes**: Create test suite for Leaky Bucket

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { LeakyBucket } from './leaky-bucket';

describe('Leaky Bucket Algorithm', () => {
  let limiter: LeakyBucket;

  beforeEach(() => {
    limiter = new LeakyBucket(10);
  });

  test('Test 1: Burst Capacity (Instant Load)', () => {
    // Configuration: 10 RPS
    // Expected queue size: 10 × 1.5 = 15 slots

    let allowed = 0;
    let rejected = 0;

    // Fire 25 requests instantly
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }
    }

    expect(allowed).toBe(15);
    expect(rejected).toBe(10);
  });

  test('Test 2: Rate Enforcement (Sustained Load)', async () => {
    let allowed = 0;
    let rejected = 0;

    for (let i = 0; i < 100; i++) {
      if (limiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(allowed).toBeGreaterThanOrEqual(95);
    expect(allowed).toBeLessThanOrEqual(100);
  });

  test('Test 3: Recovery After Exhaustion', async () => {
    let firstBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) firstBurstAllowed++;
    }
    expect(firstBurstAllowed).toBe(15);

    // Wait 1 second (should drain ~10 items)
    await new Promise(resolve => setTimeout(resolve, 1000));

    let secondBurstAllowed = 0;
    for (let i = 0; i < 15; i++) {
      if (limiter.allow()) secondBurstAllowed++;
    }

    expect(secondBurstAllowed).toBeGreaterThanOrEqual(9);
    expect(secondBurstAllowed).toBeLessThanOrEqual(11);
  });

  test('Test 4: Full Recovery After Idle Period', async () => {
    let firstBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) firstBurstAllowed++;
    }
    expect(firstBurstAllowed).toBe(15);

    // Wait 2 seconds (should fully drain queue)
    await new Promise(resolve => setTimeout(resolve, 2000));

    let secondBurstAllowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) secondBurstAllowed++;
    }

    expect(secondBurstAllowed).toBe(15);
  });

  test('Test 5: Low Rate Configuration', () => {
    const lowRateLimiter = new LeakyBucket(1);

    let allowed = 0;
    let rejected = 0;

    for (let i = 0; i < 5; i++) {
      if (lowRateLimiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }
    }

    // Queue = 1 × 1.5 = 1 slot (rounded down)
    expect(allowed).toBe(1);
    expect(rejected).toBe(4);
  });

  test('Test 6: High Rate Configuration', () => {
    const highRateLimiter = new LeakyBucket(100);

    let allowed = 0;
    let rejected = 0;

    for (let i = 0; i < 500; i++) {
      if (highRateLimiter.allow()) {
        allowed++;
      } else {
        rejected++;
      }
    }

    // Queue = 100 × 1.5 = 150 slots
    expect(allowed).toBe(150);
    expect(rejected).toBe(350);
  });

  test('Reset Functionality', () => {
    // Fill queue
    for (let i = 0; i < 25; i++) {
      limiter.allow();
    }

    limiter.reset();

    let allowed = 0;
    for (let i = 0; i < 25; i++) {
      if (limiter.allow()) allowed++;
    }

    expect(allowed).toBe(15);
  });

  test('getStats() Returns Correct Values', () => {
    const stats = limiter.getStats();

    expect(stats.remaining).toBe(15); // Full queue capacity initially
    expect(stats.resetAt).toBeGreaterThan(Date.now());
  });
});
```

#### 4. Update Root Package.json
**File**: `package.json`
**Changes**: Add test script to root orchestration

```json
{
  "scripts": {
    "dev": "bun run dev:backend",
    "dev:frontend": "cd frontend && bun run dev",
    "dev:backend": "cd backend && bun --watch index.ts",
    "dev:all": "concurrently \"bun run dev:backend\" \"bun run dev:frontend\"",
    "build:frontend": "cd frontend && bun run build",
    "build:all": "bun run build:frontend",
    "serve:prod": "cd backend && bun index.ts",
    "test": "cd backend && bun test",
    "test:watch": "cd backend && bun test --watch"
  }
}
```

### Success Criteria

#### Automated Verification:
- [ ] All tests pass: `bun test`
- [ ] No test failures or errors
- [ ] Test runner output shows all passing tests

#### Manual Verification:
- [ ] Run `bun test` from project root and verify:
  - Token Bucket tests all pass (8 tests)
  - Leaky Bucket tests all pass (8 tests)
  - Total: 16 tests passing
- [ ] Run `bun test --watch` and verify:
  - Tests re-run on file changes
  - Watch mode works correctly
- [ ] Review test output for timing:
  - Tests with delays take expected time (~10s for full suite)
  - Instant tests complete quickly
- [ ] Verify test coverage:
  - All 7 validation scenarios from README covered
  - Reset functionality tested
  - getStats() tested
  - Edge cases (low/high RPS) tested

**Implementation Note**: After completing this phase and all automated verification passes, the implementation is complete. All features are functional and tested.

---

## Performance Considerations

### Frontend Rendering
- Target 30fps for canvas updates (33.33ms per frame)
- Use `requestAnimationFrame` with delta time checking
- Batch DOM updates to minimize reflows
- Canvas operations optimized (minimal clears, efficient drawing)

### WebSocket Communication
- 30 updates per second = 33.33ms interval on backend
- JSON serialization kept simple (no complex nested structures)
- Frame data size minimized (<1KB per frame)
- Client handles frames asynchronously (no blocking)

### Backend Rate Limiting
- Lazy evaluation (calculate on-demand, don't use timers)
- Interval-aligned timestamps prevent drift
- O(1) complexity for all algorithm operations
- Global state (in-memory, no database)

## Migration Notes

Not applicable - this is a new implementation with no existing data to migrate.

## References

- Original specification: `README.md`
- Research document: `thoughts/shared/research/2025-10-17-readme-implementation-status.md`
- Commit c13f950: Simplified architecture removing SQLite, workers, service workers
- Token Bucket algorithm: `README.md:202-212`
- Leaky Bucket algorithm: `README.md:214-224`
- WebSocket racing protocol: `README.md:588-610`
- Validation test scenarios: `README.md:889-997`
