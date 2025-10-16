import { TokenBucket } from "./src/rate-limiters/token-bucket.ts";
import { LeakyBucket } from "./src/rate-limiters/leaky-bucket.ts";

/**
 * Algorithm Validation Test Suite
 * Tests both Token Bucket and Leaky Bucket algorithms against spec requirements
 */

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): boolean {
  if (!condition) {
    console.error(`  ✗ ${message}`);
    return false;
  } else {
    console.log(`  ✓ ${message}`);
    return true;
  }
}

// Test 1: Burst Capacity (Instant Load)
async function testBurstCapacity() {
  console.log("\n[Test 1] Burst Capacity (10 RPS, fire 25 requests instantly)");

  const tokenBucket = new TokenBucket(10);
  const leakyBucket = new LeakyBucket(10);

  let tokenAllowed = 0;
  let leakyAllowed = 0;

  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
    if (leakyBucket.allow()) leakyAllowed++;
  }

  const tbPassed = assert(
    tokenAllowed === 20,
    `Token Bucket: ${tokenAllowed}/25 allowed (expected 20/25)`
  );
  const lbPassed = assert(
    leakyAllowed === 15,
    `Leaky Bucket: ${leakyAllowed}/25 allowed (expected 15/25)`
  );

  results.push({
    name: "Burst Capacity",
    passed: tbPassed && lbPassed,
    details: `Token: ${tokenAllowed}/25, Leaky: ${leakyAllowed}/25`,
  });
}

// Test 2: Sustained Rate Enforcement
async function testSustainedLoad() {
  console.log("\n[Test 2] Sustained Load (10 RPS, 100 requests @ 100ms intervals)");

  const tokenBucket = new TokenBucket(10);
  const leakyBucket = new LeakyBucket(10);

  let tokenAllowed = 0;
  let leakyAllowed = 0;

  for (let i = 0; i < 100; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
    if (leakyBucket.allow()) leakyAllowed++;

    // Simulate 100ms delay
    if ((i + 1) % 1 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const tbPassed = assert(
    tokenAllowed >= 95,
    `Token Bucket: ${tokenAllowed}/100 allowed (expected ~100)`
  );
  const lbPassed = assert(
    leakyAllowed >= 95,
    `Leaky Bucket: ${leakyAllowed}/100 allowed (expected ~100)`
  );

  results.push({
    name: "Sustained Load",
    passed: tbPassed && lbPassed,
    details: `Token: ${tokenAllowed}/100, Leaky: ${leakyAllowed}/100`,
  });
}

// Test 3: Recovery After Exhaustion (1 second)
async function testRecoveryAfter1s() {
  console.log(
    "\n[Test 3] Recovery After Exhaustion (10 RPS: burst → wait 1s → more)"
  );

  const tokenBucket = new TokenBucket(10);
  const leakyBucket = new LeakyBucket(10);

  // First burst: 25 requests
  let burst1TokenAllowed = 0;
  let burst1LeakyAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) burst1TokenAllowed++;
    if (leakyBucket.allow()) burst1LeakyAllowed++;
  }

  // Wait 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Second burst: 15 requests
  let burst2TokenAllowed = 0;
  let burst2LeakyAllowed = 0;
  for (let i = 0; i < 15; i++) {
    if (tokenBucket.allow()) burst2TokenAllowed++;
    if (leakyBucket.allow()) burst2LeakyAllowed++;
  }

  const tbPassed = assert(
    burst2TokenAllowed >= 9,
    `Token Bucket: Burst2 ${burst2TokenAllowed}/15 allowed (expected ~10+)`
  );
  const lbPassed = assert(
    burst2LeakyAllowed >= 9,
    `Leaky Bucket: Burst2 ${burst2LeakyAllowed}/15 allowed (expected ~10+)`
  );

  results.push({
    name: "Recovery After 1s",
    passed: tbPassed && lbPassed,
    details: `Token B2: ${burst2TokenAllowed}/15, Leaky B2: ${burst2LeakyAllowed}/15`,
  });
}

// Test 4: Full Recovery After 2 seconds
async function testFullRecoveryAfter2s() {
  console.log(
    "\n[Test 4] Full Recovery After 2 Seconds (10 RPS: burst → wait 2s → burst)"
  );

  const tokenBucket = new TokenBucket(10);
  const leakyBucket = new LeakyBucket(10);

  // First burst: 25 requests
  let burst1TokenAllowed = 0;
  let burst1LeakyAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) burst1TokenAllowed++;
    if (leakyBucket.allow()) burst1LeakyAllowed++;
  }

  // Wait 2 seconds
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Second burst: 25 requests (should all be allowed if fully recovered)
  let burst2TokenAllowed = 0;
  let burst2LeakyAllowed = 0;
  for (let i = 0; i < 25; i++) {
    if (tokenBucket.allow()) burst2TokenAllowed++;
    if (leakyBucket.allow()) burst2LeakyAllowed++;
  }

  const tbPassed = assert(
    burst2TokenAllowed === 20,
    `Token Bucket: Burst2 ${burst2TokenAllowed}/25 allowed (expected 20/25 - full capacity)`
  );
  const lbPassed = assert(
    burst2LeakyAllowed === 15,
    `Leaky Bucket: Burst2 ${burst2LeakyAllowed}/25 allowed (expected 15/25 - full capacity)`
  );

  results.push({
    name: "Full Recovery After 2s",
    passed: tbPassed && lbPassed,
    details: `Token B2: ${burst2TokenAllowed}/25, Leaky B2: ${burst2LeakyAllowed}/25`,
  });
}

