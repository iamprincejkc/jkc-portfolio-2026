/**
 * SVG path data -> the move/line/cubic/close command list the renderer uses.
 *
 * This exists for one reason: the brand logos are third-party path data that
 * uses the full SVG grammar - relative commands, shorthands, elliptical arcs -
 * and the PDF and EPS exporters understand none of that. Normalising once, at
 * parse time, is what lets a logo be true vector in every export format rather
 * than a bitmap pasted over the code.
 *
 * Arcs become cubics. The conversion is the endpoint-to-centre parameterisation
 * from the SVG spec's implementation notes (F.6.5), then one cubic per <= 90
 * degree slice, which is accurate to well under a thousandth of the radius.
 */
import type { PathCmd, Shape } from './shapes'

const NUMBER = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g

const N = String.raw`[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?`
const SEP = String.raw`[,\s]*`
/**
 * Arc arguments need their own scanner. The two flags are single characters
 * and minifiers are allowed to run them straight into the next number, so
 * `a5 5 0 015 5` means flags 0 and 1 followed by x=5 - a plain number scan
 * reads `015` and silently produces a different curve.
 */
const ARC_ARGS = new RegExp(
  `(${N})${SEP}(${N})${SEP}(${N})${SEP}([01])${SEP}([01])${SEP}(${N})${SEP}(${N})`,
  'g',
)

/** Splits a path string into `[command, ...numbers]` groups. */
function tokenize(d: string): { cmd: string; args: number[] }[] {
  const out: { cmd: string; args: number[] }[] = []
  // Matches one command letter followed by everything up to the next letter.
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(d)) !== null) {
    const cmd = match[1]!
    const body = match[2]!
    let args: number[]
    if (cmd === 'A' || cmd === 'a') {
      args = []
      ARC_ARGS.lastIndex = 0
      let arc: RegExpExecArray | null
      while ((arc = ARC_ARGS.exec(body)) !== null) {
        for (let i = 1; i <= 7; i++) args.push(Number(arc[i]))
      }
    } else {
      args = (body.match(NUMBER) ?? []).map(Number)
    }
    out.push({ cmd, args })
  }
  return out
}

/** How many numbers each command consumes per repetition. */
const ARITY: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
}

export function parsePathData(d: string): Shape {
  const out: PathCmd[] = []

  let x = 0
  let y = 0
  // Subpath start, for Z.
  let sx = 0
  let sy = 0
  // Reflection anchors for the S and T shorthands.
  let lastCubicCtrl: [number, number] | null = null
  let lastQuadCtrl: [number, number] | null = null

  for (const token of tokenize(d)) {
    const upper = token.cmd.toUpperCase()
    const relative = token.cmd !== upper
    const arity = ARITY[upper] ?? 0

    if (upper === 'Z') {
      out.push({ c: 'Z' })
      x = sx
      y = sy
      lastCubicCtrl = null
      lastQuadCtrl = null
      continue
    }

    // A repeated argument list means the command repeats. After the first
    // pair, an implicit M continues as L, per the spec.
    let first = true
    for (let i = 0; i + arity <= token.args.length; i += arity) {
      const a = token.args.slice(i, i + arity)
      const effective = upper === 'M' && !first ? 'L' : upper

      switch (effective) {
        case 'M': {
          x = relative ? x + a[0]! : a[0]!
          y = relative ? y + a[1]! : a[1]!
          sx = x
          sy = y
          out.push({ c: 'M', x, y })
          lastCubicCtrl = null
          lastQuadCtrl = null
          break
        }
        case 'L': {
          x = relative ? x + a[0]! : a[0]!
          y = relative ? y + a[1]! : a[1]!
          out.push({ c: 'L', x, y })
          lastCubicCtrl = null
          lastQuadCtrl = null
          break
        }
        case 'H': {
          x = relative ? x + a[0]! : a[0]!
          out.push({ c: 'L', x, y })
          lastCubicCtrl = null
          lastQuadCtrl = null
          break
        }
        case 'V': {
          y = relative ? y + a[0]! : a[0]!
          out.push({ c: 'L', x, y })
          lastCubicCtrl = null
          lastQuadCtrl = null
          break
        }
        case 'C': {
          const x1 = relative ? x + a[0]! : a[0]!
          const y1 = relative ? y + a[1]! : a[1]!
          const x2 = relative ? x + a[2]! : a[2]!
          const y2 = relative ? y + a[3]! : a[3]!
          const ex = relative ? x + a[4]! : a[4]!
          const ey = relative ? y + a[5]! : a[5]!
          out.push({ c: 'C', x1, y1, x2, y2, x: ex, y: ey })
          lastCubicCtrl = [x2, y2]
          lastQuadCtrl = null
          x = ex
          y = ey
          break
        }
        case 'S': {
          // The missing first control point is the reflection of the previous
          // one; with no previous cubic it coincides with the current point.
          const [px, py] = lastCubicCtrl ?? [x, y]
          const x1 = 2 * x - px
          const y1 = 2 * y - py
          const x2 = relative ? x + a[0]! : a[0]!
          const y2 = relative ? y + a[1]! : a[1]!
          const ex = relative ? x + a[2]! : a[2]!
          const ey = relative ? y + a[3]! : a[3]!
          out.push({ c: 'C', x1, y1, x2, y2, x: ex, y: ey })
          lastCubicCtrl = [x2, y2]
          lastQuadCtrl = null
          x = ex
          y = ey
          break
        }
        case 'Q': {
          const qx = relative ? x + a[0]! : a[0]!
          const qy = relative ? y + a[1]! : a[1]!
          const ex = relative ? x + a[2]! : a[2]!
          const ey = relative ? y + a[3]! : a[3]!
          out.push(quadToCubic(x, y, qx, qy, ex, ey))
          lastQuadCtrl = [qx, qy]
          lastCubicCtrl = null
          x = ex
          y = ey
          break
        }
        case 'T': {
          const [px, py] = lastQuadCtrl ?? [x, y]
          const qx = 2 * x - px
          const qy = 2 * y - py
          const ex = relative ? x + a[0]! : a[0]!
          const ey = relative ? y + a[1]! : a[1]!
          out.push(quadToCubic(x, y, qx, qy, ex, ey))
          lastQuadCtrl = [qx, qy]
          lastCubicCtrl = null
          x = ex
          y = ey
          break
        }
        case 'A': {
          const ex = relative ? x + a[5]! : a[5]!
          const ey = relative ? y + a[6]! : a[6]!
          out.push(...arcToCubics(x, y, a[0]!, a[1]!, a[2]!, a[3]! !== 0, a[4]! !== 0, ex, ey))
          lastCubicCtrl = null
          lastQuadCtrl = null
          x = ex
          y = ey
          break
        }
      }

      first = false
      if (arity === 0) break
    }
  }

  return out
}

