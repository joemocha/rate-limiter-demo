# Fox vs. Hedgehog Rate Limiting Demo

This repository hosts the demo application used to illustrate the contrasting problem-solving approaches of the fox and the hedgehog. The project centers on a rate limiting scenario that highlights how each mindset explores or commits to a strategy when taming bursty traffic.

## Application Overview

- **Architecture**
  - **Front end**: A single-page client that lets you switch rate-limiting strategies and fire test requests.
  - **Back end**: A simple API that exposes configuration and testing endpoints to observe behavior under different algorithms and rates.
- **Purpose**: Demonstrate how broad experimentation (fox) and focused mastery (hedgehog) influence the design and tuning of rate limiting solutions.

## Technology Stack

- **Runtime**: Bun (TypeScript/JavaScript runtime and bundler)
- **Backend Framework**: Hono (lightweight web framework)
- **Backend Port**: 9000
- **Frontend**: TypeScript + Vite (HTML/CSS/TS)
- **State Management**: In-memory global counter
- **Rate Limiting Scope**: Global (shared across all clients)

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Hono server entry point
│   │   ├── constants.ts             # Algorithm tuning parameters
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
├── frontend/
│   ├── index.html                   # Single-page application
│   ├── app.ts                       # Client-side logic
│   └── styles.css                   # UI styling
│
└── README.md
```

## API Endpoints

### POST `/settings`

Configure the active rate-limiting algorithm and the allowed request rate in requests per second.

**Request Body:**
```json
{
  "algorithm": "token-bucket",  // One of (implemented): "token-bucket", "leaky-bucket". Optional if added: "fixed-window", "sliding-window", "sliding-log"
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

## Rate Limiting Algorithms

All algorithms implement a common interface with the following contract:

```ts
class RateLimiter {
  constructor(rps: number) {}            // Initialize with requests per second
  allow(): boolean                        // Returns boolean (true = allow, false = reject)
  reset(): void                           // Clear internal state
  getStats(): { remaining: number; resetAt: number } // Returns { remaining, resetAt }
}
```

### 1. Token Bucket (Implemented)

**Mechanism:** Maintains a bucket with a maximum capacity of tokens. Tokens are added at a fixed rate (refill). Each request consumes one token. Allows bursts up to bucket capacity.

**Characteristics:**
- **Burst tolerance**: High (permits `capacity` requests instantly)
- **Boundary effects**: None
- **Memory**: O(1) - stores token count and last refill timestamp
- **CPU**: O(1) per request

**Use case:** Systems that tolerate controlled bursts but enforce long-term average rate.

### 2. Leaky Bucket (Implemented)

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

**Mechanism:** Divides time into small segments. Calculates weighted average of current + previous window to smooth boundary effects.

**Characteristics:**
- **Burst tolerance**: Low (distributed across window)
- **Boundary effects**: Low (weighted smoothing reduces edge bursts)
- **Memory**: O(segments) - stores counts per segment
- **CPU**: O(1) per request (weighted sum calculation)

**Use case:** Balance between accuracy and efficiency, reduced boundary bursts vs. fixed window.

### 5. Sliding Log (Optional)

**Mechanism:** Maintains a log of exact request timestamps. Counts requests within the sliding time window by filtering expired entries.

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
LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5      // Queue depth = rps × multiplier
LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50      // Request processing tick rate
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

## Frontend Specification

### Configuration Panel

**Components:**
1. **Algorithm Selector**: Dropdown with implemented options (2 required)
   - Token Bucket (Implemented)
   - Leaky Bucket (Implemented)
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

## Development Setup

### Prerequisites
- Bun (install from https://bun.sh)

### Installation

```bash
# Install backend dependencies
cd backend
bun install

# Install frontend dependencies (TypeScript + Vite)
cd ../frontend
bun install
```

### Running the Application

**Backend:**
```bash
cd backend
bun run dev          # Starts Hono server on port 9000 with hot reload
```

**Frontend:**
Start the Vite dev server:
```bash
cd frontend
bun run dev
```

Access the application at `http://localhost:5173` (or your chosen frontend port).

### CORS

During local development, the frontend runs at `http://localhost:5173`. Configure the backend to allow this origin.

- Allowed origin: `http://localhost:5173` (update if your frontend port differs)
- Allowed methods: `GET, POST, OPTIONS`
- Allowed headers: `Content-Type`
- Exposed headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- Cache: set `Cache-Control: no-store` on `GET /test`

### Testing Algorithm Behavior

Use the front end to toggle algorithms and rates, then observe responses from the test endpoint to compare strategies side by side.

**Recommended Test Scenarios:**
1. **Burst vs Smooth**: Fire 50 requests instantly and compare Token Bucket vs. Leaky Bucket behavior
2. **Sustained Load**: Continuous requests at 1.5× configured RPS to observe rejection patterns
3. **Burst Recovery**: Fire 50 requests instantly, wait 2 seconds, fire 50 more (Token vs. Leaky)
4. **Optional Precision Test**: Sliding Log vs. Sliding Window under exact RPS load (if implemented)
