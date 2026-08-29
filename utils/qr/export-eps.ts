/**
 * Scene -> Encapsulated PostScript.
 *
 * EPS is here because print shops still ask for it, and for the same reason as
 * the PDF export it stays vector. PostScript is a stack language, so the file
 * is close to a transcript of the drawing: coordinates, then an operator.
 *
 * Gradients use LanguageLevel 3 `shfill`, which every current RIP and every
 * version of Illustrator since CS understands. The `%%LanguageLevel: 3`
 * comment in the header declares that requirement up front.
 */
import type { Fill, QrScene } from './render'
import { parseHex } from './render'
import type { Shape } from './shapes'

const PT_PER_INCH = 72
const DEFAULT_INCHES = 4

function num(value: number): string {
  return String(Number(value.toFixed(4)))
}

function rgb(hex: string): string {
  const [r, g, b] = parseHex(hex)
  return `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`
}

function pathOps(shapes: readonly Shape[]): string[] {
  const out: string[] = []
  for (const shape of shapes) {
    for (const cmd of shape) {
      switch (cmd.c) {
        case 'M':
          out.push(`${num(cmd.x)} ${num(cmd.y)} moveto`)
          break
        case 'L':
          out.push(`${num(cmd.x)} ${num(cmd.y)} lineto`)
          break
        case 'C':
          out.push(
            `${num(cmd.x1)} ${num(cmd.y1)} ${num(cmd.x2)} ${num(cmd.y2)} ${num(cmd.x)} ${num(cmd.y)} curveto`,
          )
          break
        case 'Z':
          out.push('closepath')
          break
      }
    }
  }
  return out
}

function shading(fill: Extract<Fill, { kind: 'linear' | 'radial' }>): string {
  const [r0, g0, b0] = parseHex(fill.from)
  const [r1, g1, b1] = parseHex(fill.to)
  const fn = `/Function << /FunctionType 2 /Domain [0 1] /C0 [${num(r0 / 255)} ${num(g0 / 255)} ${num(b0 / 255)}] /C1 [${num(r1 / 255)} ${num(g1 / 255)} ${num(b1 / 255)}] /N 1 >>`

  if (fill.kind === 'linear') {
    return `<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${num(fill.x1)} ${num(fill.y1)} ${num(fill.x2)} ${num(fill.y2)}] ${fn} /Extend [true true] >> shfill`
  }
  return `<< /ShadingType 3 /ColorSpace /DeviceRGB /Coords [${num(fill.cx)} ${num(fill.cy)} 0 ${num(fill.cx)} ${num(fill.cy)} ${num(fill.r)}] ${fn} /Extend [true true] >> shfill`
}

export interface EpsImage {
  /** Raw RGB triples, row-major, top row first. */
  rgb: Uint8Array
  width: number
  height: number
}

export interface EpsOptions {
  inches?: number
  image?: EpsImage
}

function toHex(bytes: Uint8Array): string {
  const lut = '0123456789abcdef'
  const out: string[] = []
  let line = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    line += lut[b >> 4]! + lut[b & 15]!
    // Keep lines inside the 255-character DSC limit.
    if (line.length >= 78) {
      out.push(line)
      line = ''
    }
  }
  if (line) out.push(line)
  return out.join('\n')
}

export function sceneToEps(scene: QrScene, options: EpsOptions = {}): Blob {
  const side = (options.inches ?? DEFAULT_INCHES) * PT_PER_INCH
  const scale = side / scene.size

  const lines: string[] = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    '%%Creator: iamjkc.space QR generator',
    '%%LanguageLevel: 3',
    `%%BoundingBox: 0 0 ${Math.ceil(side)} ${Math.ceil(side)}`,
    `%%HiResBoundingBox: 0 0 ${num(side)} ${num(side)}`,
    '%%EndComments',
    '%%BeginProlog',
    '/qrsave save def',
    '%%EndProlog',
    'gsave',
    // PostScript is y-up from the bottom-left; the scene is y-down from the
    // top-left. Translate to the top edge, then flip the Y axis.
    `0 ${num(side)} translate`,
    `${num(scale)} ${num(-scale)} scale`,
    `${rgb(scene.background)} setrgbcolor`,
    `0 0 ${num(scene.size)} ${num(scene.size)} rectfill`,
  ]

  for (const path of scene.paths) {
    if (path.shapes.length === 0) continue
    const ops = pathOps(path.shapes)
    if (ops.length === 0) continue

    if (path.stroke) {
      lines.push('gsave')
      lines.push('newpath')
      lines.push(...ops)
      lines.push(`${rgb(path.stroke.color)} setrgbcolor`)
      lines.push(`${num(path.stroke.width)} setlinewidth 1 setlinejoin`)
      lines.push('stroke')
      lines.push('grestore')
    }

    if (path.fill.kind === 'solid') {
      lines.push('newpath')
      lines.push(...ops)
      lines.push(`${rgb(path.fill.color)} setrgbcolor`)
      lines.push('fill')
    } else {
      lines.push('gsave')
      lines.push('newpath')
      lines.push(...ops)
      lines.push('clip')
      lines.push(shading(path.fill))
      lines.push('grestore')
    }
  }

  if (scene.image && options.image) {
    const img = scene.image
    const { rgb: pixels, width, height } = options.image
    lines.push(
      'gsave',
      // Read buffer for one scanline of RGB, which `colorimage` refills per row.
      `/qrpix ${width * 3} string def`,
      `${num(img.x)} ${num(img.y)} translate`,
      `${num(img.width)} ${num(img.height)} scale`,
      `${width} ${height} 8`,
      // Maps the unit square onto the pixel grid, top row first.
      `[${width} 0 0 ${-height} 0 ${height}]`,
      '{currentfile qrpix readhexstring pop}',
      'false 3 colorimage',
      toHex(pixels),
      'grestore',
    )
  }

  lines.push('grestore')
  lines.push('qrsave restore')
  lines.push('%%EOF')

  return new Blob([lines.join('\n')], { type: 'application/postscript' })
}
