#!/usr/bin/env bun

/**
 * Algorithm Validation & Testing Suite
 *
 * This test suite validates that all five rate limiting algorithms
 * behave according to the specification requirements.
 */

import { TokenBucket } from "./src/rate-limiters/token-bucket";
import { LeakyBucket } from "./src/rate-limiters/leaky-bucket";
import { FixedWindow } from "./src/rate-limiters/fixed-window";
import { SlidingWindow } from "./src/rate-limiters/sliding-window";
import { SlidingLog } from "./src/rate-limiters/sliding-log";
import type { RateLimiter } from "./src/types/rate-limiter.interface";

// Utility to wait for a specified duration
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.log(`  ✗ ${message}`);
  }
}

function assertRange(actual: number, expected: number, tolerance: number, message: string) {
  totalTests++;
  const withinRange = Math.abs(actual - expected) <= tolerance;
  if (withinRange) {
    passedTests++;
    console.log(`  ✓ ${message} (${actual}/${expected})`);
  } else {
    failedTests++;
    console.log(`  ✗ ${message} (${actual}/${expected}, tolerance: ±${tolerance})`);
  }
}

console.log("========================================");
console.log("Rate Limiter Algorithm Validation Suite");
console.log("========================================\n");

// ============================================================================
// Test 1: Burst Capacity (Instant Load)
// ============================================================================
async function test1BurstCapacity() {
  console.log("Test 1: Burst Capacity (Instant Load)");
  console.log("Configuration: 10 RPS");
  console.log("Action: Fire 25 requests instantly (0ms delay)\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(10);
  let tokenAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
  }
  assert(tokenAllowed === 20, `Must allow exactly 20/25 requests (got ${tokenAllowed})`);
  assert((25 - tokenAllowed) === 5, `Must reject exactly 5/25 requests (got ${25 - tokenAllowed})`);

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(10);
  let leakyAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (leakyBucket.allow()) leakyAllowed++;
  }
  assert(leakyAllowed === 15, `Must allow exactly 15/25 requests (got ${leakyAllowed})`);
  assert((25 - leakyAllowed) === 10, `Must reject exactly 10/25 requests (got ${25 - leakyAllowed})`);

  // Fixed Window
  console.log("\nFixed Window:");
  const fixedWindow = new FixedWindow(10);
  let fixedAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (fixedWindow.allow()) fixedAllowed++;
  }
  assert(fixedAllowed === 10, `Must allow exactly 10/25 requests (got ${fixedAllowed})`);
  assert((25 - fixedAllowed) === 15, `Must reject exactly 15/25 requests (got ${25 - fixedAllowed})`);

  // Sliding Window
  console.log("\nSliding Window:");
  const slidingWindow = new SlidingWindow(10);
  let slidingAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (slidingWindow.allow()) slidingAllowed++;
  }
  assert(slidingAllowed === 10, `Must allow exactly 10/25 requests (got ${slidingAllowed})`);
  assert((25 - slidingAllowed) === 15, `Must reject exactly 15/25 requests (got ${25 - slidingAllowed})`);

  // Sliding Log
  console.log("\nSliding Log:");
  const slidingLog = new SlidingLog(10);
  let slidingLogAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (slidingLog.allow()) slidingLogAllowed++;
  }
  assert(slidingLogAllowed === 10, `Must allow exactly 10/25 requests (got ${slidingLogAllowed})`);
  assert((25 - slidingLogAllowed) === 15, `Must reject exactly 15/25 requests (got ${25 - slidingLogAllowed})`);

  console.log("\n✓ Validates: Token Bucket starts FULL (capacity = rps × 2.0)");
  console.log("✓ Validates: Leaky Bucket starts EMPTY (queue size = rps × 1.5)");
  console.log("✓ Validates: Fixed Window, Sliding Window, Sliding Log enforce exact limits\n");
}

