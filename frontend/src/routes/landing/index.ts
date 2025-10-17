import './style.css';

export function renderLanding(): string {
  return `
    <div class="landing-container">
      <header class="landing-header">
        <h1>Fox vs. Hedgehog Rate Limiting</h1>
        <p class="subtitle">Choose Your Path</p>
      </header>

      <div class="mode-selection">
        <div class="mode-card">
          <div class="mode-icon">🦊</div>
          <h2>Algorithm Explorer</h2>
          <p class="mode-philosophy">"The Fox knows many things..."</p>
          <ul class="mode-features">
            <li>Single Algorithm</li>
            <li>Detailed Analysis</li>
            <li>Parameter Tuning</li>
          </ul>
          <a href="/explorer" data-route="/explorer" class="mode-button">Enter Explorer →</a>
        </div>

        <div class="mode-card">
          <div class="mode-icon">🦔</div>
          <h2>Algorithm Arena</h2>
          <p class="mode-philosophy">"The Hedgehog knows one big thing..."</p>
          <ul class="mode-features">
            <li>Dual Racing</li>
            <li>Visual Compare</li>
            <li>Live Metrics</li>
          </ul>
          <a href="/arena" data-route="/arena" class="mode-button">Enter Arena →</a>
        </div>
      </div>

      <footer class="landing-footer">
        <p>Powered by Bun + TypeScript (zero framework dependencies)</p>
      </footer>
    </div>
  `;
}

export function mountLanding(): void {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = renderLanding();
  }
}
