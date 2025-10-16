// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;      // Burst capacity = rps × multiplier
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;    // Token addition frequency (granularity)

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;      // Queue depth = rps × multiplier
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;      // Request processing tick rate

// Fixed Window Configuration
export const FIXED_WINDOW_SIZE_MS = 1000;              // Window duration (reset period)

// Sliding Window Configuration
export const SLIDING_WINDOW_SIZE_MS = 1000;            // Total window duration
export const SLIDING_WINDOW_SEGMENTS = 10;             // Sub-window count (100ms each)

// Sliding Log Configuration
export const SLIDING_LOG_WINDOW_MS = 1000;             // Tracking window duration
export const SLIDING_LOG_MAX_ENTRIES = 10000;          // Maximum log size (prevents memory leak)
