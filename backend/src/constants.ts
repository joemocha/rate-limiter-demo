// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;      // Burst capacity = rps × multiplier
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;    // Token addition frequency (granularity)

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;      // Queue depth = rps × multiplier
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;      // Request processing tick rate