// ============================================================================
// Test 2: Rate Enforcement (Sustained Load)
// ============================================================================
async function test2RateEnforcement() {
  console.log("Test 2: Rate Enforcement (Sustained Load)");
  console.log("Configuration: 10 RPS");
  console.log("Action: Fire 100 requests with 100ms delay between each\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(10);
  let tokenAllowed = 0;
  for (let i = 0; i < 100; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
    await wait(100);
  }
  // Should allow most requests (~98-100) with 100ms delay at 10 RPS
  assertRange(tokenAllowed, 100, 5, "Must allow ~100/100 requests");

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(10);
  let leakyAllowed = 0;
  for (let i = 0; i < 100; i++) {
    if (leakyBucket.allow()) leakyAllowed++;
    await wait(100);
  }
  assertRange(leakyAllowed, 100, 5, "Must allow ~100/100 requests");

  console.log("\n✓ Validates: Long-term rate adherence after initial burst");
  console.log("✓ Validates: Steady-state processing at configured rate\n");
}

// ============================================================================
// Test 3: Recovery After Exhaustion
// ============================================================================
async function test3RecoveryAfterExhaustion() {
  console.log("Test 3: Recovery After Exhaustion");
  console.log("Configuration: 10 RPS");
  console.log("Action: Fire 25 instantly → Wait 1s → Fire 15\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(10);

  let burst1Allowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) burst1Allowed++;
  }
  assert(burst1Allowed === 20, `Burst 1: Must allow 20/25 (got ${burst1Allowed})`);

  await wait(1000); // Wait 1 second for refill

  let burst2Allowed = 0;
  for (let i = 0; i < 15; i++) {
    if (tokenBucket.allow()) burst2Allowed++;
  }
  assertRange(burst2Allowed, 10, 1, "Burst 2: Must allow ~10/15 after 1s refill");

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(10);

  burst1Allowed = 0;
  for (let i = 0; i < 25; i++) {
    if (leakyBucket.allow()) burst1Allowed++;
  }
  assert(burst1Allowed === 15, `Burst 1: Must allow 15/25 (got ${burst1Allowed})`);

  await wait(1000); // Wait 1 second for drain

  burst2Allowed = 0;
  for (let i = 0; i < 15; i++) {
    if (leakyBucket.allow()) burst2Allowed++;
  }
  assertRange(burst2Allowed, 10, 2, "Burst 2: Must allow ~10/15 after 1s drain");

  console.log("\n✓ Validates: Token Bucket refill rate = 10 tokens/second");
  console.log("✓ Validates: Leaky Bucket drain rate = 10 items/second\n");
}

// ============================================================================
// Test 4: Full Recovery After Idle Period
// ============================================================================
async function test4FullRecovery() {
  console.log("Test 4: Full Recovery After Idle Period");
  console.log("Configuration: 10 RPS");
  console.log("Action: Fire 25 instantly → Wait 2s → Fire 25\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(10);

  let burst1Allowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) burst1Allowed++;
  }
  assert(burst1Allowed === 20, `Burst 1: Must allow 20/25 (got ${burst1Allowed})`);

  await wait(2000); // Wait 2 seconds for full refill

  let burst2Allowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) burst2Allowed++;
  }
  assert(burst2Allowed === 20, `Burst 2: Must allow 20/25 after full refill (got ${burst2Allowed})`);

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(10);

  burst1Allowed = 0;
  for (let i = 0; i < 25; i++) {
    if (leakyBucket.allow()) burst1Allowed++;
  }
  assert(burst1Allowed === 15, `Burst 1: Must allow 15/25 (got ${burst1Allowed})`);

  await wait(2000); // Wait 2 seconds for full drain

  burst2Allowed = 0;
  for (let i = 0; i < 25; i++) {
    if (leakyBucket.allow()) burst2Allowed++;
  }
  assert(burst2Allowed === 15, `Burst 2: Must allow 15/25 after full drain (got ${burst2Allowed})`);

  console.log("\n✓ Validates: Complete capacity restoration");
  console.log("✓ Validates: Complete queue clearance\n");
}

