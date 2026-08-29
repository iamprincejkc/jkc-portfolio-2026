/**
 * Style options in, drawing instructions out.
 *
 * The renderer stops at a `QrScene`: a background colour, an ordered list of
 * filled paths in module coordinates, and at most one raster image. It never
 * touches the DOM and never emits SVG. Each exporter turns that same scene
 * into its own format, which is the only reason a PDF and the on-screen
 * preview can be guaranteed to agree.
 */
import { buildMatrix, punchLogoHole, type ErrorCorrection, type QrMatrix } from './matrix'
import { findBrandLogo } from './logos'
import { parsePathData } from './path-parse'
import {
  BODY_SHAPES,
  EYE_FRAMES,
  EYE_PUPILS,
  corners,
  findShape,
  place,
  roundRect,
  type Shape,
} from './shapes'

export type JoinMode = 'none' | 'horizontal' | 'vertical' | 'both'
export type RotationMode = 'none' | 'random' | 'spiral' | 'radial' | 'wave'
export type GradientMode = 'none' | 'linear' | 'radial'

export interface QrStyle {
  ecc: ErrorCorrection
  /** Quiet zone, in modules. The spec asks for 4; less risks a failed scan. */
  margin: number

  bodyShape: string
  eyeFrameShape: string
  eyePupilShape: string
  join: JoinMode
  /** 0.5 to 1. Shrinks each module without moving its centre. */
  thickness: number
  /** 0 to 1, for the shapes that have corners to round. */
  cornerRadius: number
  rotation: RotationMode
  /** 0 to 1. */
  rotationStrength: number
  /** 0 to 1. Random per-module size variation. */
  jitter: number
  /** Drives every pseudo-random decision, so a style is reproducible. */
  seed: number

  foreground: string
  background: string
  gradient: GradientMode
  gradientStart: string
  gradientEnd: string
  /** Degrees, clockwise from left-to-right. */
  gradientAngle: number

  separateEyeColors: boolean
  eyeFrameColor: string
  eyePupilColor: string
  bodyOutline: boolean
  bodyOutlineColor: string
  eyePupilOutline: boolean
  eyePupilOutlineColor: string

  /** Brand logo id from `BRAND_LOGOS`, or null. */
  logoId: string | null
  /** Data URL of an uploaded logo. Takes precedence over `logoId`. */
  logoDataUrl: string | null
  /** Logo width as a fraction of the symbol. */
  logoSize: number
  /** Paint the code in the brand's own colour. */
  matchLogoColor: boolean
}

export type Fill =
  | { kind: 'solid'; color: string }
  | { kind: 'linear'; x1: number; y1: number; x2: number; y2: number; from: string; to: string }
  | { kind: 'radial'; cx: number; cy: number; r: number; from: string; to: string }

export interface ScenePath {
  id: string
  shapes: Shape[]
  fill: Fill
  stroke?: { color: string; width: number }
}

export interface SceneImage {
  href: string
  x: number
  y: number
  width: number
  height: number
}

export interface QrScene {
  /** Canvas side, in module units, including the quiet zone. */
  size: number
  background: string
  paths: ScenePath[]
  image?: SceneImage
  /** Carried through so the UI can warn about density and version. */
  moduleCount: number
  ecc: ErrorCorrection
}

export function defaultStyle(): QrStyle {
  return {
    ecc: 'M',
    margin: 4,
    bodyShape: 'square',
    eyeFrameShape: 'rounded',
    eyePupilShape: 'rounded',
    join: 'none',
    thickness: 1,
    cornerRadius: 0.4,
    rotation: 'none',
    rotationStrength: 0.4,
    jitter: 0,
    seed: 1,
    foreground: '#0a0a0a',
    background: '#f4f1f1',
    gradient: 'none',
    gradientStart: '#0a0a0a',
    gradientEnd: '#102e4c',
    gradientAngle: 180,
    separateEyeColors: false,
    eyeFrameColor: '#0a0a0a',
    eyePupilColor: '#0a0a0a',
    bodyOutline: false,
    bodyOutlineColor: '#f4f1f1',
    eyePupilOutline: false,
    eyePupilOutlineColor: '#f4f1f1',
    logoId: null,
    logoDataUrl: null,
    logoSize: 0.18,
    matchLogoColor: false,
  }
}

