export type GameMode = 'timed' | 'zen'
export type HistoryResult = 'correct' | 'wrong' | 'skipped'

export interface Problem {
  name: string
  src: string
  pts: number
}

export interface HistoryEntry {
  name: string
  src: string
  result: HistoryResult
  pts: number
}

export interface RenderSuccess {
  ok: true
  svg: string
}

export interface RenderFailure {
  ok: false
  svg: null
  err: string
}

export type RenderResult = RenderSuccess | RenderFailure
