// Simple Bun-based dev server with live reload
import { resolve, extname } from 'path';

const PORT = 5173;
const buildCache = new Map<string, any>();

// Build the bundle once and cache outputs
async function buildBundle() {
  const result = await Bun.build({
    entrypoints: ['./src/main.ts'],
    target: 'browser',
    publicPath: '/',
  });

  buildCache.clear();
  for (const output of result.outputs) {
    buildCache.set(output.path, output);
  }

  return result;
}

// Initial build
await buildBundle();

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Proxy API requests to backend (eliminates need for CORS)
    const API_ROUTES = ['/api', '/test', '/settings', '/health', '/reset', '/ws'];
    if (API_ROUTES.some(route => url.pathname.startsWith(route))) {
      return fetch(`http://localhost:9000${url.pathname}`, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
    }

    // Serve index.html for root
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await Bun.file('./index.html').text();
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Serve bundled JavaScript
    if (url.pathname === '/src/main.ts' || url.pathname === '/src/main.js') {
      // Rebuild on request for hot reload
      await buildBundle();

      for (const [path, output] of buildCache) {
        if (path.endsWith('.js')) {
          return new Response(output, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }
      }
    }

    // Serve bundled assets (SVG, images, etc.)
    const filename = url.pathname.slice(1); // Remove leading /
    for (const [path, output] of buildCache) {
      if (path.endsWith(filename) || path.includes(filename)) {
        const contentType = getContentType(path);
        return new Response(output, {
          headers: { 'Content-Type': contentType },
        });
      }
    }

    // Serve static files from src/ (CSS, etc.)
    try {
      const file = Bun.file(`./src${url.pathname}`);
      if (await file.exists()) {
        const contentType = getContentType(url.pathname);
        return new Response(file, {
          headers: { 'Content-Type': contentType },
        });
      }
    } catch (e) {
      // Try root directory
      try {
        const file = Bun.file(`.${url.pathname}`);
        if (await file.exists()) {
          const contentType = getContentType(url.pathname);
          return new Response(file, {
            headers: { 'Content-Type': contentType },
          });
        }
      } catch (e2) {
        // File doesn't exist
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

function getContentType(path: string): string {
  const ext = extname(path);
  const types: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.html': 'text/html',
    '.json': 'application/json',
  };
  return types[ext] || 'application/octet-stream';
}

console.log(`Frontend dev server running at http://localhost:${PORT}`);
