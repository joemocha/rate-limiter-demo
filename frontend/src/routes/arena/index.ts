import './style.css';

interface AlgorithmState {
  tokens?: number;
  capacity?: number;
  queueSize?: number;
  maxQueue?: number;
  accepted: number;
  rejected: number;
}

let foxState: AlgorithmState = { accepted: 0, rejected: 0 };
let hedgehogState: AlgorithmState = { accepted: 0, rejected: 0 };
let isRacing = false;
let animationFrameId: number | null = null;
let ws: WebSocket | null = null;

// WebSocket reconnection state
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectTimeoutId: number | null = null;
let reconnectDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff in ms
let raceConfig: { rps: number; duration: number; pattern: string; foxAlgorithm: string; hedgehogAlgorithm: string } | null = null;

// Optional: Health check polling (disabled by default)
let healthCheckIntervalId: number | null = null;
const HEALTH_CHECK_ENABLED = false; // Set to true to enable periodic health checks

export function renderArena(): string {
  return `
    <div class="arena-container">
      <header class="arena-header">
        <a href="/" data-route="/" class="back-link">← Back to Landing</a>
        <h1>🏁 Algorithm Arena</h1>
        <div class="race-status">
          <span id="connection-status" class="connection-indicator" title="Connection status">●</span>
          <span id="race-status-text">Ready to race</span>
        </div>
      </header>

      <div class="arena-layout">
        <div class="algorithm-column fox">
          <div class="algorithm-header">
            <div class="algorithm-icon">🦊</div>
            <h2>Fox</h2>
            <div class="algorithm-selector">
              <label for="fox-algorithm">Algorithm:</label>
              <select id="fox-algorithm" class="form-control">
                <option value="token-bucket">Token Bucket</option>
                <option value="leaky-bucket">Leaky Bucket</option>
              </select>
            </div>
          </div>

          <div class="visualization-container">
            <canvas id="fox-canvas" width="300" height="300"></canvas>
            <div class="viz-label"><span id="fox-label">Tokens</span>: <span id="fox-tokens">0/0</span></div>
          </div>

          <div class="metrics">
            <div class="metric">
              <span class="metric-label">Accepted</span>
              <span id="fox-accepted" class="metric-value success">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rejected</span>
              <span id="fox-rejected" class="metric-value error">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rate</span>
              <span id="fox-rate" class="metric-value">0/s</span>
            </div>
          </div>
        </div>

        <div class="algorithm-column hedgehog">
          <div class="algorithm-header">
            <div class="algorithm-icon">🦔</div>
            <h2>Hedgehog</h2>
            <div class="algorithm-selector">
              <label for="hedgehog-algorithm">Algorithm:</label>
              <select id="hedgehog-algorithm" class="form-control">
                <option value="token-bucket">Token Bucket</option>
                <option value="leaky-bucket" selected>Leaky Bucket</option>
              </select>
            </div>
          </div>

          <div class="visualization-container">
            <canvas id="hedgehog-canvas" width="300" height="300"></canvas>
            <div class="viz-label"><span id="hedgehog-label">Queue</span>: <span id="hedgehog-queue">0/0</span></div>
          </div>

          <div class="metrics">
            <div class="metric">
              <span class="metric-label">Accepted</span>
              <span id="hedgehog-accepted" class="metric-value success">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rejected</span>
              <span id="hedgehog-rejected" class="metric-value error">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Rate</span>
              <span id="hedgehog-rate" class="metric-value">0/s</span>
            </div>
          </div>
        </div>
      </div>

      <div class="race-controls">
        <div class="control-group">
          <label for="race-rps">Requests Per Second</label>
          <input type="number" id="race-rps" class="form-control" min="1" max="1000" value="10" />
        </div>

        <div class="control-group">
          <label for="race-duration">Duration (seconds)</label>
          <input type="number" id="race-duration" class="form-control" min="5" max="60" value="30" />
        </div>

        <div class="control-group">
          <label for="race-pattern">Traffic Pattern</label>
          <select id="race-pattern" class="form-control">
            <option value="burst">Burst</option>
            <option value="sustained">Sustained</option>
            <option value="chaos">Chaos</option>
          </select>
        </div>

        <button id="start-race-btn" class="btn btn-primary">Start Race</button>
        <button id="stop-race-btn" class="btn btn-outline" disabled>Stop Race</button>
      </div>

      <div class="comparative-metrics">
        <h3>Comparative Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-card-label">Winner</div>
            <div id="winner-display" class="metric-card-value">—</div>
          </div>
          <div class="metric-card">
            <div class="metric-card-label">Fox Throughput</div>
            <div id="fox-throughput" class="metric-card-value">0%</div>
          </div>
          <div class="metric-card">
            <div class="metric-card-label">Hedgehog Throughput</div>
            <div id="hedgehog-throughput" class="metric-card-value">0%</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function mountArena(): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderArena();
    attachEventListeners();
    initializeCanvases();
    updateConnectionStatus('disconnected'); // Initial state

    // Optional: Start health check polling
    if (HEALTH_CHECK_ENABLED) {
      startHealthCheckPolling();
    }
  }
}

// Optional health check polling
function startHealthCheckPolling(): void {
  // Poll health endpoint every 10 seconds
  healthCheckIntervalId = window.setInterval(async () => {
    try {
      const response = await fetch('/ws/health');
      const data = await response.json();
      console.log('[Health Check]', data);
    } catch (error) {
      console.error('[Health Check] Failed:', error);
    }
  }, 10000);
}

export function stopHealthCheckPolling(): void {
  if (healthCheckIntervalId !== null) {
    clearInterval(healthCheckIntervalId);
    healthCheckIntervalId = null;
  }
}

function attachEventListeners(): void {
  const startBtn = document.getElementById('start-race-btn');
  const stopBtn = document.getElementById('stop-race-btn');

  startBtn?.addEventListener('click', handleStartRace);
  stopBtn?.addEventListener('click', handleStopRace);
}

function initializeCanvases(): void {
  const foxCanvas = document.getElementById('fox-canvas') as HTMLCanvasElement;
  const hedgehogCanvas = document.getElementById('hedgehog-canvas') as HTMLCanvasElement;

  if (foxCanvas && hedgehogCanvas) {
    // Initial render with empty state
    renderTokenBucket(foxCanvas, 0, 20);
    renderLeakyBucket(hedgehogCanvas, 0, 15);
  }
}

function renderTokenBucket(canvas: HTMLCanvasElement, tokens: number, capacity: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw container
  const containerWidth = 200;
  const containerHeight = 250;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2 + 20;

  ctx.strokeStyle = '#646cff';
  ctx.lineWidth = 3;
  ctx.strokeRect(containerX, containerY, containerWidth, containerHeight);

  // Draw water level
  const fillRatio = capacity > 0 ? tokens / capacity : 0;
  const fillHeight = containerHeight * fillRatio;
  const fillY = containerY + containerHeight - fillHeight;

  const gradient = ctx.createLinearGradient(0, fillY, 0, containerY + containerHeight);
  gradient.addColorStop(0, 'rgba(100, 108, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(100, 108, 255, 0.4)');

  ctx.fillStyle = gradient;
  ctx.fillRect(containerX, fillY, containerWidth, fillHeight);

  // Draw waves on water surface
  if (fillHeight > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const waveY = fillY;
    for (let x = containerX; x <= containerX + containerWidth; x += 20) {
      const waveOffset = Math.sin((x - containerX) / 20) * 5;
      ctx.lineTo(x, waveY + waveOffset);
    }
    ctx.stroke();
  }

  // Draw label
  ctx.fillStyle = 'white';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(tokens)} / ${capacity} tokens`, width / 2, containerY - 10);
}

