const PIXELS_PER_POINT = 2
interface SvgSize { width: number; height: number }

function serializeSvg(svg: string | SVGSVGElement): string {
  if (typeof svg === 'string') return svg
  return new XMLSerializer().serializeToString(svg)
}

function getSvgSize(svg: string): SvgSize {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.localName !== 'svg') throw new Error('no svg root')
  const vb = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (vb?.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] }
  const w = parseFloat(root.getAttribute('width') ?? ''), h = parseFloat(root.getAttribute('height') ?? '')
  if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) return { width: w, height: h }
  throw new Error('no dimensions')
}

// Typst specific: tsel + script are invisible / interactivity, not visual
function stripForRaster(svg: string): string {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    if (doc.querySelector('parsererror')) throw new Error('parsererror')
    doc.querySelectorAll('foreignObject').forEach(n => n.remove())
    doc.querySelectorAll('script').forEach(n => n.remove())
    return new XMLSerializer().serializeToString(doc.documentElement)
  } catch {
    // fallback regex if parser is strict
    return svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  }
}

async function loadSvgImage(svg: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.referrerPolicy = 'no-referrer'
  await new Promise<void>((res, rej) => {
    image.onload = () => res()
    image.onerror = () => rej(new Error('Could not rasterize SVG.'))
    image.src = url
  })
  return { image, url }
}

function toHex(b: ArrayBuffer) { return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('') }

export async function hashSvgRaster(svg: string | SVGSVGElement): Promise<string | null> {
  const serialized = serializeSvg(svg)
  // use lenient DOM element if you pass SVGSVGElement from targetBox, but strip non-visual for hash
  const rasterSvg = stripForRaster(serialized)

  const size = getSvgSize(rasterSvg)
  const width = Math.max(1, Math.round(size.width * PIXELS_PER_POINT))
  const height = Math.max(1, Math.round(size.height * PIXELS_PER_POINT))
  const { image, url } = await loadSvgImage(rasterSvg)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any)
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, width, height)

    // now won't throw because foreignObject was removed
    const pixels = ctx.getImageData(0, 0, width, height).data
    const hashInput = new Uint8Array(8 + pixels.byteLength)
    new DataView(hashInput.buffer).setUint32(0, width)
    new DataView(hashInput.buffer).setUint32(4, height)
    hashInput.set(pixels, 8)
    return toHex(await crypto.subtle.digest('SHA-256', hashInput))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'SecurityError') return null
    throw e
  } finally {
    URL.revokeObjectURL(url)
  }
}