import type { ServerWebSocket } from 'bun';
import type { RateLimiter } from './src/types/rate-limiter.interface';
import { LimiterFactory, type AlgorithmType } from './src/limiter-factory';
import { handleWebSocket, handleWebSocketMessage, handleWebSocketClose, getActiveSessionCount } from './src/websocket';

// Global state
let currentLimiter: RateLimiter = LimiterFactory.create('token-bucket', 10);
let currentAlgorithm: AlgorithmType = 'token-bucket';
let currentRPS = 10;

const PORT = Number(process.env.BACKEND_PORT) || 9000;
const DIST_DIR = new URL('../frontend/dist/', import.meta.url).pathname;

// API Handlers
function handleSettings(req: Request): Promise<Response> {
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

function handleWebSocketHealth(): Response {
  const activeSessions = getActiveSessionCount();
  const uptime = process.uptime();

  return Response.json({
    status: 'ok',
    websocket: {
      available: true,
      endpoint: '/ws/race',
      activeSessions,
    },
    server: {
      uptime: Math.floor(uptime),
      timestamp: Date.now(),
    },
  });
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

    if (url.pathname === '/ws/health' && req.method === 'GET') {
      return handleWebSocketHealth();
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
