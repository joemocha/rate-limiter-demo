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
