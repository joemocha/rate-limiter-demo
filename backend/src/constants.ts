/**
 * Algorithm Configuration Constants
 *
 * These tunable parameters expose algorithmic trade-offs and control
 * the behavior of rate limiting implementations.
 */

// ============================================================================
// Token Bucket Configuration
// ============================================================================

/**
 * Burst capacity multiplier for Token Bucket algorithm.
 *
 * Determines how many tokens the bucket can hold relative to the configured RPS.
 * Formula: capacity = rps × TOKEN_BUCKET_BURST_MULTIPLIER
 *
 * Trade-off:
 * - Higher multiplier = More burst tolerance, allows larger instant request spikes
 * - Lower multiplier = Stricter rate adherence, less bursty behavior
 *
 * Example: At 10 RPS with multiplier 2.0, bucket holds 20 tokens
 */
export const TOKEN_BUCKET_BURST_MULTIPLIER = 2.0;

/**
 * Token refill interval in milliseconds.
 *
 * Controls how frequently tokens are added back to the bucket.
 * Smaller intervals = smoother refill, higher CPU usage
 * Larger intervals = chunkier refill, lower CPU usage
 *
 * Trade-off:
 * - Shorter interval = Smoother refill behavior, more precise rate control
 * - Longer interval = Chunkier refill, better performance
 */
export const TOKEN_BUCKET_REFILL_INTERVAL_MS = 100;

// ============================================================================
// Leaky Bucket Configuration
// ============================================================================

/**
 * Queue size multiplier for Leaky Bucket algorithm.
 *
 * Determines queue capacity relative to the configured RPS.
 * Formula: queueSize = rps × LEAKY_BUCKET_QUEUE_MULTIPLIER
 *
 * Trade-off:
 * - Larger multiplier = More buffering capacity, higher memory usage
 * - Smaller multiplier = Less buffering, stricter burst rejection
 *
 * Example: At 10 RPS with multiplier 1.5, queue holds 15 items
 */
export const LEAKY_BUCKET_QUEUE_MULTIPLIER = 1.5;

/**
 * Queue drain interval in milliseconds.
 *
 * Controls how frequently requests are processed from the queue.
 * Formula: drainRate = rps / (1000 / DRAIN_INTERVAL_MS)
 *
 * Trade-off:
 * - Shorter interval = Smoother output rate, higher CPU usage
 * - Longer interval = Chunkier output, better performance
 */
export const LEAKY_BUCKET_DRAIN_INTERVAL_MS = 100;