// Test 5: Low Rate Configuration
async function testLowRate() {
  console.log("\n[Test 5] Low Rate Configuration (1 RPS, fire 5 requests)");

  const tokenBucket = new TokenBucket(1);
  const leakyBucket = new LeakyBucket(1);

  let tokenAllowed = 0;
  let leakyAllowed = 0;

  for (let i = 0; i < 5; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
    if (leakyBucket.allow()) leakyAllowed++;
  }

  const tbPassed = assert(
    tokenAllowed === 2,
    `Token Bucket: ${tokenAllowed}/5 allowed (expected 2/5 - capacity = 1 × 2.0 = 2)`
  );
  const lbPassed = assert(
    leakyAllowed === 1,
    `Leaky Bucket: ${leakyAllowed}/5 allowed (expected 1/5 - capacity = 1 × 1.5 = 1)`
  );

  results.push({
    name: "Low Rate",
    passed: tbPassed && lbPassed,
    details: `Token: ${tokenAllowed}/5, Leaky: ${leakyAllowed}/5`,
  });
}

// Test 6: High Rate Configuration
async function testHighRate() {
  console.log("\n[Test 6] High Rate Configuration (100 RPS, fire 500 requests)");

  const tokenBucket = new TokenBucket(100);
  const leakyBucket = new LeakyBucket(100);

  let tokenAllowed = 0;
  let leakyAllowed = 0;

  for (let i = 0; i < 500; i++) {
    if (tokenBucket.allow()) tokenAllowed++;
    if (leakyBucket.allow()) leakyAllowed++;
  }

  const tbPassed = assert(
    tokenAllowed === 200,
    `Token Bucket: ${tokenAllowed}/500 allowed (expected 200/500 - capacity = 100 × 2.0 = 200)`
  );
  const lbPassed = assert(
    leakyAllowed === 150,
    `Leaky Bucket: ${leakyAllowed}/500 allowed (expected 150/500 - capacity = 100 × 1.5 = 150)`
  );

  results.push({
    name: "High Rate",
    passed: tbPassed && lbPassed,
    details: `Token: ${tokenAllowed}/500, Leaky: ${leakyAllowed}/500`,
  });
}

// Test 7: Reset Functionality
async function testReset() {
  console.log("\n[Test 7] Reset Functionality");

  const tokenBucket = new TokenBucket(10);
  const leakyBucket = new LeakyBucket(10);

  // Exhaust capacity
  let tokenExhausted = true;
  for (let i = 0; i < 30; i++) {
    if (!tokenBucket.allow()) tokenExhausted = true;
    if (!leakyBucket.allow()) tokenExhausted = true;
  }

  // Reset
  tokenBucket.reset();
  leakyBucket.reset();

  // Try again immediately
  const tokenAllowedAfterReset = tokenBucket.allow();
  const leakyAllowedAfterReset = leakyBucket.allow();

  const tbPassed = assert(
    tokenAllowedAfterReset,
    "Token Bucket: Request allowed after reset"
  );
  const lbPassed = assert(
    leakyAllowedAfterReset,
    "Leaky Bucket: Request allowed after reset"
  );

  results.push({
    name: "Reset Functionality",
    passed: tbPassed && lbPassed,
    details: "Both limiters reset correctly",
  });
}

// Run all tests
async function runAllTests() {
  console.log(
    "╔════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║        Rate Limiting Algorithm Validation Suite            ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝"
  );

  await testBurstCapacity();
  await testSustainedLoad();
  await testRecoveryAfter1s();
  await testFullRecoveryAfter2s();
  await testLowRate();
  await testHighRate();
  await testReset();

  // Summary
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║                      Test Summary                           ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝"
  );

  let passedCount = 0;
  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${status}: ${result.name}`);
    if (!result.passed) {
      console.log(`       ${result.details}`);
    }
    if (result.passed) passedCount++;
  }

  console.log(
    `\nResults: ${passedCount}/${results.length} tests passed\n`
  );

  if (passedCount === results.length) {
    console.log("🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed");
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
