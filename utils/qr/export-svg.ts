/**
 * Scene -> SVG. Also the source image for the PNG export, so this is the one
 * format the others are checked against.
 */
import { toPathData } from './shapes'
import type { Fill, QrScene } from './render'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function round(value: number): string {
  return String(Number(value.toFixed(3)))
}

function gradientDef(id: string, fill: Fill): string {
  if (fill.kind === 'linear') {
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${round(fill.x1)}" y1="${round(fill.y1)}" x2="${round(fill.x2)}" y2="${round(fill.y2)}"><stop offset="0" stop-color="${escapeXml(fill.from)}"/><stop offset="1" stop-color="${escapeXml(fill.to)}"/></linearGradient>`
  }
  if (fill.kind === 'radial') {
    return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${round(fill.cx)}" cy="${round(fill.cy)}" r="${round(fill.r)}"><stop offset="0" stop-color="${escapeXml(fill.from)}"/><stop offset="1" stop-color="${escapeXml(fill.to)}"/></radialGradient>`
  }
  return ''
}

export interface SvgOptions {
  /** Pixel width and height of the root element. Omit for a scalable SVG. */
  pixelSize?: number
}

export function sceneToSvg(scene: QrScene, options: SvgOptions = {}): string {
  const defs: string[] = []
  const body: string[] = []

  scene.paths.forEach((path, index) => {
    if (path.shapes.length === 0) return

    const d = toPathData(path.shapes)
    if (!d) return

    let paint: string
    if (path.fill.kind === 'solid') {
      paint = escapeXml(path.fill.color)
    } else {
      const id = `g${index}`
      defs.push(gradientDef(id, path.fill))
      paint = `url(#${id})`
    }

    const stroke = path.stroke
      ? // `paint-order` puts the stroke down first, so an outline grows outward
        // from the module instead of eating half its width.
        ` stroke="${escapeXml(path.stroke.color)}" stroke-width="${round(path.stroke.width)}" stroke-linejoin="round" paint-order="stroke"`
      : ''

    body.push(`<path d="${d}" fill="${paint}"${stroke}/>`)
  })

  if (scene.image) {
    const img = scene.image
    body.push(
      `<image href="${escapeXml(img.href)}" x="${round(img.x)}" y="${round(img.y)}" width="${round(img.width)}" height="${round(img.height)}" preserveAspectRatio="xMidYMid meet"/>`,
    )
  }

  const dimensions =
    options.pixelSize !== undefined
      ? ` width="${options.pixelSize}" height="${options.pixelSize}"`
      : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${dimensions} viewBox="0 0 ${round(scene.size)} ${round(scene.size)}" shape-rendering="geometricPrecision">`,
    defs.length ? `<defs>${defs.join('')}</defs>` : '',
    `<rect width="${round(scene.size)}" height="${round(scene.size)}" fill="${escapeXml(scene.background)}"/>`,
    body.join(''),
    '</svg>',
  ].join('')
}