/**
 * Small, fast, seedable PRNG. Rotation and jitter must be stable across
 * re-renders or the code would twitch on every keystroke, so nothing here
 * calls `Math.random`.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A stable per-module random value, independent of iteration order. */
function moduleRandom(seed: number, row: number, col: number, salt: number): number {
  return mulberry32(seed * 73856093 + row * 19349663 + col * 83492791 + salt * 2971215073)()
}

function rotationFor(
  style: QrStyle,
  row: number,
  col: number,
  centre: number,
  maxDist: number,
): number {
  if (style.rotation === 'none' || style.rotationStrength === 0) return 0

  const dx = col + 0.5 - centre
  const dy = row + 0.5 - centre
  const strength = style.rotationStrength

  switch (style.rotation) {
    case 'random':
      return (moduleRandom(style.seed, row, col, 1) * 2 - 1) * Math.PI * strength
    case 'spiral':
      return (Math.hypot(dx, dy) / maxDist) * Math.PI * 2 * strength
    case 'radial':
      return Math.atan2(dy, dx) * strength
    case 'wave':
      return Math.sin((dx + dy) * 0.55) * Math.PI * strength
  }
}

/** Consecutive dark modules in a row, as `[startCol, length]` pairs. */
function horizontalRuns(matrix: QrMatrix, row: number): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  for (let col = 0; col <= matrix.size; col++) {
    const on = col < matrix.size && matrix.cells[row]![col] && !matrix.reserved[row]![col]
    if (on && start < 0) start = col
    if (!on && start >= 0) {
      runs.push([start, col - start])
      start = -1
    }
  }
  return runs
}

function verticalRuns(matrix: QrMatrix, col: number): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  for (let row = 0; row <= matrix.size; row++) {
    const on = row < matrix.size && matrix.cells[row]![col] && !matrix.reserved[row]![col]
    if (on && start < 0) start = row
    if (!on && start >= 0) {
      runs.push([start, row - start])
      start = -1
    }
  }
  return runs
}

/**
 * Builds the body as merged capsules instead of loose modules.
 *
 * `both` draws the horizontal and vertical passes on top of each other rather
 * than tracing the true union outline. They share a fill, so the overlap is
 * invisible, and the result reads as a connected web without needing a
 * polygon-union pass that would have to run on every keystroke.
 */
function joinedBody(matrix: QrMatrix, style: QrStyle, offset: number): Shape[] {
  const shapes: Shape[] = []
  const t = style.thickness
  const r = (style.cornerRadius * t) / 2

  const push = (x: number, y: number, w: number, h: number) => {
    shapes.push(
      place(roundRect(w, h, corners(r * Math.min(w, h) * 2)), {
        cx: offset + x,
        cy: offset + y,
        scale: 1,
      }),
    )
  }

  if (style.join === 'horizontal' || style.join === 'both') {
    for (let row = 0; row < matrix.size; row++) {
      for (const [start, len] of horizontalRuns(matrix, row)) {
        push(start + len / 2, row + 0.5, len - (1 - t), t)
      }
    }
  }
  if (style.join === 'vertical' || style.join === 'both') {
    for (let col = 0; col < matrix.size; col++) {
      for (const [start, len] of verticalRuns(matrix, col)) {
        push(col + 0.5, start + len / 2, t, len - (1 - t))
      }
    }
  }

  return shapes
}

function looseBody(matrix: QrMatrix, style: QrStyle, offset: number): Shape[] {
  const base = findShape(BODY_SHAPES, style.bodyShape).build(style.cornerRadius)
  const centre = matrix.size / 2
  const maxDist = Math.hypot(centre, centre)
  const shapes: Shape[] = []

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.cells[row]![col] || matrix.reserved[row]![col]) continue

      const wobble = style.jitter
        ? 1 + (moduleRandom(style.seed, row, col, 2) * 2 - 1) * style.jitter
        : 1

      shapes.push(
        place(base, {
          cx: offset + col + 0.5,
          cy: offset + row + 0.5,
          scale: style.thickness * wobble,
          rotate: rotationFor(style, row, col, centre, maxDist),
        }),
      )
    }
  }

  return shapes
}

