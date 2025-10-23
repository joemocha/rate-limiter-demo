# Fox vs. Hedgehog Rate Limiting Demo - Specification

This document specifies the requirements for a demo application that illustrates the contrasting problem-solving approaches of the fox and the hedgehog. The project centers on a rate limiting scenario that highlights how each mindset explores or commits to a strategy when taming bursty traffic.

## Application Overview

- **Architecture**
  - **Landing Page**: Interactive hub showcasing Fox vs Hedgehog philosophy through choice of exploration paths
  - **Algorithm Explorer**: Single-algorithm testing environment for deep parameter tuning (existing UI)
  - **Algorithm Arena**: Head-to-head racing visualization for comparative analysis (new feature)
  - **Shared Backend**: Unified API supporting both experiences with consistent rate limiting implementations
- **Purpose**: Demonstrate how broad experimentation (fox) and focused mastery (hedgehog) influence the design and tuning of rate limiting solutions.

## Technology Stack

- **Runtime**: Bun (TypeScript/JavaScript runtime, bundler, and HTTP server)
- **Backend**: Native `Bun.serve` with WebSocket support
- **Backend Port**: 9000
- **Frontend**: TypeScript (bundled with `bun build`)
- **State Management**: In-memory global counter
- **Rate Limiting Scope**: Global (shared across all clients)

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Bun.serve entry point
│   │   ├── constants.ts             # Algorithm tuning parameters
│   │   ├── websocket.ts             # WebSocket handler for racing
│   │   ├── rate-limiters/
│   │   │   ├── token-bucket.ts      # Token bucket implementation
│   │   │   ├── leaky-bucket.ts      # Leaky bucket implementation
│   │   │   ├── fixed-window.ts      # Fixed window counter (optional)
│   │   │   ├── sliding-window.ts    # Sliding window counter (optional)
│   │   │   └── sliding-log.ts       # Sliding log implementation (optional)
│   │   └── limiter-factory.ts       # Factory for algorithm instantiation
│   ├── package.json
│   └── .gitignore
│
├── frontend/                         # Unified SPA (all routes)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── landing/             # Landing page components (/)
│   │   │   │   ├── index.ts
│   │   │   │   └── style.css
│   │   │   ├── explorer/            # Algorithm Explorer (/explorer)
│   │   │   │   ├── index.ts
│   │   │   │   └── style.css
│   │   │   └── arena/               # Algorithm Arena (/arena)
│   │   │       ├── index.ts
│   │   │       ├── workers/         # Web Workers for computation
│   │   │       │   └── algorithm-worker.ts
│   │   │       ├── visualizations/  # Canvas components
│   │   │       │   ├── race-track.ts
│   │   │       │   └── particles.ts
│   │   │       └── style.css
│   │   ├── shared/
│   │   │   ├── router.ts            # Client-side routing (History API)
│   │   │   ├── config-service.ts    # Shared configuration state
│   │   │   └── types.ts
│   │   ├── main.ts                  # App entry point
│   │   └── style.css                # Global styles
│   ├── index.html                   # Single entry point
│   └── package.json
│
└── README.md
```

## API Endpoints

### POST `/settings`

Configure the active rate-limiting algorithm and the allowed request rate in requests per second.

**Request Body:**
```json
{
  "algorithm": "token-bucket",  // One of: "token-bucket", "leaky-bucket". Optional if added: "fixed-window", "sliding-window", "sliding-log"
  "rps": 10                     // Requests per second (must be > 0)
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "algorithm": "token-bucket",
  "rps": 10
}
```

**Response 400 (Validation Error):**
```json
{
  "error": "Invalid algorithm or RPS value"
}
```

**Validation Rules:**
- `algorithm` must be one of: `token-bucket`, `leaky-bucket`. Optional extras (`fixed-window`, `sliding-window`, `sliding-log`) are supported only if implemented.
- `rps` must be a positive number greater than 0

### GET `/test`

Receive client requests to evaluate how the current configuration reacts under load.

**Response 200 (Request Allowed):**
```json
{
  "allowed": true,
  "remaining": 8,               // Tokens/capacity remaining
  "resetAt": 1697123456789      // Unix timestamp when limit resets
}
```

**Response 429 (Request Rejected - Rate Limited):**
```json
{
  "allowed": false,
  "retryAfter": 250             // Milliseconds until next allowed request
}
```

**Response Headers (both 200 and 429):**
- `X-RateLimit-Limit`: Maximum requests per second configured
- `X-RateLimit-Remaining`: Available capacity in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `Retry-After`: (429 only) Seconds until retry is recommended

### GET `/health`

Server health check endpoint that provides real-time status and rate limiting configuration.

**Response 200 (Success):**
```json
{
  "status": "ok",
  "algorithm": "token-bucket",
  "rps": 10,
  "timestamp": 1697123456789,
  "stats": {
    "remaining": 18,
    "resetAt": 1697123460000
  }
}
```

**Response Fields:**
- `status`: Server health status (always "ok" when server is running)
- `algorithm`: Currently active rate limiting algorithm
- `rps`: Configured requests per second limit
- `timestamp`: Current server time (Unix timestamp in milliseconds)
- `stats.remaining`: Available capacity (tokens for Token Bucket, queue slots for Leaky Bucket)
- `stats.resetAt`: Unix timestamp (in milliseconds) when the rate limiter resets or next processes requests

**Use Cases:**
- Browser-based health monitoring (check if server is alive)
- Dashboard displays of current rate limiting state
- Debugging rate limiter behavior in real-time
- Integration health checks for load balancers

### POST `/reset`

Manually reset the rate limiter to its initial state, clearing all accumulated state (tokens, queue, timestamps).

**Request Body:** None required

**Response 204 (No Content):**
No response body is returned. Success is indicated by the 204 status code.

**Effect by Algorithm:**
- **Token Bucket**: Refills the bucket to full capacity (capacity = rps × burst multiplier)
- **Leaky Bucket**: Clears the queue to empty, resets drain timestamp

**Use Cases:**
- Testing different scenarios from a clean state
- Recovering from test bursts without restarting the server
- Quick reset between algorithm comparisons
- Resetting state during development and debugging

## Rate Limiting Algorithms

All algorithms SHALL implement a common interface with the following contract.

**Location:** `backend/src/types/rate-limiter.interface.ts`

```ts
interface RateLimiter {
  allow(): boolean;                       // Returns boolean (true = allow, false = reject)
  reset(): void;                          // Clear internal state
  getStats(): { remaining: number; resetAt: number }; // Returns { remaining, resetAt }
}
```

Each implementation SHALL:
- Accept `rps: number` in its constructor
- Implement all three methods defined in the interface
- Maintain internal state for rate limiting calculations

### 1. Token Bucket

**Mechanism:** Maintains a bucket with a maximum capacity of tokens. Tokens are added at a fixed rate (refill). Each request consumes one token. Allows bursts up to bucket capacity.

**Characteristics:**
- **Burst tolerance**: High (permits `capacity` requests instantly)
- **Boundary effects**: None
- **Memory**: O(1) - stores token count and last refill timestamp
- **CPU**: O(1) per request

**Use case:** Systems that tolerate controlled bursts but enforce long-term average rate.

### 2. Leaky Bucket

**Mechanism:** Requests are added to a queue (bucket) and processed at a fixed rate (leak rate). If queue is full, requests are rejected.

**Characteristics:**
- **Burst tolerance**: Medium (smooths bursts via queue)
- **Boundary effects**: None
- **Memory**: O(queue_size) - stores pending requests
- **CPU**: O(1) per request + O(1) per drain tick

**Use case:** Systems requiring smooth, predictable output rate regardless of input spikes.

### 3. Fixed Window (Optional)

**Mechanism:** Counts requests in fixed time windows (e.g., 0-1s, 1-2s). Counter resets at window boundaries.

**Characteristics:**
- **Burst tolerance**: None within window
- **Boundary effects**: **High** - double rate possible at window edges (last request at 0.999s, next at 1.001s)
- **Memory**: O(1) - stores count and window start time
- **CPU**: O(1) per request

**Use case:** Simple implementation where boundary burst is acceptable trade-off.

### 4. Sliding Window (Optional)

**Mechanism:** Divides time into small segments. Calculates weighted sum of request counts across segments to smooth boundary effects.

**Weighting Formula:**
- **Current segment** (where time = now): Weight = 1.0 (counted fully)
- **Previous segments**: Weight = 1 - (age_in_segments / total_segments)
  - Example: In a 10-segment window, a segment 3 positions old has weight = 1 - (3/10) = 0.7
  - Segments older than the window size have weight = 0

**Implementation Note:** The current partial segment is counted at full weight because it represents requests happening "now" within the current rate limit window.

**Characteristics:**
- **Burst tolerance**: Low (distributed across window)
- **Boundary effects**: Low (weighted smoothing reduces edge bursts)
- **Memory**: O(segments) - stores counts per segment
- **CPU**: O(segments) per request (weighted sum calculation)

**Use case:** Balance between accuracy and efficiency, reduced boundary bursts vs. fixed window.

### 5. Sliding Log (Optional)

**Mechanism:** Maintains a log of exact request timestamps. Counts requests within the sliding time window by filtering expired entries.

**Memory Management:**
- **MUST check memory limit BEFORE adding entries**: `if (log.length >= MAX_ENTRIES) reject()`
- **Never allow log to exceed MAX_ENTRIES** even temporarily
- The check prevents the log from ever reaching MAX_ENTRIES + 1

**Characteristics:**
- **Burst tolerance**: None (precise enforcement)
- **Boundary effects**: None (continuous sliding window)
- **Memory**: O(rps * window_size) - grows with request rate
- **CPU**: O(log_size) per request (filter expired timestamps)

**Use case:** Strict rate enforcement where precision trumps resource efficiency.

## Algorithm Configuration Constants

Tunable parameters exposing algorithmic trade-offs (defined in `constants.ts`):

### Token Bucket
```ts
TOKEN_BUCKET_BURST_MULTIPLIER = 2.0      // Burst capacity = rps × multiplier
TOKEN_BUCKET_REFILL_INTERVAL_MS = 100    // Token addition frequency (granularity)
```
**Trade-off:** Higher multiplier = more burst tolerance, lower = stricter rate adherence.

### Leaky Bucket
```ts
LEAKY_BUCKET_QUEUE_MULTIPLIER = 2.0      // Queue depth = rps × multiplier
LEAKY_BUCKET_DRAIN_INTERVAL_MS = 100      // Request processing tick rate
```
**Trade-off:** Larger queue = more buffering, higher memory; faster drain = smoother output.

### Fixed Window (Optional)
```ts
FIXED_WINDOW_SIZE_MS = 1000              // Window duration (reset period)
```
**Trade-off:** Smaller window = more frequent resets, higher boundary burst risk.

### Sliding Window (Optional)
```ts
SLIDING_WINDOW_SIZE_MS = 1000            // Total window duration
SLIDING_WINDOW_SEGMENTS = 10             // Sub-window count (100ms each)
```
**Trade-off:** More segments = smoother rate enforcement, higher memory/CPU cost.

### Sliding Log (Optional)
```ts
SLIDING_LOG_WINDOW_MS = 1000             // Tracking window duration
SLIDING_LOG_MAX_ENTRIES = 10000          // Maximum log size (prevents memory leak)
```
**Trade-off:** Larger max entries = supports higher burst rates, more memory consumption.

## Environment Configuration

### Backend Configuration
The backend SHALL support the following environment variables:
- `BACKEND_PORT`: Port for API server (default: 9000)

### Frontend Configuration
The frontend dev server SHALL support the following environment variable:
- `API_PROXY_TARGET`: Backend API base URL for proxying (default: http://localhost:9000)

**Note**: In production, the backend serves the frontend, so no frontend environment variables are needed.

## Landing Page & Navigation

### Route Structure

The frontend is a single-page application (SPA) using client-side routing (History API):
- `/` - Landing page with mode selection
- `/explorer` - Classic single-algorithm tester
- `/arena` - Algorithm racing visualization

All routes are served from `http://localhost:5173` with navigation handled client-side via `router.navigate()` for seamless transitions without page reloads.

