import type { RenderResult } from './types'

interface TypstInitOptions {
  getModule: () => string
}

interface TypstRuntime {
  setCompilerInitOptions(options: TypstInitOptions): void
  setRendererInitOptions(options: TypstInitOptions): void
  svg(input: { mainContent: string }): Promise<string>
}

const COMPILER_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'
const RENDERER_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'

let typstReadyPromise: Promise<TypstRuntime> | null = null

function wrapFormula(source: string): string {
  return `#set page(width: auto, height: auto, margin: (x: 8pt, y: 6pt))
#set text(size: 20pt)
$
${source}
$`
}

function getTypstRuntime(): TypstRuntime | null {
  const globalWithTypst = globalThis as typeof globalThis & { $typst?: TypstRuntime }
  return globalWithTypst.$typst ?? null
}

function waitForTypstScript(): Promise<TypstRuntime> {
  const runtime = getTypstRuntime()

  if (runtime) {
    return Promise.resolve(runtime)
  }

  const script = document.querySelector<HTMLScriptElement>('#typst')

  if (!script) {
    return Promise.reject(new Error('Could not find the Typst runtime script tag.'))
  }

  return new Promise<TypstRuntime>((resolve, reject) => {
    const onLoad = () => {
      const loadedRuntime = getTypstRuntime()
      if (!loadedRuntime) {
        reject(new Error('Typst loaded but did not expose the $typst runtime.'))
        return
      }

      resolve(loadedRuntime)
    }

    const onError = () => {
      reject(new Error('Failed to load the Typst runtime.'))
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
  })
}

async function ensureTypstReady(): Promise<TypstRuntime> {
  if (!typstReadyPromise) {
    typstReadyPromise = (async () => {
      const typst = await waitForTypstScript()

      typst.setCompilerInitOptions({
        getModule: () => COMPILER_WASM_URL,
      })

      typst.setRendererInitOptions({
        getModule: () => RENDERER_WASM_URL,
      })

      await typst.svg({ mainContent: wrapFormula('x^2') })

      return typst
    })()
  }

  return typstReadyPromise
}

export async function initializeTypst(): Promise<void> {
  await ensureTypstReady()
}

export async function renderFormula(source: string): Promise<RenderResult> {
  try {
    const typst = await ensureTypstReady()
    const svg = await typst.svg({ mainContent: wrapFormula(source) })
    return { ok: true, svg }
  } catch (error) {
    return { ok: false, svg: null, err: String(error) }
  }
}