function renderLeakyBucket(canvas: HTMLCanvasElement, queueSize: number, maxQueue: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw container (inverted funnel)
  const containerWidth = 200;
  const containerHeight = 250;
  const containerX = (width - containerWidth) / 2;
  const containerY = (height - containerHeight) / 2 + 20;

  ctx.strokeStyle = '#42b883';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(containerX, containerY);
  ctx.lineTo(containerX, containerY + containerHeight);
  ctx.lineTo(containerX + containerWidth, containerY + containerHeight);
  ctx.lineTo(containerX + containerWidth, containerY);
  ctx.stroke();

  // Draw queue blocks
  const fillRatio = maxQueue > 0 ? queueSize / maxQueue : 0;
  const blockHeight = 20;
  const blockCount = Math.ceil(fillRatio * (containerHeight / blockHeight));

  for (let i = 0; i < blockCount; i++) {
    const blockY = containerY + containerHeight - (i + 1) * blockHeight;

    ctx.fillStyle = i % 2 === 0 ? 'rgba(66, 184, 131, 0.8)' : 'rgba(66, 184, 131, 0.6)';
    ctx.fillRect(containerX + 5, blockY, containerWidth - 10, blockHeight - 2);
  }

  // Draw label
  ctx.fillStyle = 'white';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(queueSize)} / ${maxQueue} items`, width / 2, containerY - 10);
}

function handleStartRace(): void {
  const rpsInput = document.getElementById('race-rps') as HTMLInputElement;
  const durationInput = document.getElementById('race-duration') as HTMLInputElement;
  const patternSelect = document.getElementById('race-pattern') as HTMLSelectElement;
  const foxAlgorithmSelect = document.getElementById('fox-algorithm') as HTMLSelectElement;
  const hedgehogAlgorithmSelect = document.getElementById('hedgehog-algorithm') as HTMLSelectElement;
  const startBtn = document.getElementById('start-race-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-race-btn') as HTMLButtonElement;
  const statusText = document.getElementById('race-status-text');

  const rps = parseInt(rpsInput.value, 10);
  const duration = parseInt(durationInput.value, 10);
  const pattern = patternSelect.value;
  const foxAlgorithm = foxAlgorithmSelect.value;
  const hedgehogAlgorithm = hedgehogAlgorithmSelect.value;

  // Input validation
  if (isNaN(rps) || rps <= 0 || rps > 1000) {
    if (statusText) statusText.textContent = 'Invalid RPS: must be between 1 and 1000';
    return;
  }

  if (isNaN(duration) || duration < 5 || duration > 60) {
    if (statusText) statusText.textContent = 'Invalid duration: must be between 5 and 60 seconds';
    return;
  }

  // Store race config for potential reconnections
  raceConfig = { rps, duration, pattern, foxAlgorithm, hedgehogAlgorithm };

  // Reset state
  foxState = { accepted: 0, rejected: 0 };
  hedgehogState = { accepted: 0, rejected: 0 };
  reconnectAttempts = 0;

  // Update UI
  isRacing = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  // Update visualization labels based on selected algorithms
  const foxLabel = document.getElementById('fox-label');
  const hedgehogLabel = document.getElementById('hedgehog-label');
  if (foxLabel) foxLabel.textContent = foxAlgorithm === 'token-bucket' ? 'Tokens' : 'Queue';
  if (hedgehogLabel) hedgehogLabel.textContent = hedgehogAlgorithm === 'token-bucket' ? 'Tokens' : 'Queue';

  // Start countdown
  if (statusText) statusText.textContent = 'Preparing race...';

  let countdown = 3;
  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      if (statusText) statusText.textContent = `${countdown}...`;
      countdown--;
    } else {
      clearInterval(countdownInterval);
      if (statusText) statusText.textContent = 'Starting!';

      // Start animation loop
      startRenderLoop();

      // Connect to WebSocket after countdown
      connectWebSocket(rps, duration, pattern, foxAlgorithm, hedgehogAlgorithm);
    }
  }, 800); // 800ms per countdown tick
}

function handleStopRace(): void {
  const startBtn = document.getElementById('start-race-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-race-btn') as HTMLButtonElement;
  const statusText = document.getElementById('race-status-text');

  isRacing = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (statusText) statusText.textContent = 'Race stopped';

  // Clear reconnection timeout if pending
  if (reconnectTimeoutId !== null) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  // Reset reconnection state
  reconnectAttempts = 0;
  raceConfig = null;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Close WebSocket connection
  if (ws) {
    // Only send stop message if connection is still open
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop-race' }));
    }
    ws.close();
    ws = null;
  }

  updateConnectionStatus('disconnected');
  updateWinnerDisplay();
}

function startRenderLoop(): void {
  let lastTime = performance.now();

  function render(currentTime: number): void {
    const deltaTime = currentTime - lastTime;

    // Target 30fps (33.33ms per frame)
    if (deltaTime >= 33.33) {
      updateVisualization();
      lastTime = currentTime;
    }

    if (isRacing) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  animationFrameId = requestAnimationFrame(render);
}

function updateVisualization(): void {
  const foxCanvas = document.getElementById('fox-canvas') as HTMLCanvasElement;
  const hedgehogCanvas = document.getElementById('hedgehog-canvas') as HTMLCanvasElement;

  if (foxCanvas && foxState.tokens !== undefined && foxState.capacity !== undefined) {
    renderTokenBucket(foxCanvas, foxState.tokens, foxState.capacity);
  }

  if (hedgehogCanvas && hedgehogState.queueSize !== undefined && hedgehogState.maxQueue !== undefined) {
    renderLeakyBucket(hedgehogCanvas, hedgehogState.queueSize, hedgehogState.maxQueue);
  }

  updateMetricsDisplay();
}

function updateMetricsDisplay(): void {
  // Fox metrics
  const foxTokensEl = document.getElementById('fox-tokens');
  const foxAcceptedEl = document.getElementById('fox-accepted');
  const foxRejectedEl = document.getElementById('fox-rejected');

  if (foxTokensEl) foxTokensEl.textContent = `${Math.round(foxState.tokens || 0)}/${foxState.capacity || 0}`;
  if (foxAcceptedEl) foxAcceptedEl.textContent = foxState.accepted.toString();
  if (foxRejectedEl) foxRejectedEl.textContent = foxState.rejected.toString();

  // Hedgehog metrics
  const hedgehogQueueEl = document.getElementById('hedgehog-queue');
  const hedgehogAcceptedEl = document.getElementById('hedgehog-accepted');
  const hedgehogRejectedEl = document.getElementById('hedgehog-rejected');

  if (hedgehogQueueEl) hedgehogQueueEl.textContent = `${Math.round(hedgehogState.queueSize || 0)}/${hedgehogState.maxQueue || 0}`;
  if (hedgehogAcceptedEl) hedgehogAcceptedEl.textContent = hedgehogState.accepted.toString();
  if (hedgehogRejectedEl) hedgehogRejectedEl.textContent = hedgehogState.rejected.toString();

  // Throughput percentages
  const foxTotal = foxState.accepted + foxState.rejected;
  const hedgehogTotal = hedgehogState.accepted + hedgehogState.rejected;

  const foxThroughput = foxTotal > 0 ? Math.round((foxState.accepted / foxTotal) * 100) : 0;
  const hedgehogThroughput = hedgehogTotal > 0 ? Math.round((hedgehogState.accepted / hedgehogTotal) * 100) : 0;

  const foxThroughputEl = document.getElementById('fox-throughput');
  const hedgehogThroughputEl = document.getElementById('hedgehog-throughput');

  if (foxThroughputEl) foxThroughputEl.textContent = `${foxThroughput}%`;
  if (hedgehogThroughputEl) hedgehogThroughputEl.textContent = `${hedgehogThroughput}%`;
}

function updateWinnerDisplay(): void {
  const winnerEl = document.getElementById('winner-display');
  if (!winnerEl) return;

  const foxTotal = foxState.accepted + foxState.rejected;
  const hedgehogTotal = hedgehogState.accepted + hedgehogState.rejected;

  if (foxTotal === 0 && hedgehogTotal === 0) {
    winnerEl.textContent = '—';
    return;
  }

  if (foxState.accepted > hedgehogState.accepted) {
    winnerEl.textContent = '🦊 Fox';
    winnerEl.style.color = '#646cff';
  } else if (hedgehogState.accepted > foxState.accepted) {
    winnerEl.textContent = '🦔 Hedgehog';
    winnerEl.style.color = '#42b883';
  } else {
    winnerEl.textContent = 'Tie';
    winnerEl.style.color = '#888';
  }
}

// Connection status helper functions
function updateConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
  const indicator = document.getElementById('connection-status');
  if (!indicator) return;

  indicator.className = `connection-indicator ${status}`;
  indicator.title = status === 'connected' ? 'Connected' :
                    status === 'reconnecting' ? 'Reconnecting...' :
                    status === 'error' ? 'Connection error' :
                    'Disconnected';
}

function attemptReconnect(): void {
  if (!raceConfig || !isRacing) return;

  if (reconnectAttempts >= maxReconnectAttempts) {
    const statusText = document.getElementById('race-status-text');
    if (statusText) statusText.textContent = 'Connection failed - max retries reached';
    updateConnectionStatus('error');
    handleStopRace();
    return;
  }

  const delay = reconnectDelays[Math.min(reconnectAttempts, reconnectDelays.length - 1)];
  reconnectAttempts++;

  const statusText = document.getElementById('race-status-text');
  if (statusText) statusText.textContent = `Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`;
  updateConnectionStatus('reconnecting');

  reconnectTimeoutId = window.setTimeout(() => {
    connectWebSocket(
      raceConfig!.rps,
      raceConfig!.duration,
      raceConfig!.pattern,
      raceConfig!.foxAlgorithm,
      raceConfig!.hedgehogAlgorithm
    );
  }, delay);
}

// WebSocket connection management
function connectWebSocket(rps: number, duration: number, pattern: string, foxAlgorithm: string, hedgehogAlgorithm: string): void {
  const statusText = document.getElementById('race-status-text');

  // Determine WebSocket URL based on current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/race`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (statusText) statusText.textContent = 'Connected! Starting race...';
    updateConnectionStatus('connected');
    reconnectAttempts = 0; // Reset on successful connection

    // Send race configuration with algorithm selections
    ws!.send(JSON.stringify({
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

      switch (data.type) {
        case 'connected':
          if (statusText) statusText.textContent = 'Connected';
          break;

        case 'race-started':
          if (statusText) statusText.textContent = `Racing (${data.duration}s)`;
          break;

        case 'race-frame':
          // Update state from backend
          const frame = data.frame;
          foxState = {
            tokens: frame.foxState.tokens,
            capacity: frame.foxState.capacity,
            accepted: frame.foxState.accepted,
            rejected: frame.foxState.rejected,
          };
          hedgehogState = {
            queueSize: frame.hedgehogState.queueSize,
            maxQueue: frame.hedgehogState.maxQueue,
            accepted: frame.hedgehogState.accepted,
            rejected: frame.hedgehogState.rejected,
          };
          break;

        case 'race-stopped':
          if (statusText) statusText.textContent = `Race complete! Winner: ${data.winner}`;
          handleStopRace();
          break;

        case 'error':
          console.error('WebSocket error:', data.message);
          if (statusText) statusText.textContent = `Error: ${data.message}`;
          handleStopRace();
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('error');
  };

  ws.onclose = (event) => {
    console.log('WebSocket closed:', event.code, event.reason);

    // Only attempt reconnect if race is still active and closure was unexpected
    if (isRacing && !event.wasClean) {
      if (statusText) statusText.textContent = 'Connection lost';
      updateConnectionStatus('disconnected');
      attemptReconnect();
    } else if (isRacing) {
      // Clean closure during active race (backend stopped race)
      if (statusText) statusText.textContent = 'Connection closed';
      updateConnectionStatus('disconnected');
    }
  };
}
