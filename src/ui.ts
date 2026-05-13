import { DEBUG_MENU_ENABLED } from './config'

export function createAppMarkup(): string {
  const debugMarkup = DEBUG_MENU_ENABLED
    ? `
        <details class="debug-menu" id="debug-menu" open>
          <summary>Debug Menu</summary>
          <div class="debug-body">
            <label class="debug-label" for="debug-problem-select">Select problem</label>
            <select class="debug-select" id="debug-problem-select" aria-label="Select a debug problem"></select>
            <button class="btn debug-btn" id="btn-debug-load" type="button">Load Selected Problem</button>
            <div class="debug-problem-list" id="debug-problem-list"></div>
          </div>
        </details>
      `
    : ''

  return `
    <div class="app-shell">
      <div id="loading" class="loading-screen">
        <div class="loading-card">
          <div class="loading-title">Typst<sub class="logo-subtle">erity</sub></div>
          <div class="loading-status" id="load-msg">Loading Typst compiler…</div>
        </div>
      </div>

      <main class="wrap">
        <section id="screen-start" class="screen start-screen">
          <div class="logo">Typst<sub class="logo-subtle">erity</sub></div>
          <div class="tagline">A Typst Typesetting Game</div>
          <p class="desc">
            A rendered formula appears. Write the Typst math source that produces it.
            Type as many as you can in three minutes, or play untimed.
          </p>

          <div class="btn-row">
            <button class="btn sel" id="btn-timed" type="button">Timed Game</button>
            <button class="btn" id="btn-zen" type="button">Zen Mode</button>
          </div>

          <button class="btn primary" id="btn-start" type="button">Start</button>

          <div class="hints">
            <strong>Hints:</strong>
            <ul>
              <li>Write pure Typst math. No <code>$</code> signs needed.</li>
              <li>All formulas are in display mode.</li>
              <li>Any Typst that produces the same visual output is accepted.</li>
              <li>Get it right and you will automatically move to the next equation.</li>
              <li>Harder problems are worth more points.</li>
              <li>
                Use
                <a href="https://detypify.quarticcat.com" target="_blank" rel="noreferrer">
                  Detypify
                </a>
                to identify unknown symbols.
              </li>
            </ul>
            <div class="site-credit" id="site-credit">
              <small>Inspired by <a href="https://texnique.xyz/" target="_blank" rel="noreferrer noopener">Texnique</a></small>
            </div>
          </div>
        </section>

        <section id="screen-game" class="screen game-screen" hidden>
          <div class="game-top">
            <div class="score-el"><span class="score-label">Score:</span> <span id="score-val">0</span></div>
            <div class="right-top">
              <span class="points-pill points-tier-low" id="points-badge">0 pts</span>
              <div class="timer-el" id="timer-val">3:00</div>
            </div>
          </div>

          <div class="problem-head">
            <div class="problem-kicker">Current Problem</div>
            <div class="problem-name" id="problem-name">Loading problem…</div>
          </div>

          <div class="sec-label">Target</div>
          <div class="formula-box play-formula-box" id="target-box">
            <span class="ph">loading…</span>
          </div>

          <div class="output-head" id="output-head">
            <div class="sec-label output-label">Your output</div>
            <label class="shadow-toggle" for="shadow-toggle">
              <input id="shadow-toggle" type="checkbox" />
              <span>show shadow</span>
            </label>
          </div>
          <div class="formula-box play-formula-box output-compare-box" id="yours-box">
            <div class="formula-layer formula-shadow-layer" id="yours-shadow" aria-hidden="true"></div>
            <div class="formula-layer formula-user-layer" id="yours-render">
              <span class="ph">start typing below…</span>
            </div>
          </div>
          <div class="sec-label" id="solution-label" hidden>Solution</div>
          <div class="solution-panel" id="solution-panel" hidden>
            <textarea
              class="code-input solution-code"
              id="solution-code"
              rows="1"
              spellcheck="false"
              readonly
              aria-label="Correct Typst math source"
            ></textarea>
          </div>

          <div class="sec-label">Your code</div>
          <textarea
            class="code-input"
            id="code-input"
            rows="2"
            placeholder="type Typst math here…"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            aria-label="Type Typst math source"
          ></textarea>

          <div id="match-status" class="match-status" aria-live="polite"></div>

          <div class="bottom-row">
            <button class="skip-link action-link" id="btn-end" type="button">end game</button>
            <button class="skip-link action-link" id="btn-solution" type="button">show solution</button>
            <button class="skip-link action-link" id="btn-skip" type="button">skip</button>
          </div>
        </section>

        <section id="screen-end" class="screen end-screen" hidden>
          <div class="final-num" id="final-num">0</div>
          <div class="end-sub">points</div>

          <div class="stats-row">
            <div class="stat-box">
              <div class="stat-number" id="s-correct">0</div>
              <div class="stat-label">correct</div>
            </div>
            <div class="stat-box">
              <div class="stat-number" id="s-skipped">0</div>
              <div class="stat-label">skipped</div>
            </div>
            <div class="stat-box">
              <div class="stat-number" id="s-streak">0</div>
              <div class="stat-label">best streak</div>
            </div>
          </div>

          <div class="review" id="review-list"></div>

          <div class="btn-row">
            <button class="btn" id="btn-restart" type="button">Play Again</button>
          </div>
        </section>

        ${debugMarkup}
      </main>
    </div>
  `
}
