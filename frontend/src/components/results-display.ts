interface Result {
  timestamp: number;
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
}

let results: Result[] = [];

export function setupResultsDisplay(container: HTMLElement) {
  container.innerHTML = `
    <div class="results-display">
      <h2>Results</h2>
      <div id="statistics">
        <div>Total: <span id="stat-total">0</span></div>
        <div>Allowed: <span id="stat-allowed">0</span> (<span id="stat-allowed-pct">0</span>%)</div>
        <div>Rejected: <span id="stat-rejected">0</span> (<span id="stat-rejected-pct">0</span>%)</div>
      </div>
      <div id="visual-indicator">
        <div class="indicator-bar">
          <div class="allowed-segment" style="width: 0%"></div>
          <div class="rejected-segment" style="width: 0%"></div>
        </div>
      </div>
      <div id="request-log"></div>
    </div>
  `;

  updateDisplay();
}

export function addResult(result: Result) {
  results.push({
    ...result,
    timestamp: Date.now()
  });

  // Keep only last 100
  if (results.length > 100) {
    results.shift();
  }

  updateDisplay();
}

function updateDisplay() {
  const total = results.length;
  const allowed = results.filter(r => r.allowed).length;
  const rejected = total - allowed;
  const allowedPct = total > 0 ? Math.round((allowed / total) * 100) : 0;
  const rejectedPct = 100 - allowedPct;

  document.querySelector('#stat-total')!.textContent = String(total);
  document.querySelector('#stat-allowed')!.textContent = String(allowed);
  document.querySelector('#stat-allowed-pct')!.textContent = String(allowedPct);
  document.querySelector('#stat-rejected')!.textContent = String(rejected);
  document.querySelector('#stat-rejected-pct')!.textContent = String(rejectedPct);

  const allowedSegment = document.querySelector('.allowed-segment') as HTMLElement;
  const rejectedSegment = document.querySelector('.rejected-segment') as HTMLElement;
  allowedSegment.style.width = `${allowedPct}%`;
  rejectedSegment.style.width = `${rejectedPct}%`;

  const logContainer = document.querySelector('#request-log')!;
  logContainer.innerHTML = results.slice().reverse().map((r, i) => {
    const time = new Date(r.timestamp).toLocaleTimeString();
    const status = r.allowed
      ? `✓ Allowed (remaining: ${r.remaining})`
      : `✗ Rejected (retry in ${r.retryAfter}ms)`;
    const className = r.allowed ? 'allowed' : 'rejected';
    return `<div class="log-entry ${className}">[${time}] Request #${total - i}: ${status}</div>`;
  }).join('');
}
