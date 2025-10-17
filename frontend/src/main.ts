import './style.css'
import typescriptLogo from './typescript.svg'
import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://bun.sh" target="_blank">
      <img src="https://bun.sh/logo.svg" class="logo" alt="Bun logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Fox vs. Hedgehog Rate Limiting</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Powered by Bun + TypeScript (zero framework dependencies)
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
