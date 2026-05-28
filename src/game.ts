import { DEBUG_MENU_ENABLED } from './config'
import { PROBLEMS } from './problems'
import { initializeTypst, renderFormula } from './typst'
import type { GameMode, HistoryEntry, Problem, RenderResult, WrongStats } from './types'

interface GameElements {
  loading: HTMLDivElement
  loadMessage: HTMLDivElement
  startScreen: HTMLElement
  gameScreen: HTMLElement
  endScreen: HTMLElement
  practiceMissedShell: HTMLElement
  practiceMissedMenu: HTMLDetailsElement
  timedButton: HTMLButtonElement
  zenButton: HTMLButtonElement
  startButton: HTMLButtonElement
  restartButton: HTMLButtonElement
  practiceMissedPanel: HTMLDivElement
  practiceMissedSection: HTMLDivElement
  practiceMissedEndButton: HTMLButtonElement
  skipButton: HTMLButtonElement
  endButton: HTMLButtonElement
  showSolutionButton: HTMLButtonElement
  debugProblemSelect: HTMLSelectElement | null
  debugLoadButton: HTMLButtonElement | null
  debugProblemList: HTMLDivElement | null
  scoreValue: HTMLSpanElement
  pointsBadge: HTMLSpanElement
  timerValue: HTMLDivElement
  problemName: HTMLDivElement
  targetBox: HTMLDivElement
  outputHead: HTMLDivElement
  yoursBox: HTMLDivElement
  solutionLabel: HTMLDivElement
  solutionPanel: HTMLDivElement
  solutionCode: HTMLTextAreaElement
  shadowToggle: HTMLInputElement
  yoursShadow: HTMLDivElement
  yoursRender: HTMLDivElement
  codeInput: HTMLTextAreaElement
  matchStatus: HTMLDivElement
  finalScore: HTMLDivElement
  timeSpentValue: HTMLDivElement
  highScoreValue: HTMLSpanElement
  correctValue: HTMLDivElement
  skippedValue: HTMLDivElement
  streakValue: HTMLDivElement
  reviewList: HTMLDivElement
}

interface HighScores {
  timed: number
  zen: number
}

const HIGH_SCORE_STORAGE_KEY = 'typsternity.high-scores.v1'
const WRONG_STATS_STORAGE_KEY = 'typsternity.wrong-stats.v1'
const MAX_PRACTICE_APPEARANCES = 3
const VALID_PROBLEM_NAMES = new Set(PROBLEMS.map(problem => problem.name))

function getRequiredElement<TElement extends HTMLElement>(
  root: ParentNode,
  selector: string,
): TElement {
  const element = root.querySelector<TElement>(selector)

  if (!element) {
    throw new Error(`Could not find required element: ${selector}`)
  }

  return element
}

function shuffle<TValue>(values: TValue[]): TValue[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
      ;[values[index], values[randomIndex]] = [values[randomIndex], values[index]]
  }

  return values
}

