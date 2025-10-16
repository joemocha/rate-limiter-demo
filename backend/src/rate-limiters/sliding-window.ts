import type { RateLimiter } from "../types/rate-limiter.interface";
import { SLIDING_WINDOW_SIZE_MS, SLIDING_WINDOW_SEGMENTS } from "../constants";

export class SlidingWindow implements RateLimiter {
  private readonly rps: number;
  private readonly maxRequests: number;
  private readonly segmentDuration: number;
  private readonly segments: number[];
  private currentSegmentIndex: number;
  private lastUpdateTime: number;

  constructor(rps: number) {
    this.rps = rps;
    this.maxRequests = Math.floor(rps * (SLIDING_WINDOW_SIZE_MS / 1000));
    this.segmentDuration = SLIDING_WINDOW_SIZE_MS / SLIDING_WINDOW_SEGMENTS;
    this.segments = new Array(SLIDING_WINDOW_SEGMENTS).fill(0);
    this.currentSegmentIndex = this.getCurrentSegmentIndex();
    this.lastUpdateTime = Date.now();
  }

  private getCurrentSegmentIndex(): number {
    const now = Date.now();
    const timeInWindow = now % SLIDING_WINDOW_SIZE_MS;
    return Math.floor(timeInWindow / this.segmentDuration);
  }

  private updateSegments(): void {
    const now = Date.now();
    const currentIndex = this.getCurrentSegmentIndex();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    // If enough time has passed, clear old segments
    if (timeSinceLastUpdate >= this.segmentDuration) {
      const segmentsToClear = Math.min(
        Math.floor(timeSinceLastUpdate / this.segmentDuration),
        SLIDING_WINDOW_SEGMENTS
      );

      // Clear segments in a circular manner
      for (let i = 0; i < segmentsToClear; i++) {
        const clearIndex = (this.currentSegmentIndex + i + 1) % SLIDING_WINDOW_SEGMENTS;
        this.segments[clearIndex] = 0;
      }
    }

    this.currentSegmentIndex = currentIndex;
    this.lastUpdateTime = now;
  }

  private calculateWeightedCount(): number {
    const now = Date.now();
    const currentSegmentStart = Math.floor(now / this.segmentDuration) * this.segmentDuration;
    const timeInCurrentSegment = now - currentSegmentStart;

    // Weight represents how far we are into the current segment
    // Example: if 30ms elapsed in 100ms segment, weight = 0.3
    const currentSegmentWeight = timeInCurrentSegment / this.segmentDuration;

    // Get previous segment index (circular)
    const prevSegmentIndex = (this.currentSegmentIndex - 1 + SLIDING_WINDOW_SEGMENTS) % SLIDING_WINDOW_SEGMENTS;

    // Sliding window counter algorithm:
    // - Previous complete segment weighted by how much overlaps with sliding window
    // - Current partial segment counted fully (represents "now")
    // - Other segments fully counted if within window
    const weightedCount =
      this.segments[prevSegmentIndex] * (1 - currentSegmentWeight) +
      this.segments[this.currentSegmentIndex] +
      this.sumOtherSegments();

    return weightedCount;
  }

  private sumOtherSegments(): number {
    let sum = 0;
    for (let i = 0; i < SLIDING_WINDOW_SEGMENTS - 2; i++) {
      // Start from 2 segments ago and sum backwards
      const index = (this.currentSegmentIndex - i - 2 + SLIDING_WINDOW_SEGMENTS) % SLIDING_WINDOW_SEGMENTS;
      sum += this.segments[index];
    }
    return sum;
  }

  allow(): boolean {
    this.updateSegments();

    const currentCount = this.calculateWeightedCount();

    if (currentCount < this.maxRequests) {
      this.segments[this.currentSegmentIndex]++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.segments.fill(0);
    this.currentSegmentIndex = this.getCurrentSegmentIndex();
    this.lastUpdateTime = Date.now();
  }

  getStats(): { remaining: number; resetAt: number } {
    this.updateSegments();

    const currentCount = this.calculateWeightedCount();
    const remaining = Math.max(0, Math.floor(this.maxRequests - currentCount));

    // Calculate when the oldest request in the window will expire
    const now = Date.now();
    const resetAt = now + SLIDING_WINDOW_SIZE_MS;

    return { remaining, resetAt };
  }
}