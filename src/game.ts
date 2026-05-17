import { DEBUG_MENU_ENABLED } from './config'
import { PROBLEMS } from './problems'
import { initializeTypst, renderFormula } from './typst'
import type { GameMode, HistoryEntry, Problem, RenderResult } from './types'

interface GameElements {
  loading: HTMLDivElement
  loadMessage: HTMLDivElement
  startScreen: HTMLElement
  gameScreen: HTMLElement
  endScreen: HTMLElement
  timedButton: HTMLButtonElement
  zenButton: HTMLButtonElement
  startButton: HTMLButtonElement
  restartButton: HTMLButtonElement
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

  constructor(root: HTMLElement) {
    this.elements = {
      loading: getRequiredElement<HTMLDivElement>(root, '#loading'),
      loadMessage: getRequiredElement<HTMLDivElement>(root, '#load-msg'),
      startScreen: getRequiredElement<HTMLElement>(root, '#screen-start'),
      gameScreen: getRequiredElement<HTMLElement>(root, '#screen-game'),
      endScreen: getRequiredElement<HTMLElement>(root, '#screen-end'),
      timedButton: getRequiredElement<HTMLButtonElement>(root, '#btn-timed'),
      zenButton: getRequiredElement<HTMLButtonElement>(root, '#btn-zen'),
      startButton: getRequiredElement<HTMLButtonElement>(root, '#btn-start'),
      restartButton: getRequiredElement<HTMLButtonElement>(root, '#btn-restart'),
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
      void this.startGame()
    })

    this.elements.restartButton.addEventListener('click', () => {
      this.goToStart()
    })

    this.elements.skipButton.addEventListener('click', () => {
      void this.skip()
    })

    this.elements.endButton.addEventListener('click', () => {
      this.endGame()
    })

    this.elements.showSolutionButton.addEventListener('click', () => {
      this.showSolution()
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
      if (this.inputDebounceId !== null) {
        window.clearTimeout(this.inputDebounceId)
      }

      this.inputDebounceId = window.setTimeout(() => {
        void this.handleInput()
      }, 400)
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
    this.showScreen('start')
  }

  private showScreen(screen: 'start' | 'game' | 'end'): void {
    this.elements.startScreen.hidden = screen !== 'start'
    this.elements.gameScreen.hidden = screen !== 'game'
    this.elements.endScreen.hidden = screen !== 'end'
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
    this.reviewRenderId += 1
    this.sessionStartedAt = null
    this.solutionVisible = false
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
        this.timeLeft -= 1
        this.updateTimer()

        if (this.timeLeft <= 0) {
          this.endGame()
        }
      }, 1000)
    }

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
      this.elements.timerValue.textContent = '∞'
      this.elements.timerValue.classList.remove('urgent')
      return
    }

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
      this.queue = shuffle([...PROBLEMS])
    }

    const next = this.queue.shift()

    if (!next) {
      throw new Error('Could not load the next problem.')
    }

    this.current = next
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

  private showSolution(): void {
    if (!this.current || this.solutionVisible) {
      return
    }

    if (this.inputDebounceId !== null) {
      window.clearTimeout(this.inputDebounceId)
      this.inputDebounceId = null
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
    this.elements.solutionCode.value = this.current.src
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

    this.history.push({
      name: this.current.name,
      src: this.current.src,
      attempt: this.elements.codeInput.value.trim(),
      result: 'ended',
      pts: 0,
      svg: this.targetResult?.ok ? this.targetResult.svg : null,
    })

    this.current = null
  }

  private async handleInput(): Promise<void> {
    if (this.solutionVisible) {
      return
    }

    const value = this.elements.codeInput.value.trim()
    this.elements.matchStatus.textContent = ''
    this.elements.yoursBox.classList.remove('match')

    if (this.advanceTimeoutId !== null) {
      window.clearTimeout(this.advanceTimeoutId)
      this.advanceTimeoutId = null
    }

    if (!value) {
      this.userResult = null
      this.renderShadowLayer()
      this.renderUserLayer(null)
      return
    }

    const userResult = await renderFormula(value)

    if (this.solutionVisible || this.elements.codeInput.value.trim() !== value) {
      return
    }

    this.userResult = userResult
    this.renderShadowLayer()
    this.renderUserLayer(userResult)

    if (userResult.ok && this.targetResult?.ok) {
      const matches = normalizeSvg(userResult.svg) === normalizeSvg(this.targetResult.svg)

      if (matches) {
        this.elements.yoursBox.classList.add('match')
        this.elements.matchStatus.innerHTML = '<span class="match-msg">✓ Match!</span>'

        if (this.advanceTimeoutId !== null) {
          window.clearTimeout(this.advanceTimeoutId)
        }

        this.advanceTimeoutId = window.setTimeout(() => {
          void this.submitAnswer()
        }, 600)
      }
    }
  }

  private async submitAnswer(): Promise<void> {
    const value = this.elements.codeInput.value.trim()

    if (!value || !this.current) {
      return
    }

    const isCorrect = this.elements.yoursBox.classList.contains('match')

    this.history.push({
      name: this.current.name,
      src: this.current.src,
      attempt: value,
      result: isCorrect ? 'correct' : 'wrong',
      pts: isCorrect ? this.current.pts : 0,
      svg: this.targetResult?.ok ? this.targetResult.svg : null,
    })

    if (isCorrect) {
      this.correct += 1
      this.streak += 1
      this.bestStreak = Math.max(this.bestStreak, this.streak)
      this.score += this.current.pts
      this.updateScore()
    } else {
      this.streak = 0
    }

    await this.nextProblem()
  }

  private async skip(): Promise<void> {
    if (!this.current) {
      return
    }

    this.history.push({
      name: this.current.name,
      src: this.current.src,
      attempt: this.elements.codeInput.value.trim(),
      result: 'skipped',
      pts: 0,
      svg: this.targetResult?.ok ? this.targetResult.svg : null,
    })
    this.skippedCount += 1
    this.streak = 0
    await this.nextProblem()
  }

  private endGame(): void {
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

    if (this.mode === 'zen') {
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
      // Ignore storage failures so gameplay still finishes normally.
    }
  }

  private getStorage(): Storage | null {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  private async renderReview(reviewRenderId: number): Promise<void> {
    const reviewEntries = await Promise.all(
      this.history.map(async (entry, index) => {
        const correctPreview = this.getReviewPreviewMarkup(entry.svg, 'render unavailable', 'err')
        const shouldShowUserPreview = entry.result !== 'correct'
        const userPreview = shouldShowUserPreview
          ? await this.getUserReviewPreviewMarkup(entry.attempt)
          : ''

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

        return `
          <details class="review-entry">
            <summary class="review-summary">
              <span class="review-summary-row">
                <span class="${className}">${icon}</span>
                <span class="review-title">${index + 1}. ${escapeHtml(entry.name)}</span>
                <span class="review-meta">${meta}</span>
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
      return this.getReviewPreviewMarkup(null, 'No render entered.', 'ph')
    }

    const result = await renderFormula(attempt)

    return this.getReviewPreviewMarkup(result.ok ? result.svg : null, 'render unavailable', 'err')
  }

  private getReviewPreviewMarkup(
    svg: string | null,
    emptyMessage: string,
    messageClass: 'err' | 'ph',
  ): string {
    if (svg) {
      return `<div class="formula-box review-preview-box">${svg}</div>`
    }

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
