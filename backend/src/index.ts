import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RateLimiter } from "./types/rate-limiter.interface";
import { createRateLimiter, isValidAlgorithm, type AlgorithmType } from "./limiter-factory";

const app = new Hono();

// Environment configuration
const BACKEND_PORT = Number(process.env.BACKEND_PORT || "9000");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

// Global state
let currentAlgorithm: AlgorithmType = "token-bucket";
let currentRps: number = 10;
let rateLimiter: RateLimiter = createRateLimiter(currentAlgorithm, currentRps);

// CORS middleware
app.use("/*", cors({
  origin: CORS_ORIGIN,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
}));

// Helper to add rate limit headers
function addRateLimitHeaders(c: any, stats: { remaining: number; resetAt: number }) {
  c.header("X-RateLimit-Limit", currentRps.toString());
  c.header("X-RateLimit-Remaining", stats.remaining.toString());
  c.header("X-RateLimit-Reset", stats.resetAt.toString());
}

// POST /settings - Configure rate limiting algorithm and RPS
app.post("/settings", async (c) => {
  try {
    const body = await c.req.json();
    const { algorithm, rps } = body;

    // Validation
    if (!algorithm || !isValidAlgorithm(algorithm)) {
      return c.json({ error: "Invalid algorithm or RPS value" }, 400);
    }

    if (typeof rps !== "number" || rps <= 0) {
      return c.json({ error: "Invalid algorithm or RPS value" }, 400);
    }

    // Update configuration
    currentAlgorithm = algorithm;
    currentRps = rps;
    rateLimiter = createRateLimiter(currentAlgorithm, currentRps);

    return c.json({
      success: true,
      algorithm: currentAlgorithm,
      rps: currentRps,
    });
  } catch (error) {
    return c.json({ error: "Invalid algorithm or RPS value" }, 400);
  }
});

// GET /test - Rate-limited endpoint
app.get("/test", (c) => {
  // Set Cache-Control header
  c.header("Cache-Control", "no-store");

  const allowed = rateLimiter.allow();
  const stats = rateLimiter.getStats();

  if (allowed) {
    addRateLimitHeaders(c, stats);
    return c.json({
      allowed: true,
      remaining: stats.remaining,
      resetAt: stats.resetAt,
    });
  } else {
    // Calculate retry after in milliseconds
    const now = Date.now();
    const retryAfterMs = Math.max(0, stats.resetAt - now);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    addRateLimitHeaders(c, stats);
    c.header("Retry-After", retryAfterSec.toString());

    return c.json({
      allowed: false,
      retryAfter: retryAfterMs,
    }, 429);
  }
});

// GET /health - Health check with current configuration
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

// POST /reset - Manually reset rate limiter
app.post("/reset", (c) => {
  rateLimiter.reset();
  return c.body(null, 204);
});

export default {
  port: BACKEND_PORT,
  fetch: app.fetch,
};
