import { RateLimiter } from "../types/rate-limiter.interface";
import { SLIDING_WINDOW_SIZE_MS, SLIDING_WINDOW_SEGMENTS } from "../constants";

export class SlidingWindow implements RateLimiter {
  private segments: number[];
  private segmentDuration: number;
  private currentSegmentStart: number;
  private currentSegmentIndex: number;

  constructor(private rps: number) {
    this.segments = new Array(SLIDING_WINDOW_SEGMENTS).fill(0);
    this.segmentDuration = SLIDING_WINDOW_SIZE_MS / SLIDING_WINDOW_SEGMENTS;
    this.currentSegmentStart = Date.now();
    this.currentSegmentIndex = 0;
  }

  allow(): boolean {
    this.updateSegments();

    // Calculate weighted sum of current and previous window
    const weightedSum = this.calculateWeightedSum();

    if (weightedSum < this.rps) {
      this.segments[this.currentSegmentIndex]++;
      return true;
    }

    return false;
  }

  reset(): void {
    this.segments.fill(0);
    this.currentSegmentStart = Date.now();
    this.currentSegmentIndex = 0;
  }

  getStats(): { remaining: number; resetAt: number } {
    this.updateSegments();
    const weightedSum = this.calculateWeightedSum();

    return {
      remaining: Math.max(0, Math.floor(this.rps - weightedSum)),
      resetAt: this.currentSegmentStart + this.segmentDuration
    };
  }

  private updateSegments(): void {
    const now = Date.now();
    const elapsed = now - this.currentSegmentStart;
    const segmentsPassed = Math.floor(elapsed / this.segmentDuration);

    if (segmentsPassed > 0) {
      // Clear old segments and advance
      for (let i = 0; i < Math.min(segmentsPassed, SLIDING_WINDOW_SEGMENTS); i++) {
        this.currentSegmentIndex = (this.currentSegmentIndex + 1) % SLIDING_WINDOW_SEGMENTS;
        this.segments[this.currentSegmentIndex] = 0;
      }

      this.currentSegmentStart += segmentsPassed * this.segmentDuration;
    }
  }

  private calculateWeightedSum(): number {
    const now = Date.now();
    const currentSegmentElapsed = (now - this.currentSegmentStart) / this.segmentDuration;

    // Get the immediately previous segment (age = 1)
    const prevSegmentIndex = (this.currentSegmentIndex - 1 + SLIDING_WINDOW_SEGMENTS) % SLIDING_WINDOW_SEGMENTS;

    // Sliding window counter algorithm:
    // - Previous complete segment weighted by how much still overlaps with sliding window
    // - Current segment counted fully (represents requests happening "now")
    // - Other segments summed fully if within the window range
    const weightedSum =
      this.segments[prevSegmentIndex] * (1 - currentSegmentElapsed) +
      this.segments[this.currentSegmentIndex] +
      this.sumOtherSegments();

    return weightedSum;
  }

  private sumOtherSegments(): number {
    // Sum segments with age-based weighting for smoother rate limiting
    // Segments further back in time contribute less to the current count
    let sum = 0;
    for (let i = 0; i < SLIDING_WINDOW_SEGMENTS; i++) {
      const age = this.getSegmentAge(i);
      if (age >= 2 && age < SLIDING_WINDOW_SEGMENTS) {
        // Linear decay: segments at the far edge of the window contribute proportionally less
        // Example: at age=5 in a 10-segment window, weight = 1 - 5/10 = 0.5
        const weight = 1 - (age / SLIDING_WINDOW_SEGMENTS);
        sum += this.segments[i] * weight;
      }
    }
    return sum;
  }

  private getSegmentAge(index: number): number {
    if (index === this.currentSegmentIndex) return 0;

    const distance = (this.currentSegmentIndex - index + SLIDING_WINDOW_SEGMENTS) % SLIDING_WINDOW_SEGMENTS;
    return distance;
  }
}