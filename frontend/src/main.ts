import './style.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9000';

// State
let statistics = {
  total: 0,
  allowed: 0,
  rejected: 0,
};

// DOM Elements
const algorithmSelect = document.querySelector<HTMLSelectElement>('#algorithm')!;
const rpsInput = document.querySelector<HTMLInputElement>('#rps')!;
const applyConfigBtn = document.querySelector<HTMLButtonElement>('#apply-config')!;
const configStatus = document.querySelector<HTMLDivElement>('#config-status')!;
const requestCountInput = document.querySelector<HTMLInputElement>('#request-count')!;
const requestDelayInput = document.querySelector<HTMLInputElement>('#request-delay')!;
const fireBurstBtn = document.querySelector<HTMLButtonElement>('#fire-burst')!;
const requestLog = document.querySelector<HTMLDivElement>('#request-log')!;

// Apply Configuration
applyConfigBtn.addEventListener('click', async () => {
  const algorithm = algorithmSelect.value;
  const rps = parseInt(rpsInput.value);

  try {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm, rps }),
    });

    const data = await response.json();
    if (response.ok) {
      configStatus.textContent = `✓ Applied: ${data.algorithm} @ ${data.rps} RPS`;
      configStatus.className = 'success';
    } else {
      configStatus.textContent = `✗ Error: ${data.error}`;
      configStatus.className = 'error';
    }
  } catch (error) {
    configStatus.textContent = `✗ Network error`;
    configStatus.className = 'error';
  }
});

// Fire Burst
fireBurstBtn.addEventListener('click', async () => {
  const count = parseInt(requestCountInput.value);
  const delay = parseInt(requestDelayInput.value);

  fireBurstBtn.disabled = true;
  clearLog();
  resetStatistics();

  if (delay === 0) {
    // Parallel requests
    const promises = Array.from({ length: count }, (_, i) =>
      testRequest(i + 1)
    );
    await Promise.all(promises);
  } else {
    // Sequential requests with delay
    for (let i = 0; i < count; i++) {
      await testRequest(i + 1);
      if (i < count - 1) {
        await sleep(delay);
      }
    }
  }

  fireBurstBtn.disabled = false;
});

async function testRequest(requestNum: number): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/test`);
    const data = await response.json();
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    if (data.allowed) {
      logRequest(
        `[${timestamp}] Request #${requestNum}: ✓ Allowed (remaining: ${data.remaining})`,
        'allowed'
      );
      updateStatistics('allowed');
    } else {
      logRequest(
        `[${timestamp}] Request #${requestNum}: ✗ Rejected (retry in ${data.retryAfter}ms)`,
        'rejected'
      );
      updateStatistics('rejected');
    }
  } catch (error) {
    logRequest(`Request #${requestNum}: Network error`, 'error');
  }
}

function logRequest(message: string, type: 'allowed' | 'rejected' | 'error'): void {
  const entry = document.createElement('div');
  entry.textContent = message;
  entry.className = `log-entry ${type}`;
  requestLog.insertBefore(entry, requestLog.firstChild);

  // Keep only last 100 entries
  while (requestLog.children.length > 100) {
    requestLog.removeChild(requestLog.lastChild!);
  }
}

function updateStatistics(result: 'allowed' | 'rejected'): void {
  statistics.total++;
  statistics[result]++;
  updateStatisticsDisplay();
}

function updateStatisticsDisplay(): void {
  // Update DOM
  document.querySelector('#stat-total')!.textContent = statistics.total.toString();
  document.querySelector('#stat-allowed')!.textContent = statistics.allowed.toString();
  document.querySelector('#stat-rejected')!.textContent = statistics.rejected.toString();

  const allowedPct = statistics.total > 0 ? (statistics.allowed / statistics.total * 100).toFixed(1) : '0';
  const rejectedPct = statistics.total > 0 ? (statistics.rejected / statistics.total * 100).toFixed(1) : '0';

  document.querySelector('#stat-allowed-pct')!.textContent = `${allowedPct}%`;
  document.querySelector('#stat-rejected-pct')!.textContent = `${rejectedPct}%`;

  // Update progress bar
  const progressAllowed = document.querySelector<HTMLDivElement>('#progress-allowed')!;
  const progressRejected = document.querySelector<HTMLDivElement>('#progress-rejected')!;

  progressAllowed.style.width = `${allowedPct}%`;
  progressRejected.style.width = `${rejectedPct}%`;
}

function resetStatistics(): void {
  statistics = { total: 0, allowed: 0, rejected: 0 };
  updateStatisticsDisplay(); // Update UI without incrementing counts
}

function clearLog(): void {
  requestLog.innerHTML = '';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize on load
window.addEventListener('DOMContentLoaded', async () => {
  // Fetch initial health status
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    algorithmSelect.value = data.algorithm;
    rpsInput.value = data.rps.toString();
    configStatus.textContent = `Connected: ${data.algorithm} @ ${data.rps} RPS`;
    configStatus.className = 'success';
  } catch (error) {
    configStatus.textContent = 'Cannot connect to backend';
    configStatus.className = 'error';
  }
});