### Landing Page Design

The landing page embodies the Fox vs Hedgehog philosophy through interactive choice:

**Visual Layout:**
```
┌──────────────────────────────────────┐
│     Fox vs. Hedgehog Rate Limiting    │
│         Choose Your Path               │
├──────────────────────────────────────┤
│                                        │
│  🦊 Algorithm Explorer    🏁 Algorithm Arena │
│  "The Fox knows many      "Race algorithms  │
│   things..."               head-to-head"    │
│                                        │
│  [Single Algorithm]       [Dual Racing]     │
│  [Detailed Analysis]      [Visual Compare]  │
│  [Parameter Tuning]       [Live Metrics]    │
│                                        │
│  [Enter Explorer →]       [Enter Arena →]   │
│                                        │
└──────────────────────────────────────┘
```

### Smart Default System

```typescript
interface NavigationState {
  lastVisited: 'explorer' | 'arena' | null;
  visitCount: number;
  preferences: {
    algorithm: string;
    rps: number;
    theme: 'light' | 'dark';
  };
}

// On page load - auto-navigate to last visited mode
const navState = localStorage.getItem('navState');
if (navState && navState.lastVisited) {
  // Auto-navigate after 2s with cancel option
  navigateWithDelay(`/${navState.lastVisited}`);
}
```

