const PIXELS_PER_POINT = 2

interface SvgSize { width: number; height: number }

const UI_LAYOUT_PROPERTIES = [
  'display',
  'max-width',
  'max-height',
  'width',
  'height',
  'position',
  'left',
  'top',
  'cursor',
] as const

function serializeSvg(svg: string | SVGSVGElement): string {
  if (typeof svg === 'string') return svg
  return new XMLSerializer().serializeToString(svg)
}

function getSvgSize(svg: string): SvgSize {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.localName!== 'svg') throw new Error('no svg root')
  const vb = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (vb?.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    return { width: vb[2], height: vb[3] }
  }
  const w = parseFloat(root.getAttribute('width')?? '')
  const h = parseFloat(root.getAttribute('height')?? '')
  if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) return { width: w, height: h }
  throw new Error('no dimensions')
}

function stripForRaster(svg: string): string {
  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    if (doc.querySelector('parsererror')) throw new Error('parsererror')
    doc.querySelectorAll('foreignObject').forEach(el => el.remove())
    doc.querySelectorAll('script').forEach(el => el.remove())

    const root = doc.documentElement as unknown as SVGSVGElement
    const size = getSvgSize(svg)

    // The game removes the intrinsic dimensions and adds layout-only styles
    // after inserting an SVG into the page. Those mutations are useful for
    // responsive display, but they change the viewport when the serialized SVG
    // is loaded as a standalone image (the default viewport becomes 300x150).
    // Give every rasterized SVG the same intrinsic viewport and discard only
    // the styles/data attributes added by the game UI.
    root.setAttribute('width', String(size.width))
    root.setAttribute('height', String(size.height))
    UI_LAYOUT_PROPERTIES.forEach(property => root.style.removeProperty(property))
    root.removeAttribute('data-jump-bound')

    if (!root.style.cssText.trim()) {
      root.removeAttribute('style')
    }

    return new XMLSerializer().serializeToString(root)
  } catch {
    return svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  }
}

async function loadSvgImage(svg: string): Promise<{ image: HTMLImageElement; url: string }> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.referrerPolicy = 'no-referrer'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Could not rasterize SVG.'))
    image.src = url
  })
  return { image, url }
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashSvgRaster(svg: string | SVGSVGElement): Promise<string | null> {
  const serialized = serializeSvg(svg)
  const rasterSvg = stripForRaster(serialized)

  let size: SvgSize
  try {
    size = getSvgSize(rasterSvg)
  } catch {
    return null
  }

  const width = Math.max(1, Math.round(size.width * PIXELS_PER_POINT))
  const height = Math.max(1, Math.round(size.height * PIXELS_PER_POINT))

  const { image, url } = await loadSvgImage(rasterSvg)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null
    if (!ctx) return null

    ctx.drawImage(image, 0, 0, width, height)

    let pixels: Uint8ClampedArray
    try {
      pixels = ctx.getImageData(0, 0, width, height).data
    } catch (e) {
      if (e instanceof DOMException && e.name === 'SecurityError') return null
      throw e
    }

    const hashInput = new Uint8Array(8 + pixels.byteLength)
    const view = new DataView(hashInput.buffer)
    view.setUint32(0, width)
    view.setUint32(4, height)
    hashInput.set(pixels, 8)

    const digest = await crypto.subtle.digest('SHA-256', hashInput)
    return toHex(digest)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
