import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RateLimiter } from "./types/rate-limiter.interface.ts";
import { createLimiter, isValidAlgorithm } from "./limiter-factory.ts";

const app = new Hono();

// Global state
let currentAlgorithm = "token-bucket";
let currentRPS = 10;
let rateLimiter: RateLimiter = createLimiter(currentAlgorithm, currentRPS)!;

// CORS middleware
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    exposeHeaders: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "Retry-After",
    ],
  })
);

// Helper to add rate limit headers
function addRateLimitHeaders(
  headers: Headers,
  remaining: number,
  resetAt: number,
  limit: number
) {
  headers.set("X-RateLimit-Limit", limit.toString());
  headers.set("X-RateLimit-Remaining", remaining.toString());
  headers.set("X-RateLimit-Reset", resetAt.toString());
  headers.set("Cache-Control", "no-store");
}

// POST /settings - Configure rate limiter
app.post("/settings", async (c) => {
  try {
    const body = await c.req.json();
    const { algorithm, rps } = body;

    // Validate algorithm
    if (!algorithm || !isValidAlgorithm(algorithm)) {
      return c.json(
        { error: "Invalid algorithm or RPS value" },
        { status: 400 }
      );
    }

    // Validate RPS
    if (typeof rps !== "number" || rps <= 0) {
      return c.json(
        { error: "Invalid algorithm or RPS value" },
        { status: 400 }
      );
    }

    // Update configuration
    currentAlgorithm = algorithm.toLowerCase();
    currentRPS = rps;
    rateLimiter = createLimiter(currentAlgorithm, currentRPS)!;

    return c.json(
      {
        success: true,
        algorithm: currentAlgorithm,
        rps: currentRPS,
      },
      { status: 200 }
    );
  } catch (error) {
    return c.json(
      { error: "Invalid algorithm or RPS value" },
      { status: 400 }
    );
  }
});

// GET /test - Rate limit check
app.get("/test", (c) => {
  const stats = rateLimiter.getStats();
  const allowed = rateLimiter.allow();

  const headers = new Headers();
  addRateLimitHeaders(headers, stats.remaining, stats.resetAt, currentRPS);

  if (allowed) {
    // Request allowed
    return c.json(
      {
        allowed: true,
        remaining: stats.remaining,
        resetAt: stats.resetAt,
      },
      {
        status: 200,
        headers,
      }
    );
  } else {
    // Request rejected
    const now = Date.now();
    const waitTime = Math.max(0, stats.resetAt - now);
    const retryAfterSeconds = Math.ceil(waitTime / 1000);

    headers.set("Retry-After", retryAfterSeconds.toString());

    return c.json(
      {
        allowed: false,
        retryAfter: waitTime,
      },
      {
        status: 429,
        headers,
      }
    );
  }
});

// GET /health - Health check
app.get("/health", (c) => {
  const stats = rateLimiter.getStats();
  return c.json(
    {
      status: "ok",
      algorithm: currentAlgorithm,
      rps: currentRPS,
      timestamp: Date.now(),
      stats: {
        remaining: stats.remaining,
        resetAt: stats.resetAt,
      },
    },
    { status: 200 }
  );
});

// POST /reset - Reset rate limiter
app.post("/reset", (c) => {
  rateLimiter.reset();
  return c.text("", { status: 204 });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, { status: 404 });
});

// Start server
const port = parseInt(process.env.BACKEND_PORT || "9000", 10);
console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
