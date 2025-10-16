import './style.css';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// Types
interface SettingsRequest {
  algorithm: 'token-bucket' | 'leaky-bucket' | 'fixed-window' | 'sliding-window' | 'sliding-log';
  rps: number;
}

interface SettingsResponse {
  success: boolean;
  algorithm: string;
  rps: number;
}

interface TestResponseAllowed {
  allowed: true;
  remaining: number;
  resetAt: number;
}

interface TestResponseRejected {
  allowed: false;
  retryAfter: number;
}

type TestResponse = TestResponseAllowed | TestResponseRejected;

interface RateLimitHeaders {
  limit?: string;
  remaining?: string;
  reset?: string;
  retryAfter?: string;
}

interface RequestLog {
  id: number;
  timestamp: Date;
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
  headers: RateLimitHeaders;
}

// State
let currentAlgorithm: string = 'token-bucket';
let currentRPS: number = 10;
let requestLogs: RequestLog[] = [];
let requestCounter: number = 0;

// API Client
async function updateSettings(settings: SettingsRequest): Promise<SettingsResponse> {
  const response = await fetch(`${API_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update settings');
  }

  return response.json();
}

async function sendTestRequest(): Promise<{ response: TestResponse; headers: RateLimitHeaders }> {
  const response = await fetch(`${API_URL}/test`);

  const headers: RateLimitHeaders = {
    limit: response.headers.get('X-RateLimit-Limit') || undefined,
    remaining: response.headers.get('X-RateLimit-Remaining') || undefined,
    reset: response.headers.get('X-RateLimit-Reset') || undefined,
    retryAfter: response.headers.get('Retry-After') || undefined,
  };

  const data = await response.json();
  return { response: data, headers };
}

// UI Update Functions
function formatTimestamp(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function addRequestLog(log: RequestLog): void {
  requestLogs.push(log);

  // Keep only last 100 entries
  if (requestLogs.length > 100) {
    requestLogs = requestLogs.slice(-100);
  }

  updateRequestLogDisplay();
  updateStatistics();
}

function updateRequestLogDisplay(): void {
  const logContainer = document.getElementById('request-log') as HTMLDivElement;

  // Build HTML for all logs
  const logsHTML = requestLogs
    .map((log) => {
      const timestamp = formatTimestamp(log.timestamp);
      const status = log.allowed ? '✓ Allowed' : '✗ Rejected';
      const statusClass = log.allowed ? 'allowed' : 'rejected';

      let details = '';
      if (log.allowed && log.remaining !== undefined) {
        details = ` (remaining: ${log.remaining})`;
      } else if (!log.allowed && log.retryAfter !== undefined) {
        details = ` (retry in ${log.retryAfter}ms)`;
      }

      return `
        <div class="log-entry ${statusClass}">
          <span class="log-timestamp">[${timestamp}]</span>
          <span class="log-request">Request #${log.id}:</span>
          <span class="log-status">${status}</span>
          <span class="log-details">${details}</span>
        </div>
      `;
    })
    .join('');

  logContainer.innerHTML = logsHTML;

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateStatistics(): void {
  const total = requestLogs.length;
  const allowed = requestLogs.filter(log => log.allowed).length;
  const rejected = total - allowed;

  const allowedPercentage = total > 0 ? ((allowed / total) * 100).toFixed(1) : '0.0';
  const rejectedPercentage = total > 0 ? ((rejected / total) * 100).toFixed(1) : '0.0';

  // Update text statistics
  document.getElementById('stat-total')!.textContent = String(total);
  document.getElementById('stat-allowed')!.textContent = `${allowed} (${allowedPercentage}%)`;
  document.getElementById('stat-rejected')!.textContent = `${rejected} (${rejectedPercentage}%)`;

  // Update progress bar
  const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
  progressBar.innerHTML = `
    <div class="progress-allowed" style="width: ${allowedPercentage}%"></div>
    <div class="progress-rejected" style="width: ${rejectedPercentage}%"></div>
  `;
}

function updateCurrentConfig(): void {
  document.getElementById('current-algorithm')!.textContent = currentAlgorithm;
  document.getElementById('current-rps')!.textContent = String(currentRPS);
}

function showFeedback(message: string, type: 'success' | 'error'): void {
  const feedback = document.getElementById('feedback') as HTMLDivElement;
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
  feedback.style.display = 'block';

  setTimeout(() => {
    feedback.style.display = 'none';
  }, 3000);
}

// Event Handlers
async function handleApplySettings(): Promise<void> {
  const algorithmSelect = document.getElementById('algorithm') as HTMLSelectElement;
  const rpsInput = document.getElementById('rps') as HTMLInputElement;

  const algorithm = algorithmSelect.value as 'token-bucket' | 'leaky-bucket' | 'fixed-window' | 'sliding-window' | 'sliding-log';
  const rps = parseInt(rpsInput.value, 10);

  if (rps < 1 || rps > 1000) {
    showFeedback('RPS must be between 1 and 1000', 'error');
    return;
  }

  try {
    const result = await updateSettings({ algorithm, rps });
    currentAlgorithm = result.algorithm;
    currentRPS = result.rps;

    updateCurrentConfig();
    showFeedback('Settings applied successfully', 'success');
  } catch (error) {
    showFeedback(`Failed to apply settings: ${error}`, 'error');
  }
}

async function handleFireBurst(): Promise<void> {
  const requestCountInput = document.getElementById('request-count') as HTMLInputElement;
  const delayInput = document.getElementById('delay') as HTMLInputElement;
  const fireButton = document.getElementById('fire-burst') as HTMLButtonElement;

  const requestCount = parseInt(requestCountInput.value, 10);
  const delay = parseInt(delayInput.value, 10);

  if (requestCount < 1 || requestCount > 100) {
    showFeedback('Request count must be between 1 and 100', 'error');
    return;
  }

  // Disable button during burst
  fireButton.disabled = true;

  try {
    if (delay === 0) {
      // Parallel requests using Promise.all()
      const promises = Array.from({ length: requestCount }, () => sendTestRequest());
      const results = await Promise.all(promises);

      results.forEach(({ response, headers }) => {
        requestCounter++;
        addRequestLog({
          id: requestCounter,
          timestamp: new Date(),
          allowed: response.allowed,
          remaining: response.allowed ? response.remaining : undefined,
          retryAfter: !response.allowed ? response.retryAfter : undefined,
          headers,
        });
      });
    } else {
      // Sequential requests with delay
      for (let i = 0; i < requestCount; i++) {
        const { response, headers } = await sendTestRequest();

        requestCounter++;
        addRequestLog({
          id: requestCounter,
          timestamp: new Date(),
          allowed: response.allowed,
          remaining: response.allowed ? response.remaining : undefined,
          retryAfter: !response.allowed ? response.retryAfter : undefined,
          headers,
        });

        // Wait before next request (except for last one)
        if (i < requestCount - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  } catch (error) {
    showFeedback(`Failed to send requests: ${error}`, 'error');
  } finally {
    fireButton.disabled = false;
  }
}

function handleClearLogs(): void {
  requestLogs = [];
  requestCounter = 0;
  updateRequestLogDisplay();
  updateStatistics();
}

// Initialize UI
function initializeUI(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!;

  app.innerHTML = `
    <div class="container">
      <header>
        <h1>Rate Limiting Demo</h1>
        <p class="subtitle">Compare 5 Rate Limiting Algorithms</p>
      </header>

      <div class="panels">
        <!-- Configuration Panel -->
        <section class="panel config-panel">
          <h2>Configuration</h2>

          <div class="form-group">
            <label for="algorithm">Algorithm</label>
            <select id="algorithm">
              <option value="token-bucket" selected>Token Bucket</option>
              <option value="leaky-bucket">Leaky Bucket</option>
              <option value="fixed-window">Fixed Window</option>
              <option value="sliding-window">Sliding Window</option>
              <option value="sliding-log">Sliding Log</option>
            </select>
          </div>

          <div class="form-group">
            <label for="rps">Requests Per Second</label>
            <input type="number" id="rps" min="1" max="1000" value="10" />
          </div>

          <button id="apply-settings" class="btn btn-primary">Apply Settings</button>

          <div id="feedback" class="feedback" style="display: none;"></div>

          <div class="current-config">
            <h3>Current Configuration</h3>
            <p><strong>Algorithm:</strong> <span id="current-algorithm">token-bucket</span></p>
            <p><strong>RPS:</strong> <span id="current-rps">10</span></p>
          </div>
        </section>

        <!-- Burst Generator Panel -->
        <section class="panel burst-panel">
          <h2>Burst Generator</h2>

          <div class="form-group">
            <label for="request-count">Number of Requests</label>
            <input type="number" id="request-count" min="1" max="100" value="10" />
          </div>

          <div class="form-group">
            <label for="delay">Delay Between Requests (ms)</label>
            <input type="number" id="delay" min="0" max="1000" value="0" />
            <small>0 = simultaneous (Promise.all)</small>
          </div>

          <button id="fire-burst" class="btn btn-danger">Fire Burst</button>
        </section>
      </div>

      <!-- Results Display -->
      <section class="panel results-panel">
        <div class="results-header">
          <h2>Results</h2>
          <button id="clear-logs" class="btn btn-secondary">Clear Logs</button>
        </div>

        <!-- Statistics -->
        <div class="statistics">
          <div class="stat-item">
            <span class="stat-label">Total:</span>
            <span class="stat-value" id="stat-total">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Allowed:</span>
            <span class="stat-value allowed" id="stat-allowed">0 (0.0%)</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rejected:</span>
            <span class="stat-value rejected" id="stat-rejected">0 (0.0%)</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div id="progress-bar" class="progress-bar">
          <div class="progress-allowed" style="width: 0%"></div>
          <div class="progress-rejected" style="width: 0%"></div>
        </div>

        <!-- Request Log -->
        <div class="log-container">
          <h3>Request Log</h3>
          <div id="request-log" class="request-log"></div>
        </div>
      </section>
    </div>
  `;

  // Attach event listeners
  document.getElementById('apply-settings')!.addEventListener('click', handleApplySettings);
  document.getElementById('fire-burst')!.addEventListener('click', handleFireBurst);
  document.getElementById('clear-logs')!.addEventListener('click', handleClearLogs);

  // Initialize displays
  updateCurrentConfig();
  updateStatistics();
}

// Start the application
initializeUI();
