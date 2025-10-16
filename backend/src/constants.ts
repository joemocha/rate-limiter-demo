// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;      // Burst capacity = rps × 2.0
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;    // Refill every 100ms

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;      // Queue depth = rps × 1.5
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;      // Drain every 50ms

// Server Configuration
export const DEFAULT_BACKEND_PORT = 9000;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';