// ============================================================================
// Test 5: Low Rate Configuration
// ============================================================================
async function test5LowRate() {
  console.log("Test 5: Low Rate Configuration");
  console.log("Configuration: 1 RPS");
  console.log("Action: Fire 5 requests instantly\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(1);
  let tokenAllowed = 0;
  for (let i = 0; i < 5; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
  }
  assert(tokenAllowed === 2, `Must allow 2/5 requests (capacity = 1 × 2.0 = 2, got ${tokenAllowed})`);

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(1);
  let leakyAllowed = 0;
  for (let i = 0; i < 5; i++) {
    if (leakyBucket.allow()) leakyAllowed++;
  }
  assert(leakyAllowed === 1, `Must allow 1/5 requests (queue = 1 × 1.5 = 1, got ${leakyAllowed})`);

  console.log("\n✓ Validates: Multipliers scale correctly at low rates\n");
}

// ============================================================================
// Test 6: High Rate Configuration
// ============================================================================
async function test6HighRate() {
  console.log("Test 6: High Rate Configuration");
  console.log("Configuration: 100 RPS");
  console.log("Action: Fire 500 requests instantly\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(100);
  let tokenAllowed = 0;
  for (let i = 0; i < 500; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
  }
  assert(tokenAllowed === 200, `Must allow 200/500 requests (capacity = 100 × 2.0, got ${tokenAllowed})`);

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(100);
  let leakyAllowed = 0;
  for (let i = 0; i < 500; i++) {
    if (leakyBucket.allow()) leakyAllowed++;
  }
  assert(leakyAllowed === 150, `Must allow 150/500 requests (queue = 100 × 1.5, got ${leakyAllowed})`);

  console.log("\n✓ Validates: Burst tolerance scales proportionally\n");
}

// ============================================================================
// Test 7: Reset Functionality
// ============================================================================
async function test7ResetFunctionality() {
  console.log("Test 7: Reset Functionality");
  console.log("Configuration: 10 RPS\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(10);

  // Exhaust tokens
  for (let i = 0; i < 20; i++) {
    tokenBucket.allow();
  }

  const statsBeforeReset = tokenBucket.getStats();
  assert(statsBeforeReset.remaining === 0, `After exhaustion: remaining should be 0 (got ${statsBeforeReset.remaining})`);

  // Reset
  tokenBucket.reset();

  const statsAfterReset = tokenBucket.getStats();
  assert(statsAfterReset.remaining === 20, `After reset: remaining should be 20 (got ${statsAfterReset.remaining})`);

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(10);

  // Fill queue
  for (let i = 0; i < 15; i++) {
    leakyBucket.allow();
  }

  const leakyStatsBeforeReset = leakyBucket.getStats();
  assert(leakyStatsBeforeReset.remaining === 0, `After filling: remaining should be 0 (got ${leakyStatsBeforeReset.remaining})`);

  // Reset
  leakyBucket.reset();

  const leakyStatsAfterReset = leakyBucket.getStats();
  assert(leakyStatsAfterReset.remaining === 15, `After reset: remaining should be 15 (got ${leakyStatsAfterReset.remaining})`);

  console.log("\n✓ Validates: Reset clears state correctly\n");
}

// ============================================================================
// Test 8: getStats() Accuracy
// ============================================================================
async function test8GetStatsAccuracy() {
  console.log("Test 8: getStats() Accuracy");
  console.log("Configuration: 10 RPS\n");

  // Token Bucket
  console.log("Token Bucket:");
  const tokenBucket = new TokenBucket(10);

  const initialStats = tokenBucket.getStats();
  assert(initialStats.remaining === 20, `Initial remaining should be 20 (got ${initialStats.remaining})`);

  // Consume 5 tokens
  for (let i = 0; i < 5; i++) {
    tokenBucket.allow();
  }

  const afterConsumption = tokenBucket.getStats();
  assert(afterConsumption.remaining === 15, `After 5 requests: remaining should be 15 (got ${afterConsumption.remaining})`);

  // Leaky Bucket
  console.log("\nLeaky Bucket:");
  const leakyBucket = new LeakyBucket(10);

  const leakyInitialStats = leakyBucket.getStats();
  assert(leakyInitialStats.remaining === 15, `Initial remaining should be 15 (got ${leakyInitialStats.remaining})`);

  // Add 5 items to queue
  for (let i = 0; i < 5; i++) {
    leakyBucket.allow();
  }

  const leakyAfterAdding = leakyBucket.getStats();
  assert(leakyAfterAdding.remaining === 10, `After 5 requests: remaining should be 10 (got ${leakyAfterAdding.remaining})`);

  console.log("\n✓ Validates: getStats() returns accurate current state\n");
}

// ============================================================================
// Test 9: Fixed Window Boundary Effects
// ============================================================================
async function test9FixedWindowBoundaryEffects() {
  console.log("Test 9: Fixed Window Boundary Effects");
  console.log("Configuration: 10 RPS");
  console.log("Action: Fire 10 requests near window boundary\n");

  const fixedWindow = new FixedWindow(10);

  // Exhaust the window
  console.log("Fixed Window (demonstrating boundary effect):");
  let exhausted = 0;
  for (let i = 0; i < 10; i++) {
    if (fixedWindow.allow()) exhausted++;
  }
  assert(exhausted === 10, `Should allow all 10 requests initially (got ${exhausted})`);

  // Try one more - should be rejected
  const rejected = !fixedWindow.allow();
  assert(rejected, "11th request should be rejected in current window");

  // Wait for next window (slightly over 1 second to ensure we're in the next window)
  console.log("  Waiting for window boundary...");
  await wait(1100);

  // Now we should be able to fire another 10 requests immediately
  let newWindowAllowed = 0;
  for (let i = 0; i < 10; i++) {
    if (fixedWindow.allow()) newWindowAllowed++;
  }
  assert(newWindowAllowed === 10, `Should allow 10 requests in new window (got ${newWindowAllowed})`);

  console.log("\n✓ Validates: Fixed Window allows burst at window boundaries");
  console.log("✓ Demonstrates: Potential for 2x rate at window edges\n");
}

// ============================================================================
// Run All Tests
// ============================================================================
async function runAllTests() {
  const startTime = Date.now();

  await test1BurstCapacity();
  await test2RateEnforcement();
  await test3RecoveryAfterExhaustion();
  await test4FullRecovery();
  await test5LowRate();
  await test6HighRate();
  await test7ResetFunctionality();
  await test8GetStatsAccuracy();
  await test9FixedWindowBoundaryEffects();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("========================================");
  console.log("Test Summary");
  console.log("========================================");
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✓`);
  console.log(`Failed: ${failedTests} ✗`);
  console.log(`Duration: ${duration}s`);
  console.log("========================================\n");

  if (failedTests > 0) {
    console.log("❌ Some tests failed. Please review the implementation.\n");
    process.exit(1);
  } else {
    console.log("✅ All tests passed! Rate limiters conform to specification.\n");
    process.exit(0);
  }
}

runAllTests();