### Shared Configuration Service

Settings are synchronized between both modes to maintain consistency:

```typescript
// Synchronized settings between modes
class SharedConfigService {
  private config = {
    rps: 10,
    primaryAlgorithm: 'token-bucket',
    secondaryAlgorithm: 'leaky-bucket'
  };

  // Both UIs subscribe to changes
  subscribe(listener: ConfigListener) {
    this.listeners.push(listener);
  }

  // Settings persist across mode switches (in-memory + localStorage)
  updateRPS(value: number) {
    this.config.rps = value;
    this.broadcast();
    localStorage.setItem('sharedConfig', JSON.stringify(this.config));
  }
}
```

### Client-Side Router Implementation

The router uses the History API for seamless navigation without page reloads:

```typescript
// frontend/src/shared/router.ts
class Router {
  private routes: Map<string, () => void> = new Map();
  private currentRoute: string = '/';

  constructor() {
    // Handle browser back/forward
    window.addEventListener('popstate', () => this.handleRoute());

    // Intercept link clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && target.getAttribute('data-route')) {
        e.preventDefault();
        this.navigate(target.getAttribute('data-route')!);
      }
    });
  }

  register(path: string, handler: () => void) {
    this.routes.set(path, handler);
  }

  navigate(path: string) {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  private handleRoute() {
    const path = window.location.pathname;
    const handler = this.routes.get(path);

    if (handler) {
      this.currentRoute = path;
      handler();
    } else {
      // 404 fallback
      this.navigate('/');
    }
  }
}

// Usage in main.ts
const router = new Router();

router.register('/', () => {
  // Render landing page
  document.getElementById('app').innerHTML = renderLanding();
});

router.register('/explorer', () => {
  // Render explorer UI
  document.getElementById('app').innerHTML = renderExplorer();
});

router.register('/arena', () => {
  // Render arena UI
  document.getElementById('app').innerHTML = renderArena();
});

// Initial route
router.handleRoute();
```

