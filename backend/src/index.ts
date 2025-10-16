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