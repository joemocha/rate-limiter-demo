import { apiClient } from '../api-client';

export async function setupConfigPanel(container: HTMLElement) {
  container.innerHTML = `
    <div class="config-panel">
      <h2>Configuration</h2>
      <div class="form-group">
        <label for="algorithm">Algorithm:</label>
        <select id="algorithm">
          <option value="token-bucket">Token Bucket</option>
          <option value="leaky-bucket">Leaky Bucket</option>
        </select>
      </div>
      <div class="form-group">
        <label for="rps">Requests Per Second (1-1000):</label>
        <input type="number" id="rps" min="1" max="1000" value="10" />
      </div>
      <button id="apply-btn">Apply Settings</button>
      <div id="config-status"></div>
    </div>
  `;

  const algorithmSelect = container.querySelector('#algorithm') as HTMLSelectElement;
  const rpsInput = container.querySelector('#rps') as HTMLInputElement;
  const applyBtn = container.querySelector('#apply-btn') as HTMLButtonElement;
  const statusDiv = container.querySelector('#config-status') as HTMLDivElement;

  applyBtn.addEventListener('click', async () => {
    try {
      await apiClient.settings({
        algorithm: algorithmSelect.value as 'token-bucket' | 'leaky-bucket',
        rps: parseInt(rpsInput.value)
      });
      statusDiv.textContent = `✓ Configuration updated`;
      statusDiv.style.color = 'green';
    } catch (error) {
      statusDiv.textContent = `✗ Error: ${error}`;
      statusDiv.style.color = 'red';
    }
  });
}
