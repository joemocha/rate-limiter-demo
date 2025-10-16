const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

interface SettingsRequest {
  algorithm: 'token-bucket' | 'leaky-bucket';
  rps: number;
}

interface TestResponse {
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

export const apiClient = {
  async settings(config: SettingsRequest) {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Settings update failed');
    return response.json();
  },

  async test(): Promise<TestResponse> {
    const response = await fetch(`${API_URL}/test`);
    const json = await response.json();
    return {
      allowed: response.status === 200,
      remaining: json.remaining,
      retryAfter: json.retryAfter
    };
  },

  async health() {
    const response = await fetch(`${API_URL}/health`);
    return response.json();
  },

  async reset() {
    await fetch(`${API_URL}/reset`, { method: 'POST' });
  }
};
