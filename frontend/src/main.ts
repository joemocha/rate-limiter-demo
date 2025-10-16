import './style.css'
import { setupConfigPanel } from './components/config-panel'
import { setupBurstGenerator } from './components/burst-generator'
import { setupResultsDisplay } from './components/results-display'

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="rate-limiting-demo">
    <h1>Fox vs. Hedgehog: Rate Limiting Demo</h1>
    <div id="config-panel"></div>
    <div id="burst-generator"></div>
    <div id="results-display"></div>
  </div>
`;

setupConfigPanel(document.querySelector('#config-panel')!)
setupBurstGenerator(document.querySelector('#burst-generator')!)
setupResultsDisplay(document.querySelector('#results-display')!)