/**
 * @param solid Colour for a flat fill.
 * @param rampStart First gradient stop. Passed in rather than read off the
 *   style because "match logo colour" has to override it too - otherwise the
 *   switch silently does nothing whenever a gradient happens to be on.
 */
function gradientFill(
  style: QrStyle,
  from: number,
  to: number,
  solid: string,
  rampStart: string,
): Fill {
  if (style.gradient === 'none') return { kind: 'solid', color: solid }

  const mid = (from + to) / 2
  const span = to - from

  if (style.gradient === 'radial') {
    return {
      kind: 'radial',
      cx: mid,
      cy: mid,
      r: (span / 2) * Math.SQRT2,
      from: rampStart,
      to: style.gradientEnd,
    }
  }

  const rad = (style.gradientAngle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  // Half-extent of the square projected onto the gradient axis, so the ramp
  // always spans the whole symbol whatever the angle.
  const half = ((Math.abs(dx) + Math.abs(dy)) * span) / 2

  return {
    kind: 'linear',
    x1: mid - dx * half,
    y1: mid - dy * half,
    x2: mid + dx * half,
    y2: mid + dy * half,
    from: rampStart,
    to: style.gradientEnd,
  }
}

/**
 * The logo needs a minimum error-correction level to survive. Rather than
 * silently changing the user's choice we raise the floor only when a logo is
 * actually present, and the UI reflects the effective level back.
 */
export function effectiveEcc(style: QrStyle): ErrorCorrection {
  const hasLogo = Boolean(style.logoDataUrl || style.logoId)
  if (!hasLogo) return style.ecc
  const order: ErrorCorrection[] = ['L', 'M', 'Q', 'H']
  return order.indexOf(style.ecc) < order.indexOf('Q') ? 'Q' : style.ecc
}

const LOGO_VIEWBOX = 24

export function buildScene(payload: string, style: QrStyle): QrScene {
  const ecc = effectiveEcc(style)
  const base = buildMatrix(payload, ecc)
  const hasLogo = Boolean(style.logoDataUrl || style.logoId)

  // The hole is slightly wider than the logo so the plate has clean edges.
  const matrix = hasLogo ? punchLogoHole(base, style.logoSize * 1.25) : base

  const offset = style.margin
  const canvas = matrix.size + style.margin * 2
  const symbolFrom = offset
  const symbolTo = offset + matrix.size

  const brand = style.logoDataUrl ? null : style.logoId ? findBrandLogo(style.logoId) : null
  const matched = style.matchLogoColor && brand ? brand.hex : null
  const foreground = matched ?? style.foreground
  const rampStart = matched ?? style.gradientStart

  const bodyFill = gradientFill(style, symbolFrom, symbolTo, foreground, rampStart)
  const paths: ScenePath[] = []

  const bodyShapes =
    style.join === 'none' ? looseBody(matrix, style, offset) : joinedBody(matrix, style, offset)

  paths.push({
    id: 'body',
    shapes: bodyShapes,
    fill: bodyFill,
    stroke: style.bodyOutline
      ? { color: style.bodyOutlineColor, width: 0.09 }
      : undefined,
  })

  // Eyes. Frames and pupils are two paths so they can carry separate colours,
  // and both are drawn after the body so nothing overlaps them.
  const frame = findShape(EYE_FRAMES, style.eyeFrameShape).build(style.cornerRadius)
  const pupil = findShape(EYE_PUPILS, style.eyePupilShape).build(style.cornerRadius)
  const frameShapes: Shape[] = []
  const pupilShapes: Shape[] = []

  for (const eye of matrix.eyes) {
    const cx = offset + eye.col + 3.5
    const cy = offset + eye.row + 3.5
    frameShapes.push(place(frame, { cx, cy, scale: 1 }))
    pupilShapes.push(place(pupil, { cx, cy, scale: 1 }))
  }

  const eyeFill: Fill = style.separateEyeColors
    ? { kind: 'solid', color: style.eyeFrameColor }
    : bodyFill
  const pupilFill: Fill = style.separateEyeColors
    ? { kind: 'solid', color: style.eyePupilColor }
    : bodyFill

  paths.push({ id: 'eye-frames', shapes: frameShapes, fill: eyeFill })
  paths.push({
    id: 'eye-pupils',
    shapes: pupilShapes,
    fill: pupilFill,
    stroke: style.eyePupilOutline
      ? { color: style.eyePupilOutlineColor, width: 0.12 }
      : undefined,
  })

  const scene: QrScene = {
    size: canvas,
    background: style.background,
    paths,
    moduleCount: matrix.size,
    ecc,
  }

  if (!hasLogo) return scene

  const logoSide = matrix.size * style.logoSize
  const logoX = offset + (matrix.size - logoSide) / 2
  const logoY = logoX
  const pad = logoSide * 0.14

  // A plate in the background colour, so the logo never sits on a module edge.
  paths.push({
    id: 'logo-plate',
    shapes: [
      place(
        roundRect(logoSide + pad * 2, logoSide + pad * 2, corners((logoSide + pad * 2) * 0.16)),
        { cx: offset + matrix.size / 2, cy: offset + matrix.size / 2, scale: 1 },
      ),
    ],
    fill: { kind: 'solid', color: style.background },
  })

  if (style.logoDataUrl) {
    scene.image = { href: style.logoDataUrl, x: logoX, y: logoY, width: logoSide, height: logoSide }
    return scene
  }

  if (brand) {
    const k = logoSide / LOGO_VIEWBOX
    const parsed = parsePathData(brand.path)
    // simple-icons marks are drawn from the top-left of a 24x24 box, so shift
    // to the origin before `place` re-centres them.
    const centred = parsed.map((cmd) => {
      if (cmd.c === 'Z') return cmd
      const shift = (v: number) => v - LOGO_VIEWBOX / 2
      if (cmd.c === 'C') {
        return {
          c: 'C' as const,
          x1: shift(cmd.x1), y1: shift(cmd.y1),
          x2: shift(cmd.x2), y2: shift(cmd.y2),
          x: shift(cmd.x), y: shift(cmd.y),
        }
      }
      return { c: cmd.c, x: shift(cmd.x), y: shift(cmd.y) }
    })

    paths.push({
      id: 'logo',
      shapes: [
        place(centred, {
          cx: offset + matrix.size / 2,
          cy: offset + matrix.size / 2,
          scale: k,
        }),
      ],
      fill: { kind: 'solid', color: readableBrandColor(brand.hex, style.background) },
    })
  }

  return scene
}

/**
 * Brand hexes are chosen against white. Several of them (X, TikTok, Apple) are
 * pure black, which disappears on a dark code. When the mark would be all but
 * invisible on the plate, fall back to whichever of black or white reads.
 */
export function readableBrandColor(hex: string, plate: string): string {
  return contrastRatio(hex, plate) >= 1.8 ? hex : contrastRatio('#ffffff', plate) > 3 ? '#ffffff' : '#000000'
}

export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.padEnd(6, '0').slice(0, 6)
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ]
}

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  )
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * How likely this code is to actually scan.
 *
 * Decoders binarise the image before they do anything else, so the only thing
 * that matters is luminance separation between the modules and the paper -
 * not hue, and not whether the palette looks good. Below about 3:1 phone
 * cameras start failing in anything but ideal light.
 */
export function scanRisk(style: QrStyle): { level: 'ok' | 'warn' | 'bad'; message: string } | null {
  const darkest =
    style.gradient === 'none'
      ? style.foreground
      : relativeLuminance(style.gradientStart) > relativeLuminance(style.gradientEnd)
        ? style.gradientStart
        : style.gradientEnd

  const ratio = contrastRatio(darkest, style.background)

  if (ratio < 2.5) {
    return { level: 'bad', message: 'Too little contrast between the code and its background to scan reliably.' }
  }
  if (ratio < 4) {
    return { level: 'warn', message: 'Low contrast. Test this one on a phone before you use it.' }
  }
  if (relativeLuminance(style.foreground) > relativeLuminance(style.background)) {
    return { level: 'warn', message: 'Light code on a dark background. Some older scanners will not invert.' }
  }
  if (style.logoSize > 0.26 && (style.logoId || style.logoDataUrl)) {
    return { level: 'warn', message: 'Large logo. Scan-test it, or drop the size below 25%.' }
  }
  if (style.thickness < 0.62) {
    return { level: 'warn', message: 'Thin modules can wash out at small print sizes.' }
  }
  return null
}
