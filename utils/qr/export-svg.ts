/**
 * Scene -> SVG.
 *
 * Two consumers with one source of truth. `sceneToSvgParts` returns the pieces
 * as data, which the live preview renders as real Vue nodes; `sceneToSvg`
 * serialises the same pieces into the string the download and the PNG
 * rasteriser use. Splitting it this way is what lets the preview update by
 * patching a handful of attributes instead of re-parsing the whole document,
 * without the two ever drifting apart.
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

export interface SvgGradientStop {
  id: string
  kind: 'linear' | 'radial'
  from: string
  to: string
  /** Linear only. */
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  /** Radial only. */
  cx?: number
  cy?: number
  r?: number
}

export interface SvgPathPart {
  id: string
  d: string
  /** A colour, or `url(#id)` when the path is filled with a gradient. */
  fill: string
  stroke?: string
  strokeWidth?: number
}

export interface SvgParts {
  /** Canvas side in module units; the viewBox is `0 0 size size`. */
  size: number
  background: string
  gradients: SvgGradientStop[]
  paths: SvgPathPart[]
  image?: { href: string; x: number; y: number; width: number; height: number }
}

export function sceneToSvgParts(scene: QrScene): SvgParts {
  const gradients: SvgGradientStop[] = []
  const paths: SvgPathPart[] = []

  scene.paths.forEach((path, index) => {
    if (path.shapes.length === 0) return
    const d = toPathData(path.shapes)
    if (!d) return

    paths.push({
      id: path.id,
      d,
      fill: paintFor(path.fill, `g${index}`, gradients),
      stroke: path.stroke?.color,
      strokeWidth: path.stroke?.width,
    })
  })

  return {
    size: scene.size,
    background: scene.background,
    gradients,
    paths,
    image: scene.image,
  }
}

function paintFor(fill: Fill, id: string, into: SvgGradientStop[]): string {
  if (fill.kind === 'solid') return fill.color

  if (fill.kind === 'linear') {
    into.push({ id, kind: 'linear', from: fill.from, to: fill.to, x1: fill.x1, y1: fill.y1, x2: fill.x2, y2: fill.y2 })
  } else {
    into.push({ id, kind: 'radial', from: fill.from, to: fill.to, cx: fill.cx, cy: fill.cy, r: fill.r })
  }
  return `url(#${id})`
}

function gradientMarkup(g: SvgGradientStop): string {
  const stops = `<stop offset="0" stop-color="${escapeXml(g.from)}"/><stop offset="1" stop-color="${escapeXml(g.to)}"/>`
  if (g.kind === 'linear') {
    return `<linearGradient id="${g.id}" gradientUnits="userSpaceOnUse" x1="${round(g.x1!)}" y1="${round(g.y1!)}" x2="${round(g.x2!)}" y2="${round(g.y2!)}">${stops}</linearGradient>`
  }
  return `<radialGradient id="${g.id}" gradientUnits="userSpaceOnUse" cx="${round(g.cx!)}" cy="${round(g.cy!)}" r="${round(g.r!)}">${stops}</radialGradient>`
}

export interface SvgOptions {
  /** Pixel width and height of the root element. Omit for a scalable SVG. */
  pixelSize?: number
}

export function sceneToSvg(scene: QrScene, options: SvgOptions = {}): string {
  const parts = sceneToSvgParts(scene)

  const body = parts.paths.map((path) => {
    const stroke = path.stroke
      ? // `paint-order` puts the stroke down first, so an outline grows outward
        // from the module instead of eating half its width.
        ` stroke="${escapeXml(path.stroke)}" stroke-width="${round(path.strokeWidth ?? 0)}" stroke-linejoin="round" paint-order="stroke"`
      : ''
    return `<path d="${path.d}" fill="${escapeXml(path.fill)}"${stroke}/>`
  })

  if (parts.image) {
    const img = parts.image
    body.push(
      `<image href="${escapeXml(img.href)}" x="${round(img.x)}" y="${round(img.y)}" width="${round(img.width)}" height="${round(img.height)}" preserveAspectRatio="xMidYMid meet"/>`,
    )
  }

  const dimensions =
    options.pixelSize !== undefined
      ? ` width="${options.pixelSize}" height="${options.pixelSize}"`
      : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${dimensions} viewBox="0 0 ${round(parts.size)} ${round(parts.size)}" shape-rendering="geometricPrecision">`,
    parts.gradients.length ? `<defs>${parts.gradients.map(gradientMarkup).join('')}</defs>` : '',
    `<rect width="${round(parts.size)}" height="${round(parts.size)}" fill="${escapeXml(parts.background)}"/>`,
    body.join(''),
    '</svg>',
  ].join('')
}
