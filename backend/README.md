# Rate Limiting Demo - Backend

Production-ready backend implementation for the Rate Limiting Demo application.

## Implementation

### Architecture

```
backend/
├── src/
│   ├── index.ts                     # Hono server with API endpoints
│   ├── constants.ts                 # Algorithm tuning parameters
│   ├── limiter-factory.ts          # Factory for rate limiter instantiation
│   ├── rate-limiters/
│   │   ├── token-bucket.ts         # Token Bucket algorithm
│   │   └── leaky-bucket.ts         # Leaky Bucket algorithm
│   └── types/
│       └── rate-limiter.interface.ts # RateLimiter interface
├── test-algorithms.ts              # Comprehensive validation suite
└── package.json
```

### Algorithms Implemented

#### Token Bucket
- **Initial State**: FULL (capacity = rps × 2.0)
- **Refill Rate**: 10 tokens/second at 10 RPS
- **Burst Tolerance**: High (allows instant bursts up to capacity)
- **Use Case**: Systems that tolerate controlled bursts

#### Leaky Bucket
- **Initial State**: EMPTY (queue size = rps × 1.5)
- **Drain Rate**: 10 items/second at 10 RPS
- **Burst Tolerance**: Medium (smooths bursts via queue)
- **Use Case**: Systems requiring smooth, predictable output

## Usage

### Installation

```bash
cd backend
bun install
```

### Running the Server

```bash
# Development mode with hot reload
bun run dev

# Production mode
bun run start
```

Server starts on port 9000 (configurable via `BACKEND_PORT` env var).

### Testing

Run the comprehensive algorithm validation suite:

```bash
bun run test
```

Expected output: All 26 tests pass, validating:
- Burst capacity (Token Bucket: 20/25, Leaky Bucket: 15/25 at 10 RPS)
- Rate enforcement over sustained load
- Recovery after exhaustion
- Full recovery after idle periods
- Low rate (1 RPS) and high rate (100 RPS) configurations
- Reset functionality
- Stats accuracy

## API Endpoints

### POST /settings

Configure the rate limiting algorithm and RPS.

```bash
curl -X POST http://localhost:9000/settings \
  -H "Content-Type: application/json" \
  -d '{"algorithm":"token-bucket","rps":10}'
```

Response:
```json
{
  "success": true,
  "algorithm": "token-bucket",
  "rps": 10
}
```

### GET /test

Rate-limited endpoint for testing.

```bash
curl -i http://localhost:9000/test
```

Response (200 - Allowed):
```json
{
  "allowed": true,
  "remaining": 19,
  "resetAt": 1697123456789
}
```

Response (429 - Rate Limited):
```json
{
  "allowed": false,
  "retryAfter": 250
}
```

Headers:
- `X-RateLimit-Limit`: Maximum RPS configured
- `X-RateLimit-Remaining`: Available capacity
- `X-RateLimit-Reset`: Unix timestamp of reset
- `Retry-After`: Seconds until retry (429 only)
- `Cache-Control: no-store`

### GET /health

Health check with current configuration.

```bash
curl http://localhost:9000/health
```

Response:
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

### POST /reset

Manually reset the rate limiter to initial state.

```bash
curl -X POST http://localhost:9000/reset
```

Response: 204 No Content

## Configuration

### Environment Variables

- `BACKEND_PORT`: Server port (default: 9000)
- `CORS_ORIGIN`: Allowed frontend origin (default: http://localhost:5173)

### Algorithm Constants

Defined in `src/constants.ts`:

```typescript
// Token Bucket
TOKEN_BUCKET_BURST_MULTIPLIER = 2.0       // Capacity = rps × 2.0
TOKEN_BUCKET_REFILL_INTERVAL_MS = 100     // 100ms refill granularity

// Leaky Bucket
LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5       // Queue size = rps × 1.5
LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50       // 50ms drain granularity
```

## Validation Results

The implementation passes all specification requirements:

| Test | Token Bucket | Leaky Bucket |
|------|-------------|--------------|
| Burst capacity (25 @ 10 RPS) | 20 allowed, 5 rejected | 15 allowed, 10 rejected |
| Sustained load (100 @ 100ms) | ~100 allowed | ~100 allowed |
| Recovery after 1s | 10 tokens refilled | 10 items drained |
| Full recovery after 2s | Full capacity restored | Queue fully cleared |
| Low rate (1 RPS) | 2 tokens (1 × 2.0) | 1 slot (1 × 1.5) |
| High rate (100 RPS) | 200 tokens (100 × 2.0) | 150 slots (100 × 1.5) |

## CORS Configuration

- **Allowed Origin**: http://localhost:5173 (frontend dev server)
- **Allowed Methods**: GET, POST, OPTIONS
- **Exposed Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After

## Implementation Notes

### Lazy Evaluation

Both algorithms use lazy evaluation for efficiency:
- **Token Bucket**: Calculates tokens on each `allow()` call based on elapsed time
- **Leaky Bucket**: Drains queue on each `allow()` call based on elapsed time

No background timers or intervals required.

### Interval-Based Calculations

Both use interval-based calculations to prevent drift:
- Token Bucket: `Math.floor(elapsed / 100ms) * tokensPerInterval`
- Leaky Bucket: `Math.floor(elapsed / 50ms) * itemsPerInterval`

### Global State

Rate limiting is global (shared across all clients), not per-client.

### Error Handling

- Invalid algorithm name: Returns 400 with error message
- Invalid RPS (≤ 0): Returns 400 with error message
- Malformed JSON: Returns 400 with error message

## Technology

- **Runtime**: Bun
- **Framework**: Hono (lightweight, fast web framework)
- **Language**: TypeScript with strict type checking
