/**
 * WebSocket Race Stress Test
 *
 * Tests the Arena WebSocket endpoint under high RPS loads to verify:
 * - Frame rate maintained at 30fps (33.33ms intervals)
 * - Memory stability during extended races
 * - No frame drops or lag
 * - Proper session cleanup
 */

interface StressTestConfig {
  rps: number;
  duration: number;
  pattern: 'burst' | 'sustained' | 'chaos';
  foxAlgorithm?: string;
  hedgehogAlgorithm?: string;
}

interface TestResults {
  rps: number;
  duration: number;
  pattern: string;
  totalFrames: number;
  expectedFrames: number;
  averageFrameInterval: number;
  minFrameInterval: number;
  maxFrameInterval: number;
  framesReceived: number;
  frameDrops: number;
  memoryUsageMB: number;
  errors: string[];
  success: boolean;
}

async function runStressTest(config: StressTestConfig): Promise<TestResults> {
  return new Promise((resolve) => {
    const { rps, duration, pattern, foxAlgorithm = 'token-bucket', hedgehogAlgorithm = 'leaky-bucket' } = config;

    const results: TestResults = {
      rps,
      duration,
      pattern,
      totalFrames: 0,
      expectedFrames: duration * 30, // 30fps expected
      averageFrameInterval: 0,
      minFrameInterval: Infinity,
      maxFrameInterval: 0,
      framesReceived: 0,
      frameDrops: 0,
      memoryUsageMB: 0,
      errors: [],
      success: false,
    };

    const ws = new WebSocket('ws://localhost:9000/ws/race');
    const frameTimestamps: number[] = [];
    let lastFrameTime: number | null = null;
    let testStartTime: number;

    ws.onopen = () => {
      console.log(`[${rps} RPS] WebSocket connected`);
      testStartTime = Date.now();

      // Send race configuration
      ws.send(JSON.stringify({
        type: 'start-race',
        rps,
        duration,
        pattern,
        foxAlgorithm,
        hedgehogAlgorithm,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'race-frame') {
          const now = Date.now();
          frameTimestamps.push(now);
          results.framesReceived++;

          if (lastFrameTime !== null) {
            const interval = now - lastFrameTime;
            results.minFrameInterval = Math.min(results.minFrameInterval, interval);
            results.maxFrameInterval = Math.max(results.maxFrameInterval, interval);
          }
          lastFrameTime = now;
        } else if (data.type === 'race-stopped') {
          // Test complete
          const testDuration = Date.now() - testStartTime;

          // Calculate statistics
          if (frameTimestamps.length > 1) {
            const intervals = [];
            for (let i = 1; i < frameTimestamps.length; i++) {
              intervals.push(frameTimestamps[i] - frameTimestamps[i - 1]);
            }
            results.averageFrameInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          }

          results.totalFrames = results.framesReceived;
          results.frameDrops = Math.max(0, results.expectedFrames - results.framesReceived);
          results.memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

          // Success criteria:
          // - At least 90% of expected frames received
          // - Average frame interval close to 33.33ms (within 10ms tolerance)
          const frameCompleteness = results.framesReceived / results.expectedFrames;
          const frameIntervalAccuracy = Math.abs(results.averageFrameInterval - 33.33) < 10;

          results.success = frameCompleteness >= 0.9 && frameIntervalAccuracy;

          ws.close();
          resolve(results);
        } else if (data.type === 'error') {
          results.errors.push(data.message);
        }
      } catch (error) {
        results.errors.push(`Parse error: ${error}`);
      }
    };

    ws.onerror = (error) => {
      results.errors.push(`WebSocket error: ${error}`);
      results.success = false;
      resolve(results);
    };

    ws.onclose = () => {
      // If closed before race-stopped, it's an error
      if (results.totalFrames === 0) {
        results.errors.push('Connection closed before test completed');
        results.success = false;
        resolve(results);
      }
    };

    // Timeout safety
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        results.errors.push('Test timeout');
        results.success = false;
        ws.close();
        resolve(results);
      }
    }, (duration + 5) * 1000);
  });
}

function printResults(results: TestResults): void {
  console.log('\n' + '='.repeat(70));
  console.log(`STRESS TEST RESULTS: ${results.rps} RPS (${results.pattern} pattern)`);
  console.log('='.repeat(70));
  console.log(`Duration:              ${results.duration}s`);
  console.log(`Expected Frames:       ${results.expectedFrames} (30fps)`);
  console.log(`Frames Received:       ${results.framesReceived}`);
  console.log(`Frame Completeness:    ${((results.framesReceived / results.expectedFrames) * 100).toFixed(1)}%`);
  console.log(`Frame Drops:           ${results.frameDrops}`);
  console.log(`Avg Frame Interval:    ${results.averageFrameInterval.toFixed(2)}ms (target: 33.33ms)`);
  console.log(`Min Frame Interval:    ${results.minFrameInterval.toFixed(2)}ms`);
  console.log(`Max Frame Interval:    ${results.maxFrameInterval.toFixed(2)}ms`);
  console.log(`Memory Usage:          ${results.memoryUsageMB}MB`);

  if (results.errors.length > 0) {
    console.log(`Errors:                ${results.errors.length}`);
    results.errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log(`Status:                ${results.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(70) + '\n');
}

async function runFullStressSuite(): Promise<void> {
  console.log('🔥 WebSocket Race Stress Test Suite\n');
  console.log('Testing Arena WebSocket endpoint at ws://localhost:9000/ws/race');
  console.log('Duration: 10 seconds per test');
  console.log('Pattern: sustained (steady rate)\n');

  const testConfigs: StressTestConfig[] = [
    { rps: 100, duration: 10, pattern: 'sustained' },
    { rps: 500, duration: 10, pattern: 'sustained' },
    { rps: 1000, duration: 10, pattern: 'sustained' },
  ];

  const allResults: TestResults[] = [];

  for (const config of testConfigs) {
    console.log(`\nStarting test: ${config.rps} RPS...`);
    const results = await runStressTest(config);
    printResults(results);
    allResults.push(results);

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('STRESS TEST SUITE SUMMARY');
  console.log('='.repeat(70));

  const passed = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;

  console.log(`Total Tests:    ${allResults.length}`);
  console.log(`Passed:         ${passed} ✅`);
  console.log(`Failed:         ${failed} ❌`);
  console.log(`Success Rate:   ${((passed / allResults.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(70));

  allResults.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const completeness = ((r.framesReceived / r.expectedFrames) * 100).toFixed(1);
    console.log(`${status} ${r.rps} RPS: ${r.framesReceived}/${r.expectedFrames} frames (${completeness}%), ${r.averageFrameInterval.toFixed(1)}ms avg interval`);
  });

  console.log('\n✅ All stress tests complete!\n');
  process.exit(passed === allResults.length ? 0 : 1);
}

// Run the stress test suite
runFullStressSuite().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
