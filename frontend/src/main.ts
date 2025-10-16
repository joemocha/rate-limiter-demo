import "./style.css";

// Configuration
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9000";
const MAX_LOG_ENTRIES = 100;

// State
interface RequestStats {
  total: number;
  allowed: number;
  rejected: number;
}

const stats: RequestStats = {
  total: 0,
  allowed: 0,
  rejected: 0,
};

// DOM Elements
const algorithmSelect = document.getElementById(
  "algorithm"
) as HTMLSelectElement;
const rpsInput = document.getElementById("rps") as HTMLInputElement;
const applyBtn = document.getElementById("apply-btn") as HTMLButtonElement;
const statusMessage = document.getElementById("status-message") as HTMLElement;

const requestCountInput = document.getElementById(
  "request-count"
) as HTMLInputElement;
const requestDelayInput = document.getElementById(
  "request-delay"
) as HTMLInputElement;
const fireBtn = document.getElementById("fire-btn") as HTMLButtonElement;

const statTotal = document.getElementById("stat-total") as HTMLElement;
const statAllowed = document.getElementById("stat-allowed") as HTMLElement;
const statRejected = document.getElementById("stat-rejected") as HTMLElement;
const statRate = document.getElementById("stat-rate") as HTMLElement;

const progressAllowed = document.getElementById(
  "progress-allowed"
) as HTMLElement;
const progressRejected = document.getElementById(
  "progress-rejected"
) as HTMLElement;

const requestLog = document.getElementById("request-log") as HTMLElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const clearLogBtn = document.getElementById("clear-log-btn") as HTMLButtonElement;

const currentAlgoSpan = document.getElementById(
  "current-algo"
) as HTMLElement;
const currentRpsSpan = document.getElementById("current-rps") as HTMLElement;

// Utilities
function getTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function formatTimestamp(ts: string): string {
  return `[${ts}]`;
}

function updateStats() {
  statTotal.textContent = stats.total.toString();
  statAllowed.textContent = stats.allowed.toString();
  statRejected.textContent = stats.rejected.toString();

  const rate =
    stats.total === 0 ? 0 : Math.round((stats.allowed / stats.total) * 100);
  statRate.textContent = `${rate}%`;

  // Update progress bar
  const total = stats.total || 1;
  const allowedPercent = (stats.allowed / total) * 100;
  const rejectedPercent = (stats.rejected / total) * 100;

  progressAllowed.style.width = `${allowedPercent}%`;
  progressRejected.style.width = `${rejectedPercent}%`;
}

function addLogEntry(
  requestNum: number,
  allowed: boolean,
  info: string
): void {
  // Remove placeholder if exists
  const placeholder = requestLog.querySelector(".placeholder");
  if (placeholder) {
    placeholder.remove();
  }

  const entry = document.createElement("div");
  entry.className = `log-entry ${allowed ? "allowed" : "rejected"}`;

  const statusIcon = allowed ? "✓" : "✗";
  const statusText = allowed ? "Allowed" : "Rejected";
  const detailText = allowed
    ? `(${info})`
    : `(retry in ${info})`;

  entry.innerHTML = `
    <span class="timestamp">${formatTimestamp(getTimestamp())}</span>
    <span class="request-num">Request #${requestNum}</span>
    <span class="status-icon">${statusIcon}</span>
    <span class="status-text">${statusText}</span>
    <span class="details">${detailText}</span>
  `;

  requestLog.insertBefore(entry, requestLog.firstChild);

  // Keep only max entries
  while (requestLog.children.length > MAX_LOG_ENTRIES) {
    requestLog.removeChild(requestLog.lastChild!);
  }
}

async function fireRequest(requestNum: number): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/test`);
    const data = await response.json();

    stats.total++;

    if (response.status === 200 && data.allowed) {
      stats.allowed++;
      const remaining = data.remaining || 0;
      addLogEntry(requestNum, true, `remaining: ${remaining}`);
    } else if (response.status === 429) {
      stats.rejected++;
      const retryAfter = data.retryAfter || 0;
      addLogEntry(requestNum, false, `${retryAfter}ms`);
    }

    updateStats();
  } catch (error) {
    console.error("Request error:", error);
    stats.total++;
    stats.rejected++;
    addLogEntry(requestNum, false, "error");
    updateStats();
  }
}

async function fireBurst(): Promise<void> {
  const count = parseInt(requestCountInput.value, 10);
  const delay = parseInt(requestDelayInput.value, 10);

  fireBtn.disabled = true;
  fireBtn.textContent = "Firing...";

  try {
    if (delay === 0) {
      // Fire all in parallel
      const promises = [];
      for (let i = 1; i <= count; i++) {
        promises.push(fireRequest(stats.total + i));
      }
      await Promise.all(promises);
    } else {
      // Fire sequentially with delay
      for (let i = 1; i <= count; i++) {
        await fireRequest(stats.total + i);
        if (i < count) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  } finally {
    fireBtn.disabled = false;
    fireBtn.textContent = "Fire Burst";
  }
}

async function applySettings(): Promise<void> {
  const algorithm = algorithmSelect.value;
  const rps = parseInt(rpsInput.value, 10);

  if (rps < 1 || rps > 1000) {
    statusMessage.className = "status-message error";
    statusMessage.textContent = "RPS must be between 1 and 1000";
    return;
  }

  applyBtn.disabled = true;
  statusMessage.className = "status-message loading";
  statusMessage.textContent = "Applying settings...";

  try {
    const response = await fetch(`${API_URL}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ algorithm, rps }),
    });

    if (response.status === 200) {
      const data = await response.json();
      if (data.success) {
        statusMessage.className = "status-message success";
        statusMessage.textContent = "✓ Settings applied";
        currentAlgoSpan.textContent = algorithm;
        currentRpsSpan.textContent = rps.toString();

        // Clear timeout for message
        setTimeout(() => {
          statusMessage.textContent = "";
          statusMessage.className = "status-message";
        }, 3000);
      } else {
        throw new Error("Invalid response from server");
      }
    } else {
      statusMessage.className = "status-message error";
      statusMessage.textContent = "Failed to apply settings";
    }
  } catch (error) {
    console.error("Error applying settings:", error);
    statusMessage.className = "status-message error";
    statusMessage.textContent = "Error applying settings";
  } finally {
    applyBtn.disabled = false;
  }
}

async function resetLimiter(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/reset`, {
      method: "POST",
    });

    if (response.status === 204 || response.ok) {
      statusMessage.className = "status-message success";
      statusMessage.textContent = "✓ Rate limiter reset";

      setTimeout(() => {
        statusMessage.textContent = "";
        statusMessage.className = "status-message";
      }, 2000);
    } else {
      throw new Error("Reset failed");
    }
  } catch (error) {
    console.error("Error resetting limiter:", error);
    statusMessage.className = "status-message error";
    statusMessage.textContent = "Error resetting limiter";
  }
}

function clearLog(): void {
  stats.total = 0;
  stats.allowed = 0;
  stats.rejected = 0;

  requestLog.innerHTML = `
    <p class="placeholder">No requests yet. Fire a burst to see results.</p>
  `;

  updateStats();
}

// Event Listeners
applyBtn.addEventListener("click", applySettings);
fireBtn.addEventListener("click", fireBurst);
resetBtn.addEventListener("click", resetLimiter);
clearLogBtn.addEventListener("click", clearLog);

// Initialize
console.log("Rate Limiting Demo loaded");
console.log(`API URL: ${API_URL}`);
updateStats();