**Navigation Best Practices:**
- Use `<a data-route="/explorer">` for internal links (router intercepts)
- Call `router.navigate()` for programmatic navigation
- Shared state persists across route changes (in-memory singleton)
- Use `history.replaceState()` for redirects without history entry

## Algorithm Explorer (Classic Mode)

*This is the existing single-algorithm testing interface, preserved as originally specified.*

### Configuration Panel

**Components:**
1. **Algorithm Selector**: Dropdown with available options (minimum 2 required)
   - Token Bucket
   - Leaky Bucket
   - Fixed Window (Optional)
   - Sliding Window (Optional)
   - Sliding Log (Optional)

2. **RPS Input**: Numeric input field
   - Range: 1 - 1000
   - Default: 10
   - Label: "Requests Per Second"

3. **Apply Button**: Submits POST `/settings`
   - Shows success/error feedback
   - Updates current configuration display

### Burst Generator

**Components:**
1. **Request Count Input**: Number of requests to fire
   - Range: 1 - 100
   - Default: 10
   - Label: "Number of Requests"

2. **Delay Input** (Optional): Milliseconds between requests
   - Range: 0 - 1000
   - Default: 0 (simultaneous)
   - Label: "Delay Between Requests (ms)"

3. **Fire Burst Button**: Triggers batch requests
   - Fires N × GET `/test` calls
   - If delay = 0: `Promise.all()` (parallel)
   - If delay > 0: Sequential with setTimeout

### Results Display

**Components:**
1. **Request Log**: Scrolling list of recent requests
   - Format: `[HH:MM:SS.mmm] Request #N: ✓ Allowed (remaining: X) / ✗ Rejected (retry in Xms)`
   - Color coding: Green for allowed, red for rejected
   - Auto-scroll to latest
   - Max 100 visible entries

2. **Summary Statistics**:
   - Total requests sent
   - Allowed count and percentage
   - Rejected count and percentage
   - Current algorithm and RPS display

3. **Visual Indicator**: Progress bar or chart
   - Green segment: % allowed
   - Red segment: % rejected
   - Updates in real-time

## Algorithm Arena (Racing Mode)

### Overview

A high-performance visual racing environment where Token Bucket (Fox) and Leaky Bucket (Hedgehog) compete head-to-head under identical traffic conditions. This mode emphasizes comparative analysis through real-time visualization and parallel execution.

### Technical Architecture

#### Simplified Two-Layer Architecture

**1. Web Workers (Computation Layer)**
- Two dedicated workers (one per algorithm) for parallel processing
- Main thread stays free for smooth 60fps animations
- Simple `postMessage` API for communication

```typescript
// algorithm-worker.ts (instantiated twice)
class AlgorithmWorker {
  private limiter: RateLimiter;

  onmessage = (e: MessageEvent) => {
    const { type, requests } = e.data;

    if (type === 'PROCESS_BATCH') {
      const results = requests.map(r => ({
        allowed: this.limiter.allow(),
        timestamp: r.timestamp,
        remaining: this.limiter.getStats().remaining
      }));

      postMessage({ type: 'RESULTS', results });
    }
  };
}
```

