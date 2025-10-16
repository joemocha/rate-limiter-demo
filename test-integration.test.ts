import { test, describe, expect } from "bun:test";

const API_URL = "http://localhost:9000";

describe("End-to-End Integration", () => {
  test("Health check returns correct status", async () => {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(["token-bucket", "leaky-bucket"]).toContain(data.algorithm);
  });

  test("Settings endpoint updates configuration", async () => {
    const response = await fetch(`${API_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        algorithm: "token-bucket",
        rps: 5
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.rps).toBe(5);
  });

  test("Test endpoint enforces rate limits", async () => {
    // Set low rate
    await fetch(`${API_URL}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ algorithm: "token-bucket", rps: 2 })
    });

    // Reset to start fresh
    await fetch(`${API_URL}/reset`, { method: "POST" });

    // Fire 10 requests
    const results = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${API_URL}/test`))
    );

    const allowed = results.filter(r => r.status === 200).length;
    const rejected = results.filter(r => r.status === 429).length;

    // Token bucket at 2 RPS should allow 4 (2 * 2.0 multiplier)
    expect(allowed).toBe(4);
    expect(rejected).toBe(6);
  });
});