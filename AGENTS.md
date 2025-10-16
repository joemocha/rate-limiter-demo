# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Fox vs. Hedgehog Rate Limiting Demo** - Demonstrates contrasting problem-solving approaches through rate limiting algorithm comparison.

- **Backend**: API exposing configuration and testing endpoints for multiple rate-limiting algorithms
- **Frontend**: Single-page client to switch strategies and fire test requests
- **Purpose**: Compare broad experimentation (fox) vs focused mastery (hedgehog) in rate limiting design

## Development Commands

```bash
# Terminal 1 — Backend
cd backend
bun install
bun run dev          # Hono server on port 9000

# Terminal 2 — Frontend
cd frontend
python -m http.server 5173
# Access: http://localhost:5173
```

## Architecture

### API Endpoints
- **POST `/settings`**: Configure active rate-limiting algorithm and request rate (requests/second)
- **GET `/test`**: Evaluate current configuration under load

### Supported Rate-Limiting Algorithms
1. **Token Bucket**: Allows burst traffic up to bucket capacity
2. **Leaky Bucket**: Smooths traffic at constant rate
3. **Fixed Window**: Fixed time window counter
4. **Sliding Window**: Weighted combination of current/previous windows
5. **Sliding Log**: Precise timestamp-based tracking

### Frontend
- Algorithm selector UI
- Rate configuration controls
- Request generator for load testing
- Response visualization for algorithm comparison

## Key Design Decisions

- Bun runtime for performance
- Multiple algorithm implementations for side-by-side comparison
- Real-time configuration switching without server restart
- Frontend-driven load testing to observe algorithm behavior under bursty traffic
- Demo focused on educational comparison of rate-limiting strategies