**2. Main Thread (Rendering + Coordination)**
- Native Canvas API for visualization at 60fps
- CSS animations for smooth transitions
- WebSocket connection to backend for real-time state
- Coordinates workers and renders comparative metrics

### Racing-Specific API Endpoints

#### WebSocket Endpoint for Real-Time Racing

```typescript
// /ws/race - WebSocket connection for live updates
// Protocol: JSON (simple and readable)
interface RaceFrame {
  timestamp: number;
  foxState: {
    tokens: number;
    accepted: number;
    rejected: number;
  };
  hedgehogState: {
    queueSize: number;
    accepted: number;
    rejected: number;
  };
  event?: 'burst' | 'spike' | 'recovery';
}

// Message flow: 30 updates per second
ws.send(JSON.stringify(frame));
```

#### RESTful Endpoints

```typescript
// Start a new race session (establishes WebSocket connection)
POST /api/race/start
Request: {
  rps: number;
  duration: number;  // seconds
  pattern: 'burst' | 'sustained' | 'chaos';
}
Response: {
  sessionId: string,
  wsUrl: string
}

// Stop an active race
POST /api/race/stop
Request: { sessionId: string }
Response: {
  winner: 'fox' | 'hedgehog' | 'tie',
  metrics: {
    fox: { accepted: number, rejected: number },
    hedgehog: { accepted: number, rejected: number }
  }
}
```

### Visual Design

**Racing Interface Layout:**

```
┌────────────────────────────────────────┐
│  [← Back] Algorithm Arena  [Share] [?]  │
├─────────────┬──────────────────────────┤
│   Fox 🦊    │    Hedgehog 🦔           │
│ Token Bucket│   Leaky Bucket           │
│             │                           │
│  ┌────────┐ │    ┌────────┐            │
│  │≈≈≈≈≈≈≈≈│ │    │████    │            │
│  │≈≈≈≈≈≈≈≈│ │    │████    │            │
│  │  20/20  │ │    │  8/15  │            │
│  └────────┘ │    └────────┘            │
│   Tokens    │     Queue                 │
│             │                           │
│ ● ● ● ● ●   │   ● ● ● ○ ○              │
│ [Particles] │   [Particles]             │
│             │                           │
│ Accepted: 45│   Accepted: 42           │
│ Rejected: 5 │   Rejected: 8            │
│ Rate: 10/s  │   Rate: 9.8/s            │
├─────────────┴──────────────────────────┤
│         Comparative Metrics             │
│ [Throughput] [Latency] [Fairness]       │
│  📊 Real-time charts update here        │
├─────────────────────────────────────────┤
│ Pattern: [Burst] [DDoS] [Gradual] [→]   │
│ Duration: [===========|---] 30s/60s     │
└─────────────────────────────────────────┘
```

**Visual Elements:**
- **Token Visualization**: Animated water level for token bucket (Canvas API)
- **Queue Visualization**: Stack representation for leaky bucket (Canvas API)
- **Request Particles**: Flowing particles show accept/reject in real-time
- **Metrics Graphs**: Native Canvas/SVG charts with CSS animations
- **Real-time Stats**: Live acceptance/rejection counts and rates

### Performance Optimizations

#### Simple Worker Management

```typescript
class RaceWorkerManager {
  private foxWorker: Worker;
  private hedgehogWorker: Worker;

  constructor() {
    this.foxWorker = new Worker('./algorithm-worker.js');
    this.hedgehogWorker = new Worker('./algorithm-worker.js');

    // Initialize each with their respective algorithms
    this.foxWorker.postMessage({ type: 'INIT', algorithm: 'token-bucket' });
    this.hedgehogWorker.postMessage({ type: 'INIT', algorithm: 'leaky-bucket' });
  }

  async processInParallel(requests: Request[]): Promise<Results> {
    const foxPromise = this.sendToWorker(this.foxWorker, requests);
    const hedgehogPromise = this.sendToWorker(this.hedgehogWorker, requests);

    return Promise.all([foxPromise, hedgehogPromise]);
  }

  private sendToWorker(worker: Worker, requests: Request[]): Promise<Result> {
    return new Promise((resolve) => {
      worker.onmessage = (e) => resolve(e.data);
      worker.postMessage({ type: 'PROCESS_BATCH', requests });
    });
  }
}
```

#### Frame Rate Optimization

