import { apiClient } from '../api-client';
import { addResult } from './results-display';

export function setupBurstGenerator(container: HTMLElement) {
  container.innerHTML = `
    <div class="burst-generator">
      <h2>Burst Generator</h2>
      <div class="form-group">
        <label for="request-count">Number of Requests (1-100):</label>
        <input type="number" id="request-count" min="1" max="100" value="10" />
      </div>
      <div class="form-group">
        <label for="delay">Delay Between Requests (ms, 0-1000):</label>
        <input type="number" id="delay" min="0" max="1000" value="0" />
      </div>
      <button id="fire-btn">Fire Burst</button>
      <div id="burst-status"></div>
    </div>
  `;

  const countInput = container.querySelector('#request-count') as HTMLInputElement;
  const delayInput = container.querySelector('#delay') as HTMLInputElement;
  const fireBtn = container.querySelector('#fire-btn') as HTMLButtonElement;
  const statusDiv = container.querySelector('#burst-status') as HTMLDivElement;

  fireBtn.addEventListener('click', async () => {
    fireBtn.disabled = true;
    statusDiv.textContent = 'Firing...';

    const count = parseInt(countInput.value);
    const delay = parseInt(delayInput.value);

    try {
      const results = [];

      if (delay === 0) {
        // Parallel requests
        results.push(...await Promise.all(
          Array(count).fill(null).map(() => apiClient.test())
        ));
      } else {
        // Sequential requests
        for (let i = 0; i < count; i++) {
          results.push(await apiClient.test());
          await new Promise(r => setTimeout(r, delay));
        }
      }

      results.forEach(result => addResult({
        allowed: result.allowed,
        remaining: result.remaining,
        retryAfter: result.retryAfter,
        timestamp: Date.now()
      }));
      statusDiv.textContent = `✓ Fired ${count} requests`;
      statusDiv.style.color = 'green';
    } catch (error) {
      statusDiv.textContent = `✗ Error: ${error}`;
      statusDiv.style.color = 'red';
    } finally {
      fireBtn.disabled = false;
    }
  });
}
