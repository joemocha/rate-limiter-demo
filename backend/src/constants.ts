// Token Bucket Configuration
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;

// Leaky Bucket Configuration
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;

// Fixed Window Configuration
export const FIXED_WINDOW_SIZE_MS = 1000; // 1-second windows

// Sliding Window Configuration
export const SLIDING_WINDOW_SIZE_MS = 1000; // Total window duration
export const SLIDING_WINDOW_SEGMENTS = 10;  // 10 segments of 100ms each

// Sliding Log Configuration
export const SLIDING_LOG_WINDOW_MS = 1000;    // Tracking window
export const SLIDING_LOG_MAX_ENTRIES = 10000; // Max log size to prevent memory issues