```typescript
class RaceRenderer {
  private lastFrame = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  render(timestamp: number) {
    const delta = timestamp - this.lastFrame;

    // Target 60fps (16.67ms per frame)
    if (delta >= 16.67) {
      this.clearCanvas();
      this.renderTokenBucket();
      this.renderLeakyBucket();
      this.renderParticles(delta);
      this.updateMetrics();

      this.lastFrame = timestamp;
    }

    requestAnimationFrame((t) => this.render(t));
  }

  private clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
```

#### Memory Management

```typescript
// Object pooling for particles
class ParticlePool {
  private pool: Particle[] = [];
  private active: Set<Particle> = new Set();

  constructor(size: number = 1000) {
    for (let i = 0; i < size; i++) {
      this.pool.push(new Particle());
    }
  }

  acquire(): Particle | null {
    const particle = this.pool.pop();
    if (particle) {
      this.active.add(particle);
      return particle;
    }
    return null; // Pool exhausted
  }

  release(particle: Particle) {
    particle.reset();
    this.active.delete(particle);
    this.pool.push(particle);
  }
}
```

### Configuration Constants

```typescript
// Racing mode specific constants
const RACE_CONFIG = {
  // Performance
  UPDATE_INTERVAL_MS: 33,          // 30fps target (reduced for simplicity)
  PARTICLE_POOL_SIZE: 500,         // Reusable particles

  // Limits
  MAX_RACE_DURATION_MS: 60000,     // 1 minute max
  MAX_REQUESTS_PER_SECOND: 1000,   // Prevent abuse

  // WebSocket
  WS_RECONNECT_DELAY_MS: 1000,     // Initial reconnect delay
  WS_PING_INTERVAL_MS: 30000,      // Keep-alive
};
```

### Browser Compatibility

```typescript
// Simple feature detection
class RaceInitializer {
  async initialize() {
    const features = {
      workers: typeof Worker !== 'undefined',
      canvas: !!document.createElement('canvas').getContext('2d'),
      websocket: 'WebSocket' in window
    };

    if (!features.workers || !features.canvas || !features.websocket) {
      throw new Error('Browser not supported. Please use a modern browser.');
    }

    return new RaceEngine();
  }
}
```

## Development Setup

