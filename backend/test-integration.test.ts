import { describe, it, expect } from 'bun:test';

const API_URL = 'http://localhost:9000';

describe('Integration Tests - API Endpoints', () => {
  it('POST /settings updates configuration', async () => {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: 'leaky-bucket', rps: 20 })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.algorithm).toBe('leaky-bucket');
    expect(data.rps).toBe(20);
  });

  it('GET /test returns rate limit headers', async () => {
    const response = await fetch(`${API_URL}/test`);

    expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('GET /health returns server status', async () => {
    const response = await fetch(`${API_URL}/health`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.algorithm).toBeTruthy();
    expect(data.rps).toBeTruthy();
  });

  it('POST /reset clears limiter state', async () => {
    // Set up known state
    await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: 'token-bucket', rps: 10 })
    });

    // Make some requests to exhaust tokens
    for (let i = 0; i < 20; i++) {
      await fetch(`${API_URL}/test`);
    }

    // Reset
    const resetResponse = await fetch(`${API_URL}/reset`, { method: 'POST' });
    expect(resetResponse.status).toBe(204);

    // Verify state is reset
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    expect(health.stats.remaining).toBeGreaterThan(0);
  });
});
