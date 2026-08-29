/**
 * The browser half of exporting: rasterising, decoding the uploaded logo, and
 * putting a file in the user's downloads folder.
 *
 * Everything here needs a DOM, so it is kept apart from the pure scene and
 * format code, which is unit-tested in Node.
 */
import { sceneToEps } from './export-eps'
import { sceneToPdf } from './export-pdf'
import { sceneToSvg } from './export-svg'
import type { QrScene } from './render'
import { parseHex } from './render'

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'eps'

/** Turns an SVG string into an `<img>` that has finished decoding. */
function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  // A data URL rather than a blob URL: Safari taints a canvas drawn from a
  // blob-URL SVG in some versions, and `toBlob` then throws.
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The QR code could not be rasterised.'))
    img.src = src
  })
}

export async function sceneToPng(scene: QrScene, pixelSize: number): Promise<Blob> {
  const svg = sceneToSvg(scene, { pixelSize })
  const img = await loadSvgImage(svg)

  const canvas = document.createElement('canvas')
  canvas.width = pixelSize
  canvas.height = pixelSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser did not provide a 2D canvas.')

  // The SVG already paints its own background, but a flat fill first avoids
  // any chance of a transparent seam at the edges from rounding.
  ctx.fillStyle = scene.background
  ctx.fillRect(0, 0, pixelSize, pixelSize)
  ctx.drawImage(img, 0, 0, pixelSize, pixelSize)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The PNG could not be encoded.'))),
      'image/png',
    )
  })
}

/**
 * Decodes an uploaded logo into flat RGB for the PDF and EPS writers.
 *
 * Both formats want opaque pixels, so the image is composited over the plate
 * colour rather than carrying an alpha channel that would need a soft mask.
 */
export async function decodeLogoPixels(
  dataUrl: string,
  plate: string,
  size = 512,
): Promise<{ rgb: Uint8Array; width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('The logo could not be read.'))
    el.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser did not provide a 2D canvas.')

  const [pr, pg, pb] = parseHex(plate)
  ctx.fillStyle = `rgb(${pr},${pg},${pb})`
  ctx.fillRect(0, 0, size, size)

  // Contain, matching the SVG's preserveAspectRatio="xMidYMid meet".
  const ratio = Math.min(size / img.width, size / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)

  const { data } = ctx.getImageData(0, 0, size, size)
  const rgb = new Uint8Array(size * size * 3)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]!
    rgb[j + 1] = data[i + 1]!
    rgb[j + 2] = data[i + 2]!
  }

  return { rgb, width: size, height: size }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface ExportRequest {
  scene: QrScene
  format: ExportFormat
  /** PNG only. */
  pixelSize: number
  filename: string
}

export async function exportScene({
  scene,
  format,
  pixelSize,
  filename,
}: ExportRequest): Promise<void> {
  switch (format) {
    case 'png':
      saveBlob(await sceneToPng(scene, pixelSize), `${filename}.png`)
      return

    case 'svg':
      saveBlob(
        new Blob([sceneToSvg(scene)], { type: 'image/svg+xml;charset=utf-8' }),
        `${filename}.svg`,
      )
      return

    case 'pdf': {
      const image = scene.image
        ? await decodeLogoPixels(scene.image.href, scene.background)
        : undefined
      saveBlob(await sceneToPdf(scene, { image }), `${filename}.pdf`)
      return
    }

    case 'eps': {
      const image = scene.image
        ? await decodeLogoPixels(scene.image.href, scene.background, 256)
        : undefined
      saveBlob(sceneToEps(scene, { image }), `${filename}.eps`)
      return
    }
  }
}