function normalizeSvg(svg: string): string {
  return svg
    .replace(/id="[^"]*"/g, '')
    .replace(/clip-path="url\([^)]*\)"/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getPointsTierClass(points: number): string {
  if (points <= 20) {
    return 'points-tier-low'
  }

  if (points <= 32) {
    return 'points-tier-mid'
  }

  return 'points-tier-high'
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export class TypsternityGame {
  private readonly elements: GameElements

  private mode: GameMode = 'timed'
  private timerId: number | null = null
  private inputDebounceId: number | null = null
  private advanceTimeoutId: number | null = null
  private timeLeft = 180
  private sessionStartedAt: number | null = null
  private score = 0
  private correct = 0
  private skippedCount = 0
  private streak = 0
  private bestStreak = 0
  private queue: Problem[] = []
  private current: Problem | null = null
  private history: HistoryEntry[] = []
  private targetResult: RenderResult | null = null
  private userResult: RenderResult | null = null
  private reviewRenderId = 0
  private shadowEnabled = false
  private solutionVisible = false
  private inputGeneration = 0
  // Track whether we have a confirmed match, so timer-end doesn't lose it
  private pendingCorrect = false
  private isPracticeMissedMode = false
  private practiceAppearances = new Map<string, number>()

  constructor(root: HTMLElement) {
    this.elements = {
      loading: getRequiredElement<HTMLDivElement>(root, '#loading'),
      loadMessage: getRequiredElement<HTMLDivElement>(root, '#load-msg'),
      startScreen: getRequiredElement<HTMLElement>(root, '#screen-start'),
      gameScreen: getRequiredElement<HTMLElement>(root, '#screen-game'),
      endScreen: getRequiredElement<HTMLElement>(root, '#screen-end'),
      practiceMissedShell: getRequiredElement<HTMLElement>(root, '#practice-missed-shell'),
      practiceMissedMenu: getRequiredElement<HTMLDetailsElement>(root, '#practice-missed-menu'),
      timedButton: getRequiredElement<HTMLButtonElement>(root, '#btn-timed'),
      zenButton: getRequiredElement<HTMLButtonElement>(root, '#btn-zen'),
      startButton: getRequiredElement<HTMLButtonElement>(root, '#btn-start'),
      restartButton: getRequiredElement<HTMLButtonElement>(root, '#btn-restart'),
      practiceMissedPanel: getRequiredElement<HTMLDivElement>(root, '#practice-missed-panel'),
      practiceMissedSection: getRequiredElement<HTMLDivElement>(root, '#practice-missed-section'),
      practiceMissedEndButton: getRequiredElement<HTMLButtonElement>(root, '#btn-practice-missed-end'),
      skipButton: getRequiredElement<HTMLButtonElement>(root, '#btn-skip'),
      endButton: getRequiredElement<HTMLButtonElement>(root, '#btn-end'),
      showSolutionButton: getRequiredElement<HTMLButtonElement>(root, '#btn-solution'),
      debugProblemSelect: root.querySelector<HTMLSelectElement>('#debug-problem-select'),
      debugLoadButton: root.querySelector<HTMLButtonElement>('#btn-debug-load'),
      debugProblemList: root.querySelector<HTMLDivElement>('#debug-problem-list'),
      scoreValue: getRequiredElement<HTMLSpanElement>(root, '#score-val'),
      pointsBadge: getRequiredElement<HTMLSpanElement>(root, '#points-badge'),
      timerValue: getRequiredElement<HTMLDivElement>(root, '#timer-val'),
      problemName: getRequiredElement<HTMLDivElement>(root, '#problem-name'),
      targetBox: getRequiredElement<HTMLDivElement>(root, '#target-box'),
      outputHead: getRequiredElement<HTMLDivElement>(root, '#output-head'),
      yoursBox: getRequiredElement<HTMLDivElement>(root, '#yours-box'),
      solutionLabel: getRequiredElement<HTMLDivElement>(root, '#solution-label'),
      solutionPanel: getRequiredElement<HTMLDivElement>(root, '#solution-panel'),
      solutionCode: getRequiredElement<HTMLTextAreaElement>(root, '#solution-code'),
      shadowToggle: getRequiredElement<HTMLInputElement>(root, '#shadow-toggle'),
      yoursShadow: getRequiredElement<HTMLDivElement>(root, '#yours-shadow'),
      yoursRender: getRequiredElement<HTMLDivElement>(root, '#yours-render'),
      codeInput: getRequiredElement<HTMLTextAreaElement>(root, '#code-input'),
      matchStatus: getRequiredElement<HTMLDivElement>(root, '#match-status'),
      finalScore: getRequiredElement<HTMLDivElement>(root, '#final-num'),
      timeSpentValue: getRequiredElement<HTMLDivElement>(root, '#end-time-spent'),
      highScoreValue: getRequiredElement<HTMLSpanElement>(root, '#end-high-score'),
      correctValue: getRequiredElement<HTMLDivElement>(root, '#s-correct'),
      skippedValue: getRequiredElement<HTMLDivElement>(root, '#s-skipped'),
      streakValue: getRequiredElement<HTMLDivElement>(root, '#s-streak'),
      reviewList: getRequiredElement<HTMLDivElement>(root, '#review-list'),
    }

    this.initializeDebugMenu()
    this.bindEvents()
  }

  async initialize(): Promise<void> {
    this.elements.loadMessage.textContent = 'Compiling test formula…'

    try {
      await initializeTypst()
      this.elements.loading.hidden = true
      this.goToStart()
      void this.renderDebugMenuPreviews()
    } catch (error) {
      this.elements.loadMessage.textContent = `Error: ${String(error)}`
    }
  }

  private bindEvents(): void {
    this.elements.timedButton.addEventListener('click', () => {
      this.setMode('timed')
    })

    this.elements.zenButton.addEventListener('click', () => {
      this.setMode('zen')
    })

    this.elements.startButton.addEventListener('click', () => {
      this.isPracticeMissedMode = false
      void this.startGame()
    })

    this.elements.restartButton.addEventListener('click', () => {
      this.goToStart()
    })

    this.elements.practiceMissedEndButton.addEventListener('click', () => {
      void this.startPracticeMissed()
    })

    this.elements.skipButton.addEventListener('click', () => {
      void this.skip()
    })

    this.elements.endButton.addEventListener('click', () => {
      void this.endGame()
    })

    this.elements.showSolutionButton.addEventListener('click', () => {
      void this.showSolution()
    })

    this.elements.shadowToggle.addEventListener('change', () => {
      this.shadowEnabled = this.elements.shadowToggle.checked
      this.syncShadowState()
    })

    if (DEBUG_MENU_ENABLED && this.elements.debugLoadButton) {
      this.elements.debugLoadButton.addEventListener('click', () => {
        void this.loadSelectedDebugProblem()
      })
    }

    if (DEBUG_MENU_ENABLED && this.elements.debugProblemList) {
      this.elements.debugProblemList.addEventListener('click', (event) => {
        const target = event.target

        if (!(target instanceof HTMLElement)) {
          return
        }

        const button = target.closest<HTMLButtonElement>('[data-problem-index]')

        if (!button) {
          return
        }

        const selectedIndex = Number(button.dataset.problemIndex)

        if (!Number.isInteger(selectedIndex) || !PROBLEMS[selectedIndex]) {
          return
        }

        if (this.elements.debugProblemSelect) {
          this.elements.debugProblemSelect.value = String(selectedIndex)
        }

        void this.loadProblemByIndex(selectedIndex)
      })
    }

    this.elements.codeInput.addEventListener('input', () => {
      this.queueInputEvaluation()
    })

    this.elements.codeInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault()
        void this.skip()
      }
    })
  }

  private initializeDebugMenu(): void {
    if (!DEBUG_MENU_ENABLED || !this.elements.debugProblemSelect) {
      return
    }

    this.elements.debugProblemSelect.innerHTML = PROBLEMS.map((problem, index) => {
      const label = `${index + 1}. ${problem.name} (${problem.pts} pts)`
      return `<option value="${index}">${label}</option>`
    }).join('')

    if (this.elements.debugProblemList) {
      this.elements.debugProblemList.innerHTML = PROBLEMS.map((problem, index) => {
        const escapedSource = escapeHtml(problem.src)

        return `
          <article class="debug-problem">
            <div class="debug-problem-head">
              <div>
                <div class="debug-problem-name">${index + 1}. ${problem.name}</div>
                <div class="debug-problem-points">${problem.pts} pts</div>
              </div>
              <button class="skip-link debug-load-link" data-problem-index="${index}" type="button">load</button>
            </div>
            <div class="formula-box debug-preview-box" data-debug-preview="${index}">
              <span class="ph">waiting to render…</span>
            </div>
            <code class="debug-src">${escapedSource}</code>
          </article>
        `
      }).join('')
    }
  }

  private setMode(mode: GameMode): void {
    this.mode = mode
    this.elements.timedButton.classList.toggle('sel', mode === 'timed')
    this.elements.zenButton.classList.toggle('sel', mode === 'zen')
  }

  private goToStart(): void {
    this.clearTimers()
    this.isPracticeMissedMode = false
    this.showScreen('start')
    this.updatePracticeMissedSection()
  }

  private getMissedProblems(wrongStats: WrongStats = this.readWrongStats()): Problem[] {
    return PROBLEMS
      .filter(problem => (wrongStats[problem.name] ?? 0) > 0)
      .sort((a, b) => (wrongStats[b.name] ?? 0) - (wrongStats[a.name] ?? 0))
  }

  private getEligiblePracticeProblems(wrongStats: WrongStats = this.readWrongStats()): Problem[] {
    return this.getMissedProblems(wrongStats)
      .filter(problem => (this.practiceAppearances.get(problem.name) ?? 0) < MAX_PRACTICE_APPEARANCES)
  }

  private updatePracticeMissedSection(): void {
    const wrongStats = this.readWrongStats()
    const missed = this.getMissedProblems(wrongStats)
    const hasMissed = missed.length > 0

    this.elements.practiceMissedShell.hidden = this.elements.startScreen.hidden || !hasMissed
    this.elements.practiceMissedSection.hidden = !hasMissed

    if (missed.length === 0) {
      this.elements.practiceMissedMenu.open = false
      this.elements.practiceMissedPanel.innerHTML = ''
      return
    }

    this.elements.practiceMissedMenu.open = false
    this.renderPracticeMissedPanel(missed, wrongStats)
  }

  private renderPracticeMissedPanel(missed: Problem[], wrongStats: WrongStats): void {
    const panel = this.elements.practiceMissedPanel

    const listItems = missed.map(p => {
      const count = wrongStats[p.name] ?? 0
      return `<li><span>${escapeHtml(p.name)}</span><span class="pm-count">×${count}</span></li>`
    }).join('')

    panel.innerHTML = `
      <div class="practice-missed-panel-head">
        <span class="practice-missed-panel-label">${missed.length} problem${missed.length === 1 ? '' : 's'} queued</span>
        <button class="practice-missed-clear" id="btn-pm-clear" type="button">clear list</button>
      </div>
      <ul class="practice-missed-list">${listItems}</ul>
      <button class="btn primary practice-start-button" id="btn-pm-start" type="button">Practice These</button>
    `

    panel.querySelector('#btn-pm-clear')
      ?.addEventListener('click', () => {
        this.clearWrongStats()
        this.updatePracticeMissedSection()
      })

    panel.querySelector('#btn-pm-start')
      ?.addEventListener('click', () => {
        void this.startPracticeMissed()
      })
  }

  private showScreen(screen: 'start' | 'game' | 'end'): void {
    this.elements.startScreen.hidden = screen !== 'start'
    this.elements.gameScreen.hidden = screen !== 'game'
    this.elements.endScreen.hidden = screen !== 'end'
    this.elements.practiceMissedShell.hidden = screen !== 'start'
  }

  private clearTimers(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }

    if (this.inputDebounceId !== null) {
      window.clearTimeout(this.inputDebounceId)
      this.inputDebounceId = null
    }

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId)
      this.advanceTimeoutId = null
    }
  }

  private queueInputEvaluation(): void {
    this.inputGeneration += 1

    this.pendingCorrect = false
    this.elements.yoursBox.classList.remove('match')
    this.elements.matchStatus.textContent = ''

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId)
      this.advanceTimeoutId = null
    }

    if (this.inputDebounceId !== null) {
      window.clearTimeout(this.inputDebounceId)
    }

    const generation = this.inputGeneration
    this.inputDebounceId = window.setTimeout(() => {
      void this.evaluateInput(generation, true)
    }, 400)
  }

  private async flushInputEvaluation(): Promise<boolean> {
    this.inputGeneration += 1

    if (this.inputDebounceId !== null) {
      window.clearTimeout(this.inputDebounceId)
      this.inputDebounceId = null
    }

    return await this.evaluateInput(this.inputGeneration, false)
  }

  private resetRoundState(initialProblemIndex?: number): void {
    this.score = 0
    this.correct = 0
    this.skippedCount = 0
    this.streak = 0
    this.bestStreak = 0
    this.history = []
    this.timeLeft = this.mode === 'timed' ? 180 : Number.POSITIVE_INFINITY
    this.queue = this.buildQueue(initialProblemIndex)
    this.current = null
    this.targetResult = null
    this.userResult = null
    this.pendingCorrect = false
    this.reviewRenderId += 1
    this.sessionStartedAt = null
    this.solutionVisible = false
    this.practiceAppearances.clear()
  }

  private async startGame(initialProblemIndex?: number): Promise<void> {
    this.clearTimers()
    this.resetRoundState(initialProblemIndex)
    this.sessionStartedAt = Date.now()
    this.exitSolutionMode()
    this.showScreen('game')
    this.updateScore()
    this.updateTimer()

    if (this.mode === 'timed') {
      this.timerId = window.setInterval(() => {
        void this.handleTimerTick()
      }, 1000)
    }

    await this.nextProblem()
    this.elements.codeInput.focus()
  }

  private async handleTimerTick(): Promise<void> {
    this.timeLeft -= 1
    this.updateTimer()

    if (this.timeLeft > 0) {
      return
    }

    const matched = await this.flushInputEvaluation()

    if (matched || this.pendingCorrect) {
      await this.submitAnswer(true, true)
      return
    }

    void this.endGame()
  }

  private async startPracticeMissed(): Promise<void> {
    const wrongStats = this.readWrongStats()
    const missedProblems = this.getMissedProblems(wrongStats)

    if (missedProblems.length === 0) {
      this.isPracticeMissedMode = false
      this.updatePracticeMissedSection()
      return
    }

    this.isPracticeMissedMode = true
    this.clearTimers()
    this.resetRoundState()
    this.queue = [...missedProblems]
    this.practiceAppearances = new Map(missedProblems.map(problem => [problem.name, 0]))
    this.sessionStartedAt = Date.now()
    this.exitSolutionMode()
    this.showScreen('game')
    this.updateScore()
    this.updateTimer()
    // Always zen mode for practice
    this.timeLeft = Number.POSITIVE_INFINITY
    this.updateTimer()

    await this.nextProblem()
    this.elements.codeInput.focus()
  }

  private buildQueue(initialProblemIndex?: number): Problem[] {
    if (initialProblemIndex === undefined) {
      return shuffle([...PROBLEMS])
    }

    const initialProblem = PROBLEMS[initialProblemIndex]

    if (!initialProblem) {
      return shuffle([...PROBLEMS])
    }

    const remainingProblems = PROBLEMS.filter((_, index) => index !== initialProblemIndex)
    return [initialProblem, ...shuffle(remainingProblems)]
  }

  private updateScore(): void {
    this.elements.scoreValue.textContent = String(this.score)
  }

  private updateTimer(): void {
    if (!Number.isFinite(this.timeLeft)) {
      this.elements.timerValue.textContent = this.isPracticeMissedMode ? 'practice' : '∞'
      this.elements.timerValue.classList.toggle('timer-mode-label', this.isPracticeMissedMode)
      this.elements.timerValue.classList.remove('urgent')
      return
    }

    this.elements.timerValue.classList.remove('timer-mode-label')
    const minutes = Math.floor(this.timeLeft / 60)
    const seconds = this.timeLeft % 60
    this.elements.timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
    this.elements.timerValue.classList.toggle('urgent', this.timeLeft <= 30)
  }

  private async nextProblem(): Promise<void> {
    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId)
      this.advanceTimeoutId = null
    }

    if (this.queue.length === 0) {
      if (this.isPracticeMissedMode) {
        const missedProblems = this.getEligiblePracticeProblems()
        if (missedProblems.length === 0) {
          this.current = null
          this.pendingCorrect = false
          void this.endGame()
          return
        }
        this.queue = shuffle([...missedProblems])
      } else {
        this.queue = shuffle([...PROBLEMS])
      }
    }

    const next = this.queue.shift()

    if (!next) {
      throw new Error('Could not load the next problem.')
    }

    this.current = next
    if (this.isPracticeMissedMode) {
      this.practiceAppearances.set(next.name, (this.practiceAppearances.get(next.name) ?? 0) + 1)
    }
    this.pendingCorrect = false
    this.exitSolutionMode()
    this.elements.codeInput.value = ''
    this.elements.matchStatus.textContent = ''
    this.elements.problemName.textContent = next.name
    this.elements.pointsBadge.textContent = `${next.pts} pts`
    this.elements.pointsBadge.className = `points-pill ${getPointsTierClass(next.pts)}`

    this.setSvg(this.elements.targetBox, null, 'rendering…')
    this.targetResult = null
    this.userResult = null
    this.elements.yoursBox.classList.remove('match')
    this.renderShadowLayer()
    this.targetResult = await renderFormula(next.src)
    this.setSvg(this.elements.targetBox, this.targetResult, 'render error')
    this.renderShadowLayer()
    this.renderUserLayer(null)

    this.elements.codeInput.focus()
  }

  private async loadSelectedDebugProblem(): Promise<void> {
    if (!DEBUG_MENU_ENABLED || !this.elements.debugProblemSelect) {
      return
    }

    const selectedIndex = Number(this.elements.debugProblemSelect.value)

    if (!Number.isInteger(selectedIndex) || !PROBLEMS[selectedIndex]) {
      return
    }

    await this.loadProblemByIndex(selectedIndex)
  }

  private async loadProblemByIndex(problemIndex: number): Promise<void> {
    await this.flushInputEvaluation()

    if (this.elements.gameScreen.hidden) {
      await this.startGame(problemIndex)
      return
    }

    this.queue = this.buildQueue(problemIndex)
    await this.nextProblem()
  }

  private async renderDebugMenuPreviews(): Promise<void> {
    if (!DEBUG_MENU_ENABLED || !this.elements.debugProblemList) {
      return
    }

    const previewBoxes = Array.from(
      this.elements.debugProblemList.querySelectorAll<HTMLDivElement>('[data-debug-preview]'),
    )

    for (const previewBox of previewBoxes) {
      const problemIndex = Number(previewBox.dataset.debugPreview)

      if (!Number.isInteger(problemIndex) || !PROBLEMS[problemIndex]) {
        continue
      }

      this.setSvg(previewBox, null, 'rendering…')
      const renderResult = await renderFormula(PROBLEMS[problemIndex].src)
      this.setSvg(previewBox, renderResult, 'render error')
    }
  }

  private setSvg(
    boxElement: HTMLDivElement,
    result: RenderResult | null,
    emptyLabel: string,
  ): void {
    boxElement.innerHTML = ''
    boxElement.classList.remove('match')

    if (!result || !result.svg) {
      const className = result && !result.ok ? 'err' : 'ph'
      const message = result && !result.ok ? 'parse error' : emptyLabel
      boxElement.innerHTML = `<span class="${className}">${message}</span>`
      return
    }

    boxElement.innerHTML = result.svg

    const svg = boxElement.querySelector('svg')

    if (svg) {
      svg.style.display = 'block'
      svg.style.maxWidth = '100%'
      svg.style.maxHeight = '100%'
      svg.style.width = 'auto'
      svg.style.height = 'auto'
      svg.removeAttribute('width')
      svg.removeAttribute('height')
    }
  }

  private setLayerSvg(
    layerElement: HTMLDivElement,
    result: RenderResult | null,
    emptyLabel = '',
  ): void {
    layerElement.innerHTML = ''

    if (!result || !result.svg) {
      const className = result && !result.ok ? 'err' : 'ph'
      const message = result && !result.ok ? 'parse error' : emptyLabel

      if (!message) {
        return
      }

      layerElement.innerHTML = `<span class="${className}">${message}</span>`
      return
    }

    layerElement.innerHTML = result.svg

    const svg = layerElement.querySelector('svg')

    if (svg) {
      svg.style.display = 'block'
      svg.style.maxWidth = '100%'
      svg.style.maxHeight = '100%'
      svg.style.width = 'auto'
      svg.style.height = 'auto'
      svg.removeAttribute('width')
      svg.removeAttribute('height')
    }

    // Focus textarea when user clicks their render (jump-to-input)
    if (layerElement === this.elements.yoursRender && result?.svg) {
      const svg = layerElement.querySelector('svg')
      if (svg && !svg.dataset.jumpBound) {
        svg.dataset.jumpBound = '1'
        svg.style.cursor = 'text'
        svg.addEventListener('click', () => {
          this.elements.codeInput.focus()
        }, { passive: true })
      }
    }
  }

  private renderUserLayer(result: RenderResult | null): void {
    const emptyLabel =
      this.shadowEnabled && this.targetResult?.ok ? '' : 'start typing below…'
    this.setLayerSvg(this.elements.yoursRender, result, emptyLabel)
  }

  private renderShadowLayer(): void {
    const shadowResult =
      this.shadowEnabled &&
        this.targetResult?.ok &&
        (!this.userResult || this.userResult.ok)
        ? this.targetResult
        : null
    this.setLayerSvg(this.elements.yoursShadow, shadowResult)
  }

  private syncShadowState(): void {
    this.elements.yoursBox.classList.toggle('shadow-enabled', this.shadowEnabled)
    this.renderShadowLayer()
    this.renderUserLayer(this.userResult)
  }

  private async showSolution(): Promise<void> {
    if (!this.current || this.solutionVisible) {
      return
    }

    const current = this.current
    await this.flushInputEvaluation()

    if (this.current !== current || this.solutionVisible) {
      return
    }

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId)
      this.advanceTimeoutId = null
    }

    this.solutionVisible = true
    this.elements.outputHead.hidden = true
    this.elements.yoursBox.hidden = true
    this.elements.solutionLabel.hidden = false
    this.elements.solutionPanel.hidden = false
    this.elements.solutionCode.value = current.src
    this.elements.codeInput.readOnly = true
    this.elements.codeInput.placeholder = ''
    this.elements.showSolutionButton.hidden = true
    this.elements.skipButton.textContent = 'continue'
    this.elements.matchStatus.textContent = ''
    this.elements.yoursBox.classList.remove('match')
    this.elements.skipButton.focus()
  }

  private exitSolutionMode(): void {
    this.solutionVisible = false
    this.elements.outputHead.hidden = false
    this.elements.yoursBox.hidden = false
    this.elements.solutionLabel.hidden = true
    this.elements.solutionPanel.hidden = true
    this.elements.solutionCode.value = ''
    this.elements.codeInput.readOnly = false
    this.elements.codeInput.placeholder = 'type Typst math here…'
    this.elements.showSolutionButton.hidden = false
    this.elements.skipButton.textContent = 'skip'
  }

  private recordCurrentProblemAsEnded(): void {
    if (!this.current) {
      return
    }

    // If there's a pending correct answer right at game end, credit it
    if (this.pendingCorrect) {
      this.history.push({
        name: this.current.name,
        src: this.current.src,
        attempt: this.elements.codeInput.value.trim(),
        result: 'correct',
        pts: this.current.pts,
        svg: this.targetResult?.ok ? this.targetResult.svg : null,
        userSvg: this.userResult?.ok ? this.userResult.svg : null,
      })
      this.correct += 1
      this.streak += 1
      this.bestStreak = Math.max(this.bestStreak, this.streak)
      this.score += this.current.pts
      this.recordCorrect(this.current.name)
    } else {
      this.history.push({
        name: this.current.name,
        src: this.current.src,
        attempt: this.elements.codeInput.value.trim(),
        result: 'ended',
        pts: 0,
        svg: this.targetResult?.ok ? this.targetResult.svg : null,
        userSvg: this.userResult?.ok ? this.userResult.svg : null,
      })
    }

    this.current = null
  }

  private async evaluateInput(generation: number, allowAutoAdvance: boolean): Promise<boolean> {
    if (this.solutionVisible) {
      return false
    }

    const value = this.elements.codeInput.value.trim()
    this.elements.matchStatus.textContent = ''
    this.elements.yoursBox.classList.remove('match')
    this.pendingCorrect = false

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId)
      this.advanceTimeoutId = null
    }

    if (!value) {
      this.userResult = null
      this.renderShadowLayer()
      this.renderUserLayer(null)
      return false
    }

    const userResult = await renderFormula(value)

    if (
      this.solutionVisible ||
      generation !== this.inputGeneration ||
      this.elements.codeInput.value.trim() !== value
    ) {
      return false
    }

    this.userResult = userResult
    this.renderShadowLayer()
    this.renderUserLayer(userResult)

    if (userResult.ok && this.targetResult?.ok) {
      const matches = normalizeSvg(userResult.svg) === normalizeSvg(this.targetResult.svg)

      if (matches) {
        this.elements.yoursBox.classList.add('match')
        this.elements.matchStatus.innerHTML = '<span class="match-msg">✓ Match!</span>'
        this.pendingCorrect = true

        if (allowAutoAdvance) {
          if (this.advanceTimeoutId !== null) {
            window.clearTimeout(this.advanceTimeoutId)
          }

          this.advanceTimeoutId = window.setTimeout(() => {
            void this.submitAnswer()
          }, 600)
        }
      }
    }

    return this.pendingCorrect
  }

  private async submitAnswer(fromTimer = false, skipFlush = false): Promise<void> {
    if (!skipFlush) {
      await this.flushInputEvaluation()
    }

    const value = this.elements.codeInput.value.trim()

    if (!value || !this.current) {
      return
    }

    // On timer-triggered submit, re-check match state using pendingCorrect
    const isCorrect = fromTimer
      ? this.pendingCorrect
      : this.elements.yoursBox.classList.contains('match')

    const problemName = this.current.name

    this.history.push({
      name: this.current.name,
      src: this.current.src,
      attempt: value,
      result: isCorrect ? 'correct' : 'wrong',
      pts: isCorrect ? this.current.pts : 0,
      svg: this.targetResult?.ok ? this.targetResult.svg : null,
      userSvg: this.userResult?.ok ? this.userResult.svg : null,
    })

    if (isCorrect) {
      this.correct += 1
      this.streak += 1
      this.bestStreak = Math.max(this.bestStreak, this.streak)
      this.score += this.current.pts
      this.updateScore()
      this.recordCorrect(problemName)
    } else {
      this.streak = 0
      if (!this.isPracticeMissedMode) {
        this.recordWrong(problemName)
      }
    }

    this.pendingCorrect = false

    if (fromTimer) {
      await this.endGame()
    } else {
      await this.nextProblem()
    }
  }

  private async skip(): Promise<void> {
    if (!this.current) {
      return
    }

    await this.flushInputEvaluation()

    const problemName = this.current.name

    this.history.push({
      name: this.current.name,
      src: this.current.src,
      attempt: this.elements.codeInput.value.trim(),
      result: 'skipped',
      pts: 0,
      svg: this.targetResult?.ok ? this.targetResult.svg : null,
      userSvg: this.userResult?.ok ? this.userResult.svg : null,
    })
    if (!this.isPracticeMissedMode) {
      this.skippedCount += 1
    }
    this.streak = 0
    this.pendingCorrect = false
    if (!this.isPracticeMissedMode) {
      this.recordWrong(problemName)
    }
    await this.nextProblem()
  }

  private async endGame(): Promise<void> {
    await this.flushInputEvaluation()
    this.clearTimers()
    this.recordCurrentProblemAsEnded()
    this.exitSolutionMode()
    const elapsedSeconds = this.getElapsedSeconds()
    const highScore = this.updateStoredHighScore()
    this.showScreen('end')
    this.elements.finalScore.textContent = String(this.score)
    this.elements.timeSpentValue.textContent = formatDuration(elapsedSeconds)
    this.elements.highScoreValue.textContent = String(highScore)
    this.elements.correctValue.textContent = String(this.correct)
    this.elements.skippedValue.textContent = String(this.skippedCount)
    this.elements.streakValue.textContent = String(this.bestStreak)
    this.updatePracticeMissedSection()

    if (this.history.length === 0) {
      this.elements.reviewList.innerHTML = '<p class="review-empty">No problems played yet.</p>'
      return
    }

    this.elements.reviewList.innerHTML = '<p class="review-empty">Rendering saved attempts…</p>'
    const reviewRenderId = ++this.reviewRenderId
    void this.renderReview(reviewRenderId)
  }

  private getElapsedSeconds(): number {
    if (this.sessionStartedAt === null) {
      return 0
    }

    const elapsedByClock = Math.max(0, Math.floor((Date.now() - this.sessionStartedAt) / 1000))

    if (this.mode === 'zen' || this.isPracticeMissedMode) {
      return elapsedByClock
    }

    const elapsedByTimer = 180 - Math.max(this.timeLeft, 0)
    return Math.min(180, Math.max(elapsedByClock, elapsedByTimer))
  }

  private updateStoredHighScore(): number {
    const highScores = this.readHighScores()
    highScores[this.mode] = Math.max(highScores[this.mode], this.score)
    this.writeHighScores(highScores)
    return highScores[this.mode]
  }

  private readHighScores(): HighScores {
    const defaultScores: HighScores = { timed: 0, zen: 0 }
    const storage = this.getStorage()

    if (!storage) {
      return defaultScores
    }

    try {
      const storedValue = storage.getItem(HIGH_SCORE_STORAGE_KEY)

      if (!storedValue) {
        return defaultScores
      }

      const parsedValue = JSON.parse(storedValue) as Partial<Record<GameMode, unknown>>

      return {
        timed: typeof parsedValue.timed === 'number' ? parsedValue.timed : 0,
        zen: typeof parsedValue.zen === 'number' ? parsedValue.zen : 0,
      }
    } catch {
      return defaultScores
    }
  }

  private writeHighScores(highScores: HighScores): void {
    const storage = this.getStorage()

    if (!storage) {
      return
    }

    try {
      storage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(highScores))
    } catch {
      // Ignore storage failures
    }
  }

  // ── Wrong-problem tracking ───────────────────────────────────────────────

  private readWrongStats(): WrongStats {
    const storage = this.getStorage()
    if (!storage) return {}

    try {
      const raw = storage.getItem(WRONG_STATS_STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
      const stats: WrongStats = {}
      let changed = false
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          changed = true
          continue
        }

        const count = Math.floor(v)
        if (count <= 0 || !VALID_PROBLEM_NAMES.has(k)) {
          changed = true
          continue
        }

        if (count !== v) {
          changed = true
        }

        stats[k] = count
      }

      if (changed) {
        if (Object.keys(stats).length === 0) {
          this.clearWrongStats()
        } else {
          this.writeWrongStats(stats)
        }
      }
      return stats
    } catch {
      return {}
    }
  }

  private writeWrongStats(stats: WrongStats): void {
    const storage = this.getStorage()
    if (!storage) return
    try {
      storage.setItem(WRONG_STATS_STORAGE_KEY, JSON.stringify(stats))
    } catch { /* ignore */ }
  }

  private recordWrong(problemName: string): void {
    const stats = this.readWrongStats()
    stats[problemName] = (stats[problemName] ?? 0) + 1
    this.writeWrongStats(stats)
  }

  private recordCorrect(problemName: string): void {
    const stats = this.readWrongStats()
    if (stats[problemName]) {
      delete stats[problemName]
    }
    this.writeWrongStats(stats)
  }

  private clearWrongStats(): void {
    const storage = this.getStorage()
    if (!storage) return
    try {
      storage.removeItem(WRONG_STATS_STORAGE_KEY)
    } catch { /* ignore */ }
  }

  private getStorage(): Storage | null {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  private async renderReview(reviewRenderId: number): Promise<void> {
    const wrongStats = this.readWrongStats()

    const reviewEntries = await Promise.all(
      this.history.map(async (entry, index) => {
        // Always show a render for the correct formula — even on parse error, show the box
        const correctPreview = this.getReviewPreviewMarkup(entry.svg, 'render unavailable', 'err', true)

        const shouldShowUserPreview = entry.result !== 'correct'
        let userPreview = ''

        if (shouldShowUserPreview) {
          if (entry.userSvg) {
            // We already have the SVG from when user played — use it directly
            userPreview = this.getReviewPreviewMarkup(entry.userSvg, 'no render', 'err', false)
          } else {
            userPreview = await this.getUserReviewPreviewMarkup(entry.attempt)
          }
        }

        const className =
          entry.result === 'correct'
            ? 'r-ok'
            : entry.result === 'skipped'
              ? 'r-skip'
              : entry.result === 'ended'
                ? 'r-end'
                : 'r-bad'
        const icon =
          entry.result === 'correct'
            ? '✓'
            : entry.result === 'skipped'
              ? '→'
              : entry.result === 'ended'
                ? '■'
                : '✗'
        const meta =
          entry.result === 'correct'
            ? `+${entry.pts}`
            : entry.result === 'skipped'
              ? 'skip'
              : entry.result === 'ended'
                ? 'game ended'
                : 'miss'
        const attempt = entry.attempt
          ? escapeHtml(entry.attempt)
          : '<span class="review-code-empty">No code entered.</span>'

        const missCount = wrongStats[entry.name] ?? 0
        const missTag = missCount > 0
          ? `<span class="miss-badge" title="Missed ${missCount} time(s) across sessions">×${missCount}</span>`
          : ''

        return `
          <details class="review-entry">
            <summary class="review-summary">
              <span class="review-summary-row">
                <span class="${className}">${icon}</span>
                <span class="review-title">${index + 1}. ${escapeHtml(entry.name)}</span>
                <span class="review-meta">${meta}</span>
                ${missTag}
              </span>
            </summary>
            <div class="review-detail">
              <div class="review-block">
                <div class="sec-label review-block-label">Correct render</div>
                ${correctPreview}
              </div>
              <div class="review-block">
                <div class="sec-label review-block-label">Correct code</div>
                <pre class="review-code"><code>${escapeHtml(entry.src)}</code></pre>
              </div>
              ${shouldShowUserPreview
            ? `<div class="review-block">
                <div class="sec-label review-block-label">Your render</div>
                ${userPreview}
              </div>`
            : ''}
              <div class="review-block">
                <div class="sec-label review-block-label">Your code</div>
                <pre class="review-code"><code>${attempt}</code></pre>
              </div>
            </div>
          </details>
        `
      }),
    )

    if (reviewRenderId !== this.reviewRenderId) {
      return
    }

    this.elements.reviewList.innerHTML = reviewEntries.join('')
  }

  private async getUserReviewPreviewMarkup(attempt: string): Promise<string> {
    if (!attempt) {
      return this.getReviewPreviewMarkup(null, 'No code entered.', 'ph', true)
    }

    const result = await renderFormula(attempt)

    // Always show something — even on parse error
    return this.getReviewPreviewMarkup(
      result.ok ? result.svg : null,
      result.ok ? 'render unavailable' : 'parse error',
      result.ok ? 'err' : 'err',
      true,
    )
  }

  private getReviewPreviewMarkup(
    svg: string | null,
    emptyMessage: string,
    messageClass: 'err' | 'ph',
    _alwaysShowBox: boolean,
  ): string {
    if (svg) {
      return `<div class="formula-box review-preview-box">${svg}</div>`
    }

    // Always render a visible box — never silently omit
    return `<div class="formula-box review-preview-box"><span class="${messageClass}">${emptyMessage}</span></div>`
  }
}

function formatDuration(totalSeconds: number): string {
  const safeTotalSeconds = Math.max(0, totalSeconds)
  const hours = Math.floor(safeTotalSeconds / 3600)
  const minutes = Math.floor((safeTotalSeconds % 3600) / 60)
  const seconds = safeTotalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
