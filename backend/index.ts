import { join } from "path";

const PORT = 9000;
const DIST_DIR = join(import.meta.dir, "..", "frontend", "dist");

// Placeholder API handlers (to be implemented with rate limiting algorithms)
function handleTest(req: Request) {
  return Response.json({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 1000
  });
}

function handleSettings(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  return Response.json({ success: true, algorithm: 'token-bucket', rps: 10 });
}

function handleHealth() {
  return Response.json({
    status: 'ok',
    algorithm: 'token-bucket',
    rps: 10,
    timestamp: Date.now(),
    stats: { remaining: 10, resetAt: Date.now() + 1000 }
  });
}

function handleReset(req: Request) {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  return new Response(null, { status: 204 });
}

export default {
  port: PORT,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // API routes
    if (url.pathname === '/test') return handleTest(req);
    if (url.pathname === '/settings') return handleSettings(req);
    if (url.pathname === '/health') return handleHealth();
    if (url.pathname === '/reset') return handleReset(req);

    // Serve static frontend files (production mode)
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = Bun.file(join(DIST_DIR, filePath));

    if (await file.exists()) {
      return new Response(file);
    }

    // SPA fallback: serve index.html for client-side routes (/explorer, /arena)
    const indexFile = Bun.file(join(DIST_DIR, 'index.html'));
    if (await indexFile.exists()) {
      return new Response(indexFile);
    }

    return new Response('Not Found', { status: 404 });
  },
};

console.log(`Backend server running at http://localhost:${PORT}`);
