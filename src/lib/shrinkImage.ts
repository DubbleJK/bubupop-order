const MAX_EDGE = 1280
const JPEG_QUALITY = 0.72

function drawScaled(img: HTMLImageElement): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height, 1))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

/** 올린 시안을 인쇄에 충분한 크기로 줄인다. */
export async function shrinkDesignFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const shrunk = drawScaled(img)
    if (!shrunk) throw new Error('canvas')
    return shrunk
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 이미 저장된 큰 시안도 다시 저장하기 전에 줄인다. */
export async function shrinkDataUrl(src: string): Promise<string> {
  if (!src.startsWith('data:image/') || src.length < 400_000) return src
  try {
    const img = await loadImage(src)
    return drawScaled(img) || src
  } catch {
    return src
  }
}
