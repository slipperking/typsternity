export type GameMode = 'timed' | 'zen'
export type HistoryResult = 'correct' | 'wrong' | 'skipped' | 'ended'

export interface Problem {
  name: string
  src: string
  pts: number
}

export interface HistoryEntry {
  name: string
  src: string
  attempt: string
  result: HistoryResult
  pts: number
  svg: string | null
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