### Prerequisites
- Bun (install from https://bun.sh)

### Installation

```bash
# Install all dependencies for the entire project
bun install:all

# Or install individually:
cd backend && bun install
cd ../frontend && bun install
```

### Running the Application

**Full Platform (Recommended):**

From the project root:
```bash
bun run dev:all      # Starts backend + frontend SPA
```

This launches:
- Frontend SPA on `http://localhost:5173` (all routes)
- Backend API on `http://localhost:9000`

**Individual Components:**

Run specific parts of the application:

```bash
# Individual services
bun run dev:backend   # API server only (port 9000)
bun run dev:frontend  # Frontend SPA only (port 5173)
```

**Production Build:**

```bash
bun run build:all     # Build all components
bun run preview:all   # Preview production builds
```

Access the application at `http://localhost:5173`. The landing page (`/`) allows you to choose your experience, or navigate directly to `/explorer` or `/arena`.

### Development vs Production Architecture

**Development Mode:**
- Frontend dev server: `http://localhost:5173` (with hot reload)
- Backend API server: `http://localhost:9000`
- **Architecture**: Frontend dev server proxies all API requests (`/test`, `/settings`, `/health`, `/reset`, `/api/*`) to backend
- **No CORS needed**: Browser only communicates with localhost:5173, which forwards requests to backend

**Production Mode:**
- Single server: `http://localhost:9000`
- **Architecture**: Backend serves both API endpoints and pre-built frontend static files
- **No CORS needed**: Everything is same-origin

This hybrid approach provides the best developer experience (hot reload) while maintaining a production-ready single-server deployment model.

### Testing Algorithm Behavior

Use the front end to toggle algorithms and rates, then observe responses from the test endpoint to compare strategies side by side.

**Recommended Test Scenarios:**
1. **Burst vs Smooth**: Fire 50 requests instantly and compare Token Bucket vs. Leaky Bucket behavior
2. **Sustained Load**: Continuous requests at 1.5× configured RPS to observe rejection patterns
3. **Burst Recovery**: Fire 50 requests instantly, wait 2 seconds, fire 50 more (Token vs. Leaky)
4. **Optional Precision Test**: Sliding Log vs. Sliding Window under exact RPS load (if implemented)

### Algorithm Validation & Testing

#### Test Execution Requirements

The algorithm validation suite SHALL be executable from the project root:

```bash
bun run backend/test-algorithms.ts
```

**Required Test Coverage:**
The test suite MUST validate:
- Burst capacity validation (Token Bucket: 20 tokens, Leaky Bucket: 15 queue slots @ 10 RPS)
- Reset functionality (state clears correctly)
- Time-based refill/drain behavior
- Sustained rate enforcement over time
- Recovery after exhaustion

#### Validation Test Scenarios

The following scenarios SHALL be used to validate that each algorithm behaves according to its design specification:

##### Test 1: Burst Capacity (Instant Load)

**Configuration:** 10 RPS
**Action:** Fire 25 requests instantly (0ms delay)

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Token Bucket | MUST allow 20/25 requests, MUST reject 5/25 requests | Burst capacity = rps × 2.0 = 20 tokens |
| Leaky Bucket | MUST allow 20/25 requests, MUST reject 5/25 requests | Queue size = rps × 2.0 = 20 slots |

**Why different:** Token Bucket starts with full capacity; Leaky Bucket has smaller queue buffer.

##### Test 2: Rate Enforcement (Sustained Load)

**Configuration:** 10 RPS
**Action:** Fire 100 requests with 100ms delay between each (simulates 10 RPS load)

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Token Bucket | MUST allow ~100/100 requests | Long-term rate adherence after initial burst |
| Leaky Bucket | MUST allow ~100/100 requests | Steady-state processing at configured rate |

**Why same:** Both enforce the configured rate over sustained periods.

##### Test 3: Recovery After Exhaustion

**Configuration:** 10 RPS
**Action:** Fire 25 requests instantly → Wait 1 second → Fire 15 requests

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Token Bucket | Burst 1: MUST allow 20/25<br>Wait 1s: MUST refill 10 tokens<br>Burst 2: MUST allow 10/15 | Refill rate = 10 tokens/second |
| Leaky Bucket | Burst 1: MUST allow 15/25<br>Wait 1s: MUST drain ~10 items<br>Burst 2: MUST allow 10/15 | Drain rate = 10 items/second |

**Why different:** Token Bucket refills tokens; Leaky Bucket drains queue to create space.

##### Test 4: Full Recovery After Idle Period

**Configuration:** 10 RPS
**Action:** Fire 25 requests instantly → Wait 2 seconds → Fire 25 requests

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Token Bucket | Burst 1: MUST allow 20/25<br>Wait 2s: MUST fully refill to 20<br>Burst 2: MUST allow 20/25 | Complete capacity restoration |
| Leaky Bucket | Burst 1: MUST allow 15/25<br>Wait 2s: Queue MUST be fully drained<br>Burst 2: MUST allow 15/25 | Complete queue clearance |

**Why same pattern:** Both algorithms fully recover after sufficient idle time.

##### Test 5: Low Rate Configuration

**Configuration:** 1 RPS
**Action:** Fire 5 requests instantly

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Token Bucket | MUST allow 2/5 requests | Capacity = 1 × 2.0 = 2 tokens |
| Leaky Bucket | MUST allow 2/5 requests | Queue = 1 × 2.0 = 2 slots |

**Why different:** Multipliers scale correctly even at low rates.

##### Test 6: High Rate Configuration

**Configuration:** 100 RPS
**Action:** Fire 500 requests instantly

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Token Bucket | MUST allow 200/500 requests | Capacity = 100 × 2.0 = 200 tokens |
| Leaky Bucket | MUST allow 200/500 requests | Queue = 100 × 2.0 = 200 slots |

**Why different:** Burst tolerance scales proportionally with configured rate.

##### Test 7: Sliding Window Weighted Sum (Optional)

**Configuration:** 10 RPS with 10 segments (100ms each)
**Action:**
1. Fire 5 requests instantly
2. Wait 300ms (3 segments)
3. Fire 5 more requests
4. Verify weighted sum calculation

| Algorithm | Required Behavior | Validates |
|-----------|-------------------|-----------|
| Sliding Window | First burst: 5 requests in segment 0<br>After 300ms: Segment 0 has weight = 0.7<br>Weighted count = 5 × 0.7 = 3.5<br>Second burst should allow 5 requests (total weighted < 10) | Correct segment weighting implementation |

**Purpose:** Verifies that segments are weighted correctly based on age, with current segment at full weight.

#### Expected Behavioral Differences

| Characteristic | Token Bucket | Leaky Bucket |
|----------------|--------------|--------------|
| **Initial State** | Full (20 tokens @ 10 RPS) | Empty (0 items in queue) |
| **Burst Handling** | Allows immediate burst up to capacity | Caps burst at queue size |
| **Recovery Mechanism** | Adds tokens over time | Drains queue over time |
| **Burst Tolerance** | High (2.0× multiplier) | Medium (1.5× multiplier) |
| **Best For** | APIs tolerating controlled bursts | Systems requiring smooth output rates |
| **Interval Granularity** | 100ms refill intervals | 50ms drain intervals |

#### Implementation Notes

**Timing Precision:**
- Token Bucket refills in 100ms intervals (configurable via `TOKEN_BUCKET_REFILL_INTERVAL_MS`)
- Leaky Bucket drains in 50ms intervals (configurable via `LEAKY_BUCKET_DRAIN_INTERVAL_MS`)
- **CRITICAL**: Both MUST align timestamps to interval boundaries to prevent drift:
  ```typescript
  // CORRECT - Prevents timing drift
  this.lastRefill = this.lastRefill + (intervalsElapsed * INTERVAL_MS);

  // INCORRECT - Accumulates timing errors
  this.lastRefill = now;
  ```
- This alignment ensures consistent behavior under sustained load

**State Management:**
- Token Bucket tracks: `tokens`, `lastRefill` timestamp
- Leaky Bucket tracks: `queueCount`, `lastDrain` timestamp
- Both implement lazy evaluation (calculate on each `allow()` call)

## Common Implementation Pitfalls

This section documents common mistakes to avoid when implementing the rate limiting algorithms:

### Token Bucket & Leaky Bucket
- **Timing Drift**: Using `now` instead of interval-aligned timestamps causes accumulating timing errors
  - ❌ Wrong: `this.lastRefill = Date.now()`
  - ✅ Correct: `this.lastRefill = this.lastRefill + (intervals * INTERVAL_MS)`

### Sliding Window
- **Current Segment Weighting**: The current segment should be counted at full weight (1.0), not partially weighted
  - ❌ Wrong: Weight current segment by elapsed time
  - ✅ Correct: Current segment weight = 1.0 (it represents "now")

### Sliding Log
- **Memory Bound Check Order**: Check MUST occur before adding new entries
  - ❌ Wrong: Add first, then check and remove if over limit
  - ✅ Correct: Check if at limit, reject if would exceed

### Fixed Window
- **Boundary Burst**: This is expected behavior (not a bug) - document it clearly
  - Can allow 2× rate at window boundaries
  - Example: 10 RPS can burst to 20 requests in 2ms at boundary

### General
- **Integer vs Float RPS**: Decide how to handle fractional RPS values
- **Concurrent Access**: For teaching demos, global state is acceptable
- **Performance vs Correctness**: For demos, prioritize algorithmic correctness over optimization

## Deployment Notes

### Purpose
This is a demonstration application designed to visually illustrate rate limiting algorithms.
The frontend intentionally does not handle network failures to maintain focus on rate limiting behavior.

### Build Process
- Frontend: Bundle with `bun build` for production
- Backend: Run directly with Bun (transpiles TypeScript natively)
- Output directories: `frontend/dist`, `backend/dist`

## Dependencies

### Core Runtime & Tooling
- `bun` - All-in-one JavaScript runtime (HTTP server, WebSocket, bundler, SQLite, compression)
- `typescript` - Type-safe development
- `@types/bun` - Bun runtime type definitions

### Development Workflow
- `concurrently` - Process lifecycle management (cleanup on kill)
- `eslint` - Code quality and consistency
- `prettier` - Code formatting

### Native APIs Used (Zero Dependencies)

#### Backend
- `Bun.serve` - HTTP server with native routing and WebSocket support
- `bun:sqlite` - Native SQLite database (no external package)
- `Bun.deflateSync` - Native compression for data storage

#### Frontend Build
- `bun build` - Native bundler with watch mode and minification
- No Vite, no Webpack - pure Bun bundling

#### Frontend Runtime
- **Routing**: Vanilla TypeScript History API (client-side routing)
- **Workers**: Native Web Workers with `postMessage` API
- **Visualization**: Native Canvas API and SVG for charts/animations
- **Animations**: CSS animations and Web Animations API
- **Serialization**: JSON (simplicity over binary optimization)
- **State Management**: Standard browser APIs

### Design Philosophy
This demo prioritizes **native APIs over frameworks** to minimize dependencies and maximize educational clarity. Every dependency removed is one less abstraction between the learner and the underlying concepts.

## Conformance Requirements

A compliant implementation MUST:
1. Implement both Token Bucket and Leaky Bucket algorithms
2. Support all specified API endpoints with exact response formats
3. Pass all validation test scenarios defined in this specification
4. Maintain rate limiter state consistency across requests
5. Provide accurate rate limit headers in all responses
6. Implement the RateLimiter interface as specified
7. Support configuration via environment variables as documented
8. Respect the algorithm configuration constants and their multipliers
