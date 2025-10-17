import type { RateLimiter } from "../types/rate-limiter.interface";
import {
  LEAKY_BUCKET_QUEUE_MULTIPLIER,
  LEAKY_BUCKET_DRAIN_INTERVAL_MS,
} from "../constants";

/**
 * Leaky Bucket Rate Limiter
 *
 * Requests are added to a queue (bucket) and processed at a fixed rate
 * (leak rate). If queue is full, requests are rejected.
 *
 * Characteristics:
 * - Burst tolerance: Medium (smooths bursts via queue)
 * - Initial state: Empty (starts with 0 items in queue)
 * - Memory: O(1) - stores queue count and last drain timestamp
 * - CPU: O(1) per request + O(1) per drain tick
 *
 * Use case: Systems requiring smooth, predictable output rate regardless of input spikes.
 */
export class LeakyBucket implements RateLimiter {
  private readonly capacity: number;
  private readonly drainRate: number; // items per interval
  private queueSize: number;
  private lastDrain: number;

  /**
   * Creates a new Leaky Bucket rate limiter.
   *
   * @param rps - Requests per second to allow
   */
  constructor(private readonly rps: number) {
    // Calculate queue capacity based on multiplier
    this.capacity = Math.floor(rps * LEAKY_BUCKET_QUEUE_MULTIPLIER);

    // Calculate how many items to drain per interval
    // Example: 10 RPS with 100ms interval = 1 item per interval
    this.drainRate = (rps * LEAKY_BUCKET_DRAIN_INTERVAL_MS) / 1000;

    // Start with empty queue (low initial burst tolerance)
    this.queueSize = 0;

    // Initialize last drain to current time aligned to interval boundary
    const now = Date.now();
    this.lastDrain =
      Math.floor(now / LEAKY_BUCKET_DRAIN_INTERVAL_MS) *
      LEAKY_BUCKET_DRAIN_INTERVAL_MS;
  }

  /**
   * Checks if a request should be allowed.
   *
   * Drains queue based on elapsed time, then attempts to add request to queue.
   *
   * @returns true if request is allowed (added to queue), false if rate limited
   */
  allow(): boolean {
    this.drain();

    // Check if there's space in the queue
    if (this.queueSize < this.capacity) {
      this.queueSize += 1;
      return true;
    }

    return false;
  }

  /**
   * Drains the queue based on elapsed time since last drain.
   *
   * Uses interval-aligned timestamps to prevent timing drift.
   * This is CRITICAL for consistent behavior under sustained load.
   */
  private drain(): void {
    const now = Date.now();
    const elapsed = now - this.lastDrain;

    if (elapsed < LEAKY_BUCKET_DRAIN_INTERVAL_MS) {
      // Not enough time has passed for a drain
      return;
    }

    // Calculate how many complete intervals have elapsed
    const intervalsElapsed = Math.floor(
      elapsed / LEAKY_BUCKET_DRAIN_INTERVAL_MS
    );

    // Remove items for each elapsed interval
    const itemsToDrain = intervalsElapsed * this.drainRate;
    this.queueSize = Math.max(0, this.queueSize - itemsToDrain);

    // CRITICAL: Use interval-aligned timestamp to prevent drift
    // CORRECT: this.lastDrain = this.lastDrain + (intervalsElapsed * INTERVAL_MS)
    // WRONG: this.lastDrain = now (accumulates timing errors)
    this.lastDrain =
      this.lastDrain + intervalsElapsed * LEAKY_BUCKET_DRAIN_INTERVAL_MS;
  }

  /**
   * Resets the rate limiter to initial state.
   *
   * Clears queue and resets timestamp.
   */
  reset(): void {
    this.queueSize = 0;
    const now = Date.now();
    this.lastDrain =
      Math.floor(now / LEAKY_BUCKET_DRAIN_INTERVAL_MS) *
      LEAKY_BUCKET_DRAIN_INTERVAL_MS;
  }

  /**
   * Returns current rate limiter statistics.
   *
   * @returns Object with remaining queue capacity and next reset time
   */
  getStats(): { remaining: number; resetAt: number } {
    this.drain(); // Ensure queue is up-to-date

    return {
      remaining: Math.floor(this.capacity - this.queueSize),
      resetAt: this.lastDrain + LEAKY_BUCKET_DRAIN_INTERVAL_MS,
    };
  }
}
