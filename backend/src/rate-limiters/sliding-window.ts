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

    // Sum all segments with appropriate weights
    let total = 0;
    for (let i = 0; i < SLIDING_WINDOW_SEGMENTS; i++) {
      if (i === this.currentSegmentIndex) {
        // Current segment - partial weight based on elapsed time
        total += this.segments[i];
      } else {
        // Previous segments - check if they're within the window
        const segmentAge = this.getSegmentAge(i);
        if (segmentAge < SLIDING_WINDOW_SEGMENTS) {
          const weight = Math.max(0, 1 - (segmentAge / SLIDING_WINDOW_SEGMENTS));
          total += this.segments[i] * weight;
        }
      }
    }

    return total;
  }

  private getSegmentAge(index: number): number {
    if (index === this.currentSegmentIndex) return 0;

    const distance = (this.currentSegmentIndex - index + SLIDING_WINDOW_SEGMENTS) % SLIDING_WINDOW_SEGMENTS;
    return distance;
  }
}