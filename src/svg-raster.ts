const PIXELS_PER_POINT = 2

interface SvgSize {
  width: number
  height: number
}

function getSvgSize(svg: string): SvgSize {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = document.documentElement

  if (root.localName !== 'svg') {
    throw new Error('Rendered output does not contain an SVG root element.')
  }

  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)

  if (
    viewBox?.length === 4 &&
    viewBox.every(Number.isFinite) &&
    viewBox[2] > 0 &&
    viewBox[3] > 0
  ) {
    return { width: viewBox[2], height: viewBox[3] }
  }

  const width = Number.parseFloat(root.getAttribute('width') ?? '')
  const height = Number.parseFloat(root.getAttribute('height') ?? '')

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height }
  }

  throw new Error('Rendered SVG has no usable dimensions.')
}

async function loadSvgImage(svg: string): Promise<{ image: HTMLImageElement; url: string }> {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const image = new Image()

  try {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => reject(new Error('Could not rasterize SVG.')), {
        once: true,
      })
      image.src = url
    })
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }

  return { image, url }
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Rasterize an SVG at two pixels per Typst point and hash its dimensions and
 * RGBA pixels. Typst's visual tests likewise compare raster pixel buffers,
 * which makes the result independent of how equivalent SVG nodes are arranged.
 */
export async function hashSvgRaster(svg: string): Promise<string> {
  const size = getSvgSize(svg)
  const width = Math.max(1, Math.round(size.width * PIXELS_PER_POINT))
  const height = Math.max(1, Math.round(size.height * PIXELS_PER_POINT))
  const { image, url } = await loadSvgImage(svg)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Could not create a canvas rendering context.')
    }

    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const hashInput = new Uint8Array(8 + pixels.byteLength)
    const dimensions = new DataView(hashInput.buffer, 0, 8)
    dimensions.setUint32(0, width)
    dimensions.setUint32(4, height)
    hashInput.set(pixels, 8)

    return toHex(await crypto.subtle.digest('SHA-256', hashInput))
  } finally {
    URL.revokeObjectURL(url)
  }
}
