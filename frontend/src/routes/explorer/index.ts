import { configService } from '../../shared/config-service';
import type { TestResponse } from '../../shared/types';
import './style.css';

interface RequestLog {
  id: number;
  timestamp: string;
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

let requestLogs: RequestLog[] = [];
let requestIdCounter = 0;
let totalRequests = 0;
let allowedRequests = 0;
let rejectedRequests = 0;

export function renderExplorer(): string {
  return `
    <div class="explorer-container">
      <header class="explorer-header">
        <a href="/" data-route="/" class="back-link">← Back to Landing</a>
        <h1>🦊 Algorithm Explorer</h1>
      </header>

      <div class="explorer-layout">
        <aside class="config-panel">
          <h2>Configuration</h2>

          <div class="form-group">
            <label for="algorithm-select">Algorithm</label>
            <select id="algorithm-select" class="form-control">
              <option value="token-bucket">Token Bucket</option>
              <option value="leaky-bucket">Leaky Bucket</option>
            </select>
          </div>

          <div class="form-group">
            <label for="rps-input">Requests Per Second</label>
            <input
              type="number"
              id="rps-input"
              class="form-control"
              min="1"
              max="1000"
              value="10"
            />
          </div>

          <button id="apply-settings-btn" class="btn btn-primary">Apply Settings</button>

          <div id="settings-feedback" class="feedback"></div>

          <div class="current-config">
            <h3>Current Settings</h3>
            <div id="current-algorithm">Algorithm: Token Bucket</div>
            <div id="current-rps">RPS: 10</div>
          </div>
        </aside>

        <main class="test-panel">
          <div class="burst-generator">
            <h2>Burst Generator</h2>

            <div class="burst-controls">
              <div class="form-group">
                <label for="request-count">Number of Requests</label>
                <input
                  type="number"
                  id="request-count"
                  class="form-control"
                  min="1"
                  max="100"
                  value="10"
                />
              </div>

              <div class="form-group">
                <label for="request-delay">Delay Between Requests (ms)</label>
                <input
                  type="number"
                  id="request-delay"
                  class="form-control"
                  min="0"
                  max="1000"
                  value="0"
                />
              </div>

              <button id="fire-burst-btn" class="btn btn-secondary">🚀 Fire Burst</button>
              <button id="reset-btn" class="btn btn-sm">Reset Rate Limiter</button>
            </div>
          </div>

          <div class="results-section">
            <div class="stats-summary">
              <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div id="total-requests" class="stat-value">0</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Allowed</div>
                <div id="allowed-count" class="stat-value success">0 (0%)</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Rejected</div>
                <div id="rejected-count" class="stat-value error">0 (0%)</div>
              </div>
            </div>

            <div class="visual-indicator">
              <div class="progress-bar">
                <div id="allowed-bar" class="progress-segment success" style="width: 0%"></div>
                <div id="rejected-bar" class="progress-segment error" style="width: 0%"></div>
              </div>
            </div>

            <div class="request-log">
              <h3>Request Log</h3>
              <button id="clear-log-btn" class="btn btn-sm">Clear Log</button>
              <div id="log-container" class="log-entries"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;
}

export function mountExplorer(): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderExplorer();
    attachEventListeners();
    loadCurrentConfig();
  }
}

function attachEventListeners(): void {
  // Apply settings
  const applyBtn = document.getElementById('apply-settings-btn');
  applyBtn?.addEventListener('click', handleApplySettings);

  // Fire burst
  const fireBurstBtn = document.getElementById('fire-burst-btn');
  fireBurstBtn?.addEventListener('click', handleFireBurst);

  // Reset rate limiter
  const resetBtn = document.getElementById('reset-btn');
  resetBtn?.addEventListener('click', handleReset);

  // Clear log
  const clearLogBtn = document.getElementById('clear-log-btn');
  clearLogBtn?.addEventListener('click', handleClearLog);
}

function loadCurrentConfig(): void {
  const config = configService.getConfig();

  const algorithmSelect = document.getElementById('algorithm-select') as HTMLSelectElement;
  const rpsInput = document.getElementById('rps-input') as HTMLInputElement;

  if (algorithmSelect) {
    algorithmSelect.value = config.primaryAlgorithm;
  }

  if (rpsInput) {
    rpsInput.value = config.rps.toString();
  }

  updateCurrentConfigDisplay(config.primaryAlgorithm, config.rps);
}

async function handleApplySettings(): Promise<void> {
  const algorithmSelect = document.getElementById('algorithm-select') as HTMLSelectElement;
  const rpsInput = document.getElementById('rps-input') as HTMLInputElement;

  const algorithm = algorithmSelect.value as 'token-bucket' | 'leaky-bucket';
  const rps = parseInt(rpsInput.value, 10);

  if (rps < 1 || rps > 1000) {
    showFeedback('RPS must be between 1 and 1000', 'error');
    return;
  }

  try {
    const response = await fetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, rps }),
    });

    const data = await response.json();

    if (data.success) {
      configService.updatePrimaryAlgorithm(algorithm);
      configService.updateRPS(rps);
      updateCurrentConfigDisplay(algorithm, rps);
      showFeedback('Settings applied successfully!', 'success');
    } else {
      showFeedback('Failed to apply settings', 'error');
    }
  } catch (error) {
    showFeedback('Network error: Could not apply settings', 'error');
  }
}

async function handleFireBurst(): Promise<void> {
  const countInput = document.getElementById('request-count') as HTMLInputElement;
  const delayInput = document.getElementById('request-delay') as HTMLInputElement;
  const fireBurstBtn = document.getElementById('fire-burst-btn') as HTMLButtonElement;

  const count = parseInt(countInput.value, 10);
  const delay = parseInt(delayInput.value, 10);

  if (count < 1 || count > 100) {
    showFeedback('Request count must be between 1 and 100', 'error');
    return;
  }

  // Disable button during burst
  fireBurstBtn.disabled = true;
  fireBurstBtn.textContent = 'Firing...';

  if (delay === 0) {
    // Parallel burst
    const promises = Array.from({ length: count }, () => sendTestRequest());
    await Promise.all(promises);
  } else {
    // Sequential burst with delay
    for (let i = 0; i < count; i++) {
      await sendTestRequest();
      if (i < count - 1) {
        await sleep(delay);
      }
    }
  }

  // Re-enable button
  fireBurstBtn.disabled = false;
  fireBurstBtn.textContent = '🚀 Fire Burst';
}

async function sendTestRequest(): Promise<void> {
  try {
    const response = await fetch('/test');
    const data: TestResponse = await response.json();

    logRequest(data);
    updateStats(data.allowed);
  } catch (error) {
    console.error('Test request failed:', error);
  }
}

async function handleReset(): Promise<void> {
  try {
    await fetch('/reset', { method: 'POST' });
    showFeedback('Rate limiter reset successfully', 'success');
  } catch (error) {
    showFeedback('Failed to reset rate limiter', 'error');
  }
}

function handleClearLog(): void {
  requestLogs = [];
  totalRequests = 0;
  allowedRequests = 0;
  rejectedRequests = 0;

  updateLogDisplay();
  updateStatsDisplay();
}

function logRequest(response: TestResponse): void {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

  const log: RequestLog = {
    id: ++requestIdCounter,
    timestamp,
    allowed: response.allowed,
    remaining: response.remaining,
    retryAfter: response.retryAfter,
  };

  requestLogs.unshift(log); // Add to front

  // Keep only last 100 entries
  if (requestLogs.length > 100) {
    requestLogs = requestLogs.slice(0, 100);
  }

  updateLogDisplay();
}

function updateLogDisplay(): void {
  const container = document.getElementById('log-container');
  if (!container) return;

  if (requestLogs.length === 0) {
    container.innerHTML = '<div class="log-empty">No requests yet. Fire a burst to see results.</div>';
    return;
  }

  container.innerHTML = requestLogs.map(log => {
    const statusClass = log.allowed ? 'success' : 'error';
    const statusIcon = log.allowed ? '✓' : '✗';
    const details = log.allowed
      ? `(remaining: ${log.remaining})`
      : `(retry in ${log.retryAfter}ms)`;

    return `
      <div class="log-entry ${statusClass}">
        <span class="log-timestamp">[${log.timestamp}]</span>
        <span class="log-status">${statusIcon}</span>
        <span class="log-details">Request #${log.id}: ${log.allowed ? 'Allowed' : 'Rejected'} ${details}</span>
      </div>
    `;
  }).join('');

  // Auto-scroll to top (latest entry)
  container.scrollTop = 0;
}

function updateStats(allowed: boolean): void {
  totalRequests++;
  if (allowed) {
    allowedRequests++;
  } else {
    rejectedRequests++;
  }

  updateStatsDisplay();
}

function updateStatsDisplay(): void {
  const allowedPercent = totalRequests > 0 ? Math.round((allowedRequests / totalRequests) * 100) : 0;
  const rejectedPercent = totalRequests > 0 ? Math.round((rejectedRequests / totalRequests) * 100) : 0;

  const totalEl = document.getElementById('total-requests');
  const allowedEl = document.getElementById('allowed-count');
  const rejectedEl = document.getElementById('rejected-count');
  const allowedBar = document.getElementById('allowed-bar');
  const rejectedBar = document.getElementById('rejected-bar');

  if (totalEl) totalEl.textContent = totalRequests.toString();
  if (allowedEl) allowedEl.textContent = `${allowedRequests} (${allowedPercent}%)`;
  if (rejectedEl) rejectedEl.textContent = `${rejectedRequests} (${rejectedPercent}%)`;
  if (allowedBar) allowedBar.style.width = `${allowedPercent}%`;
  if (rejectedBar) rejectedBar.style.width = `${rejectedPercent}%`;
}

function updateCurrentConfigDisplay(algorithm: string, rps: number): void {
  const algorithmEl = document.getElementById('current-algorithm');
  const rpsEl = document.getElementById('current-rps');

  const algorithmName = algorithm === 'token-bucket' ? 'Token Bucket' : 'Leaky Bucket';

  if (algorithmEl) algorithmEl.textContent = `Algorithm: ${algorithmName}`;
  if (rpsEl) rpsEl.textContent = `RPS: ${rps}`;
}

function showFeedback(message: string, type: 'success' | 'error'): void {
  const feedback = document.getElementById('settings-feedback');
  if (!feedback) return;

  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
  feedback.style.display = 'block';

  setTimeout(() => {
    feedback.style.display = 'none';
  }, 3000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
