import { describe, it, expect } from 'bun:test';
import { TokenBucket } from './src/rate-limiters/token-bucket';
import { LeakyBucket } from './src/rate-limiters/leaky-bucket';
import { TOKEN_BUCKET_BURST_MULTIPLIER, LEAKY_BUCKET_QUEUE_MULTIPLIER } from './src/constants';

describe('Rate Limiters', () => {
  // Test 1: Burst Capacity (Instant Load)
  describe('Test 1: Burst Capacity', () => {
    it('Token Bucket: should allow 20/25 requests @ 10 RPS', () => {
      const limiter = new TokenBucket(10);
      let allowed = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(20);
    });

    it('Leaky Bucket: should allow 15/25 requests @ 10 RPS', () => {
      const limiter = new LeakyBucket(10);
      let allowed = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(15);
    });
  });

  // Test 2: Rate Enforcement (Sustained Load)
  describe('Test 2: Rate Enforcement', () => {
    it('Token Bucket: should allow ~20/20 requests @ 10 RPS with 100ms delay', async () => {
      const limiter = new TokenBucket(10);
      let allowed = 0;
      for (let i = 0; i < 20; i++) {
        if (limiter.allow()) allowed++;
        await new Promise(r => setTimeout(r, 100));
      }
      expect(allowed).toBeGreaterThanOrEqual(18); // Allow some timing variance
    });

    it('Leaky Bucket: should allow ~20/20 requests @ 10 RPS with 100ms delay', async () => {
      const limiter = new LeakyBucket(10);
      let allowed = 0;
      for (let i = 0; i < 20; i++) {
        if (limiter.allow()) allowed++;
        await new Promise(r => setTimeout(r, 100));
      }
      expect(allowed).toBeGreaterThanOrEqual(18);
    });
  });

  // Test 3: Recovery After Exhaustion
  describe('Test 3: Recovery After Exhaustion', () => {
    it('Token Bucket: should allow 20, then after 1s, allow 10 more', async () => {
      const limiter = new TokenBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(20);

      await new Promise(r => setTimeout(r, 1000));

      let burst2 = 0;
      for (let i = 0; i < 15; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(10); // Refilled ~10 tokens in 1s
    });

    it('Leaky Bucket: should allow 15, then after 1s, allow 10 more', async () => {
      const limiter = new LeakyBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(15);

      await new Promise(r => setTimeout(r, 1000));

      let burst2 = 0;
      for (let i = 0; i < 15; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(10); // Drained ~10 items in 1s
    });
  });

  // Test 4: Full Recovery After Idle Period
  describe('Test 4: Full Recovery After Idle', () => {
    it('Token Bucket: should fully refill after 2s idle', async () => {
      const limiter = new TokenBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(20);

      await new Promise(r => setTimeout(r, 2000));

      let burst2 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(20); // Full capacity restored
    });

    it('Leaky Bucket: should fully drain queue after 2s idle', async () => {
      const limiter = new LeakyBucket(10);

      let burst1 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst1++;
      }
      expect(burst1).toBe(15);

      await new Promise(r => setTimeout(r, 2000));

      let burst2 = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) burst2++;
      }
      expect(burst2).toBe(15); // Queue fully cleared
    });
  });

  // Test 5: Low Rate Configuration
  describe('Test 5: Low Rate (1 RPS)', () => {
    it('Token Bucket: should allow 2/5 requests @ 1 RPS', () => {
      const limiter = new TokenBucket(1);
      let allowed = 0;
      for (let i = 0; i < 5; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(2);
    });

    it('Leaky Bucket: should allow 1/5 requests @ 1 RPS', () => {
      const limiter = new LeakyBucket(1);
      let allowed = 0;
      for (let i = 0; i < 5; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(1);
    });
  });

  // Test 6: High Rate Configuration
  describe('Test 6: High Rate (100 RPS)', () => {
    it('Token Bucket: should allow 200/500 requests @ 100 RPS', () => {
      const limiter = new TokenBucket(100);
      let allowed = 0;
      for (let i = 0; i < 500; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(200);
    });

    it('Leaky Bucket: should allow 150/500 requests @ 100 RPS', () => {
      const limiter = new LeakyBucket(100);
      let allowed = 0;
      for (let i = 0; i < 500; i++) {
        if (limiter.allow()) allowed++;
      }
      expect(allowed).toBe(150);
    });
  });

  // Test 7: Reset Functionality
  describe('Test 7: Reset Functionality', () => {
    it('Token Bucket: reset() should restore full capacity', () => {
      const limiter = new TokenBucket(10);

      let before = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) before++;
      }
      expect(before).toBe(20);

      limiter.reset();

      let after = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) after++;
      }
      expect(after).toBe(20);
    });

    it('Leaky Bucket: reset() should clear queue', () => {
      const limiter = new LeakyBucket(10);

      let before = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) before++;
      }
      expect(before).toBe(15);

      limiter.reset();

      let after = 0;
      for (let i = 0; i < 25; i++) {
        if (limiter.allow()) after++;
      }
      expect(after).toBe(15);
    });
  });

  // Test 8: getStats() interface
  describe('Test 8: getStats() Interface', () => {
    it('Token Bucket: getStats() returns { remaining, resetAt }', () => {
      const limiter = new TokenBucket(10);
      const stats = limiter.getStats();

      expect(stats).toHaveProperty('remaining');
      expect(stats).toHaveProperty('resetAt');
      expect(typeof stats.remaining).toBe('number');
      expect(typeof stats.resetAt).toBe('number');
    });

    it('Leaky Bucket: getStats() returns { remaining, resetAt }', () => {
      const limiter = new LeakyBucket(10);
      const stats = limiter.getStats();

      expect(stats).toHaveProperty('remaining');
      expect(stats).toHaveProperty('resetAt');
      expect(typeof stats.remaining).toBe('number');
      expect(typeof stats.resetAt).toBe('number');
    });
  });
});
