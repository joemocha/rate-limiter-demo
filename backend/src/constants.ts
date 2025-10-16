/**
 * Algorithm Configuration Constants
 * These define the trade-offs between burst tolerance, accuracy, and resource usage
 */

// Token Bucket
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;

// Leaky Bucket
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 50;

// Fixed Window (Optional)
export const FIXED_WINDOW_SIZE_MS = 1000;

// Sliding Window (Optional)
export const SLIDING_WINDOW_SIZE_MS = 1000;
export const SLIDING_WINDOW_SEGMENTS = 10;

// Sliding Log (Optional)
export const SLIDING_LOG_WINDOW_MS = 1000;
export const SLIDING_LOG_MAX_ENTRIES = 10000;