function quadToCubic(x0: number, y0: number, qx: number, qy: number, x1: number, y1: number): PathCmd {
  return {
    c: 'C',
    x1: x0 + (2 / 3) * (qx - x0),
    y1: y0 + (2 / 3) * (qy - y0),
    x2: x1 + (2 / 3) * (qx - x1),
    y2: y1 + (2 / 3) * (qy - y1),
    x: x1,
    y: y1,
  }
}

function arcToCubics(
  x0: number,
  y0: number,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x1: number,
  y1: number,
): PathCmd[] {
  // Degenerate cases the spec says to treat as a straight line.
  if (x0 === x1 && y0 === y1) return []
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  if (rx === 0 || ry === 0) return [{ c: 'L', x: x1, y: y1 }]

  const phi = (rotationDeg * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)

  // Step 1: shift into the ellipse's own frame.
  const dx = (x0 - x1) / 2
  const dy = (y0 - y1) / 2
  const x1p = cosPhi * dx + sinPhi * dy
  const y1p = -sinPhi * dx + cosPhi * dy

  // Step 2: scale radii up if they are too small to span the chord.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }

  // Step 3: centre in the ellipse frame.
  const sign = largeArc === sweep ? -1 : 1
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const co = sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx

  // Step 4: back to user space.
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2

  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy)
    const a = Math.acos(Math.min(1, Math.max(-1, dot / len)))
    return ux * vy - uy * vx < 0 ? -a : a
  }

  const theta0 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let sweepAngle = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  )
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI

  // One cubic per <= 90 degree slice keeps the approximation error negligible.
  const segments = Math.max(1, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2)))
  const delta = sweepAngle / segments
  const k = (4 / 3) * Math.tan(delta / 4)

  const out: PathCmd[] = []
  let theta = theta0
  let px = x0
  let py = y0

  for (let i = 0; i < segments; i++) {
    const next = theta + delta

    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    const cosN = Math.cos(next)
    const sinN = Math.sin(next)

    // Endpoint and tangent of this slice, in user space.
    const ex = cx + rx * cosPhi * cosN - ry * sinPhi * sinN
    const ey = cy + rx * sinPhi * cosN + ry * cosPhi * sinN

    const dxdtStart = -rx * cosPhi * sinT - ry * sinPhi * cosT
    const dydtStart = -rx * sinPhi * sinT + ry * cosPhi * cosT
    const dxdtEnd = -rx * cosPhi * sinN - ry * sinPhi * cosN
    const dydtEnd = -rx * sinPhi * sinN + ry * cosPhi * cosN

    out.push({
      c: 'C',
      x1: px + k * dxdtStart,
      y1: py + k * dydtStart,
      x2: ex - k * dxdtEnd,
      y2: ey - k * dydtEnd,
      x: ex,
      y: ey,
    })

    theta = next
    px = ex
    py = ey
  }

  return out
}
