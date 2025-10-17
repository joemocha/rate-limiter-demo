// API request/response types
export interface SettingsRequest {
  algorithm: 'token-bucket' | 'leaky-bucket';
  rps: number;
}

export interface SettingsResponse {
  success: boolean;
  algorithm: string;
  rps: number;
}

export interface TestResponse {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  retryAfter?: number;
}

export interface HealthResponse {
  status: string;
  algorithm: string;
  rps: number;
  timestamp: number;
  stats: {
    remaining: number;
    resetAt: number;
  };
}

// Navigation types
export type RouteHandler = () => void;

export interface NavigationState {
  lastVisited: 'explorer' | 'arena' | null;
  visitCount: number;
  preferences: {
    algorithm: 'token-bucket' | 'leaky-bucket';
    rps: number;
  };
}

// Configuration types
export interface SharedConfig {
  rps: number;
  primaryAlgorithm: 'token-bucket' | 'leaky-bucket';
  secondaryAlgorithm: 'token-bucket' | 'leaky-bucket';
}

export type ConfigListener = (config: SharedConfig) => void;
