/**
 * The module shape library.
 *
 * Shapes are built as command lists in a unit box centred on the origin
 * (-0.5..0.5 on both axes) rather than as SVG path strings, for two reasons:
 *
 *  1. Rotation and size jitter are applied per module. Transforming a list of
 *     points is trivial; transforming a path string is not.
 *  2. The PDF and EPS exporters are vector, not screenshots of the preview.
 *     They walk the same command list the SVG does, so a shape only has to be
 *     drawn once and every format agrees on it.
 *
 * Every shape therefore uses only move / line / cubic / close. No arcs: an arc
 * is the one SVG command with no direct PDF or PostScript equivalent, and
 * circles built from four cubics are visually exact anyway.
 */

export type PathCmd =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Z' }

export type Shape = PathCmd[]

/**
 * Distance from a circle's quadrant endpoint to its bezier control point, as a
 * fraction of the radius. The classic four-cubic circle approximation; error
 * peaks around 0.02% of the radius, which is invisible at any print size.
 */
const KAPPA = 0.5522847498307936

export interface Corners {
  tl: number
  tr: number
  br: number
  bl: number
}

export function corners(tl: number, tr = tl, br = tl, bl = tr): Corners {
  return { tl, tr, br, bl }
}

/**
 * Rounded rectangle centred on the origin, with independent corner radii.
 *
 * This single primitive covers square, rounded, circle, leaf, teardrop and
 * arch: they differ only in which corners are rounded and by how much.
 *
 * @param reverse Emit the path anticlockwise. Used to cut a hole out of an
 *   enclosing path under the nonzero winding rule, which is how the eye frames
 *   and the ring module get their centres knocked out.
 */
export function roundRect(w: number, h: number, r: Corners, reverse = false): Shape {
  const cap = Math.min(w, h) / 2
  const tl = Math.max(0, Math.min(r.tl, cap))
  const tr = Math.max(0, Math.min(r.tr, cap))
  const br = Math.max(0, Math.min(r.br, cap))
  const bl = Math.max(0, Math.min(r.bl, cap))

  const x0 = -w / 2
  const x1 = w / 2
  const y0 = -h / 2
  const y1 = h / 2

  const out: Shape = [
    { c: 'M', x: x0 + tl, y: y0 },
    { c: 'L', x: x1 - tr, y: y0 },
    arc(x1 - tr, y0, x1, y0 + tr, 1),
    { c: 'L', x: x1, y: y1 - br },
    arc(x1, y1 - br, x1 - br, y1, 2),
    { c: 'L', x: x0 + bl, y: y1 },
    arc(x0 + bl, y1, x0, y1 - bl, 3),
    { c: 'L', x: x0, y: y0 + tl },
    arc(x0, y0 + tl, x0 + tl, y0, 0),
    { c: 'Z' },
  ]

  return reverse ? reverseShape(out) : out
}

/**
 * One quarter-circle corner as a cubic. `quadrant` runs clockwise from the
 * top-left corner, which is the order `roundRect` walks the outline in.
 */
function arc(fx: number, fy: number, tx: number, ty: number, quadrant: number): PathCmd {
  const k = KAPPA
  // The control points sit on the tangents, which are axis-aligned at both
  // ends of a quarter circle, so each one only moves along a single axis.
  const dx = tx - fx
  const dy = ty - fy
  const horizontalFirst = quadrant === 0 || quadrant === 2
  return horizontalFirst
    ? { c: 'C', x1: fx, y1: fy + dy * k, x2: tx - dx * k, y2: ty, x: tx, y: ty }
    : { c: 'C', x1: fx + dx * k, y1: fy, x2: tx, y2: ty - dy * k, x: tx, y: ty }
}

/** Reverses winding direction while keeping the same outline. */
export function reverseShape(shape: Shape): Shape {
  const points: PathCmd[] = shape.filter((cmd) => cmd.c !== 'Z')
  if (points.length === 0) return shape

  const first = points[0] as Extract<PathCmd, { c: 'M' }>
  const out: Shape = [{ c: 'M', x: first.x, y: first.y }]

  // Walk backwards; each segment's endpoint becomes the previous point, and
  // cubic control points swap.
  for (let i = points.length - 1; i >= 1; i--) {
    const seg = points[i]!
    const prev = points[i - 1]!
    const px = 'x' in prev ? prev.x : 0
    const py = 'y' in prev ? prev.y : 0
    if (seg.c === 'C') {
      out.push({ c: 'C', x1: seg.x2, y1: seg.y2, x2: seg.x1, y2: seg.y1, x: px, y: py })
    } else {
      out.push({ c: 'L', x: px, y: py })
    }
  }

  out.push({ c: 'Z' })
  return out
}

function polygon(points: readonly (readonly [number, number])[]): Shape {
  const out: Shape = [{ c: 'M', x: points[0]![0], y: points[0]![1] }]
  for (let i = 1; i < points.length; i++) out.push({ c: 'L', x: points[i]![0], y: points[i]![1] })
  out.push({ c: 'Z' })
  return out
}

/** Regular n-gon inscribed in a circle of radius `r`, first vertex pointing up. */
function regular(n: number, r: number, phase = -Math.PI / 2): Shape {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = phase + (i * 2 * Math.PI) / n
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return polygon(pts)
}

/** Alternating outer/inner vertices, first point up. */
function star(points: number, outer: number, inner: number): Shape {
  const pts: [number, number][] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / points
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return polygon(pts)
}

const HALF = 0.5

/** Four rounded petals around a small square core. */
function flower(): Shape {
  const a = 0.24
  // A cubic bulges to roughly three quarters of the way to its control point,
  // so the petals are steered past the cell edge to land exactly on it.
  const b = 0.5 + (0.5 - a) / 3
  return [
    { c: 'M', x: -a, y: -a },
    { c: 'C', x1: -a, y1: -b, x2: a, y2: -b, x: a, y: -a },
    { c: 'C', x1: b, y1: -a, x2: b, y2: a, x: a, y: a },
    { c: 'C', x1: a, y1: b, x2: -a, y2: b, x: -a, y: a },
    { c: 'C', x1: -b, y1: a, x2: -b, y2: -a, x: -a, y: -a },
    { c: 'Z' },
  ]
}

/** Square with the corners scooped inward. */
function clover(): Shape {
  const e = 0.5
  const i = 0.26
  const k = 0.3
  return [
    { c: 'M', x: -i, y: -e },
    { c: 'L', x: i, y: -e },
    { c: 'C', x1: i, y1: -k, x2: k, y2: -i, x: e, y: -i },
    { c: 'L', x: e, y: i },
    { c: 'C', x1: k, y1: i, x2: i, y2: k, x: i, y: e },
    { c: 'L', x: -i, y: e },
    { c: 'C', x1: -i, y1: k, x2: -k, y2: i, x: -e, y: i },
    { c: 'L', x: -e, y: -i },
    { c: 'C', x1: -k, y1: -i, x2: -i, y2: -k, x: -i, y: -e },
    { c: 'Z' },
  ]
}

/** Four-pointed sparkle with concave sides. */
function sparkle(): Shape {
  const t = 0.11
  return [
    { c: 'M', x: 0, y: -HALF },
    { c: 'C', x1: t * 0.6, y1: -t * 1.4, x2: t * 1.4, y2: -t * 0.6, x: HALF, y: 0 },
    { c: 'C', x1: t * 1.4, y1: t * 0.6, x2: t * 0.6, y2: t * 1.4, x: 0, y: HALF },
    { c: 'C', x1: -t * 0.6, y1: t * 1.4, x2: -t * 1.4, y2: t * 0.6, x: -HALF, y: 0 },
    { c: 'C', x1: -t * 1.4, y1: -t * 0.6, x2: -t * 0.6, y2: -t * 1.4, x: 0, y: -HALF },
    { c: 'Z' },
  ]
}

function heart(): Shape {
  return [
    { c: 'M', x: 0, y: 0.46 },
    { c: 'C', x1: -0.56, y1: 0.06, x2: -0.5, y2: -0.24, x: -0.26, y: -0.34 },
    { c: 'C', x1: -0.12, y1: -0.4, x2: -0.03, y2: -0.3, x: 0, y: -0.2 },
    { c: 'C', x1: 0.03, y1: -0.3, x2: 0.12, y2: -0.4, x: 0.26, y: -0.34 },
    { c: 'C', x1: 0.5, y1: -0.24, x2: 0.56, y2: 0.06, x: 0, y: 0.46 },
    { c: 'Z' },
  ]
}

function cloud(): Shape {
  return [
    { c: 'M', x: -0.46, y: 0.3 },
    { c: 'L', x: 0.46, y: 0.3 },
    { c: 'C', x1: 0.46, y1: 0.06, x2: 0.36, y2: -0.08, x: 0.2, y: -0.12 },
    { c: 'C', x1: 0.18, y1: -0.36, x2: -0.02, y2: -0.48, x: -0.2, y: -0.36 },
    { c: 'C', x1: -0.36, y1: -0.4, x2: -0.46, y2: -0.24, x: -0.46, y: -0.02 },
    { c: 'Z' },
  ]
}

function bolt(): Shape {
  return polygon([
    [0.1, -0.5],
    [-0.36, 0.08],
    [-0.03, 0.08],
    [-0.1, 0.5],
    [0.36, -0.06],
    [0.03, -0.06],
  ])
}

function spade(): Shape {
  return [
    { c: 'M', x: 0, y: -0.48 },
    { c: 'C', x1: -0.1, y1: -0.26, x2: -0.46, y2: -0.1, x: -0.46, y: 0.11 },
    { c: 'C', x1: -0.46, y1: 0.3, x2: -0.24, y2: 0.36, x: -0.09, y: 0.23 },
    { c: 'C', x1: -0.11, y1: 0.36, x2: -0.17, y2: 0.44, x: -0.25, y: 0.48 },
    { c: 'L', x: 0.25, y: 0.48 },
    { c: 'C', x1: 0.17, y1: 0.44, x2: 0.11, y2: 0.36, x: 0.09, y: 0.23 },
    { c: 'C', x1: 0.24, y1: 0.36, x2: 0.46, y2: 0.3, x: 0.46, y: 0.11 },
    { c: 'C', x1: 0.46, y1: -0.1, x2: 0.1, y2: -0.26, x: 0, y: -0.48 },
    { c: 'Z' },
  ]
}

function shield(): Shape {
  return [
    { c: 'M', x: -0.42, y: -0.46 },
    { c: 'L', x: 0.42, y: -0.46 },
    { c: 'L', x: 0.42, y: 0.02 },
    { c: 'C', x1: 0.42, y1: 0.3, x2: 0.2, y2: 0.44, x: 0, y: 0.5 },
    { c: 'C', x1: -0.2, y1: 0.44, x2: -0.42, y2: 0.3, x: -0.42, y: 0.02 },
    { c: 'Z' },
  ]
}

/** Two concentric rounded rects, the inner one reversed to cut the hole. */
function ring(radius: number, thickness = 0.3): Shape {
  const r = radius * HALF
  const inner = 1 - thickness * 2
  return [...roundRect(1, 1, corners(r)), ...roundRect(inner, inner, corners(Math.max(0, r - thickness)), true)]
}

export interface ShapeDef {
  id: string
  label: string
  /** @param radius Corner-radius slider, 0..1. Ignored by shapes with no corners. */
  build: (radius: number) => Shape
}

/**
 * Body module shapes. Order is the order the picker renders them in, roughly
 * grouped: geometric, then rounded, then pictorial.
 */
export const BODY_SHAPES: readonly ShapeDef[] = [
  { id: 'square', label: 'Square', build: (r) => roundRect(1, 1, corners(r * HALF)) },
  { id: 'circle', label: 'Circle', build: () => roundRect(1, 1, corners(HALF)) },
  { id: 'dot', label: 'Dot', build: () => roundRect(0.68, 0.68, corners(0.34)) },
  { id: 'diamond', label: 'Diamond', build: () => regular(4, HALF) },
  { id: 'hexagon', label: 'Hexagon', build: () => regular(6, HALF, 0) },
  { id: 'pentagon', label: 'Pentagon', build: () => regular(5, HALF) },
  { id: 'triangle', label: 'Triangle', build: () => polygon([[0, -HALF], [HALF, HALF], [-HALF, HALF]]) },
  { id: 'vbar', label: 'Vertical bar', build: (r) => roundRect(0.46, 1, corners(r * 0.23)) },
  { id: 'hbar', label: 'Horizontal bar', build: (r) => roundRect(1, 0.46, corners(r * 0.23)) },
  { id: 'leaf', label: 'Leaf', build: () => roundRect(1, 1, corners(HALF, 0, HALF, 0)) },
  { id: 'leaf-alt', label: 'Leaf, mirrored', build: () => roundRect(1, 1, corners(0, HALF, 0, HALF)) },
  { id: 'drop', label: 'Teardrop', build: () => roundRect(1, 1, corners(0, HALF, HALF, HALF)) },
  { id: 'arch', label: 'Arch', build: () => roundRect(1, 1, corners(HALF, HALF, 0, 0)) },
  { id: 'plus', label: 'Plus', build: () => plus(0.28) },
  { id: 'cross', label: 'Cross', build: () => plus(0.16) },
  { id: 'clover', label: 'Clover', build: clover },
  { id: 'flower', label: 'Flower', build: flower },
  { id: 'sparkle', label: 'Sparkle', build: sparkle },
  { id: 'star4', label: 'Four-point star', build: () => star(4, HALF, 0.18) },
  { id: 'star5', label: 'Five-point star', build: () => star(5, HALF, 0.21) },
  { id: 'star6', label: 'Six-point star', build: () => star(6, HALF, 0.26) },
  { id: 'heart', label: 'Heart', build: heart },
  { id: 'cloud', label: 'Cloud', build: cloud },
  { id: 'bolt', label: 'Bolt', build: bolt },
  { id: 'spade', label: 'Spade', build: spade },
  { id: 'shield', label: 'Shield', build: shield },
  { id: 'hourglass', label: 'Hourglass', build: () => polygon([[-0.42, -0.46], [0.42, -0.46], [0.07, 0], [0.42, 0.46], [-0.42, 0.46], [-0.07, 0]]) },
  { id: 'chevron', label: 'Chevron', build: () => polygon([[0, -0.46], [0.48, 0.04], [0.48, 0.46], [0, -0.04], [-0.48, 0.46], [-0.48, 0.04]]) },
  { id: 'arrow', label: 'Arrow', build: () => polygon([[0, -0.5], [0.44, -0.04], [0.17, -0.04], [0.17, 0.5], [-0.17, 0.5], [-0.17, -0.04], [-0.44, -0.04]]) },
  { id: 'ring', label: 'Ring', build: (r) => ring(r) },
]

/** Greek cross with arms of the given half-width. */
function plus(arm: number): Shape {
  return polygon([
    [-arm, -HALF],
    [arm, -HALF],
    [arm, -arm],
    [HALF, -arm],
    [HALF, arm],
    [arm, arm],
    [arm, HALF],
    [-arm, HALF],
    [-arm, arm],
    [-HALF, arm],
    [-HALF, -arm],
    [-arm, -arm],
  ])
}

/**
 * Eye frames. A finder pattern is a 7x7 ring one module thick, so each frame
 * is an outer outline with a 5x5 hole cut out of it. Radii are expressed in
 * module units, where the whole frame is 7 wide.
 */
export const EYE_FRAMES: readonly ShapeDef[] = [
  { id: 'square', label: 'Square', build: (r) => eyeFrame(corners(r * 1.6)) },
  { id: 'rounded', label: 'Rounded', build: () => eyeFrame(corners(1.8)) },
  { id: 'circle', label: 'Circle', build: () => eyeFrame(corners(3.5)) },
  { id: 'cushion', label: 'Cushion', build: () => eyeFrame(corners(1.0)) },
  { id: 'leaf', label: 'Leaf', build: () => eyeFrame(corners(3.5, 0, 3.5, 0)) },
  { id: 'leaf-alt', label: 'Leaf, mirrored', build: () => eyeFrame(corners(0, 3.5, 0, 3.5)) },
  { id: 'drop', label: 'Teardrop', build: () => eyeFrame(corners(0, 3.5, 3.5, 3.5)) },
  { id: 'drop-alt', label: 'Teardrop, mirrored', build: () => eyeFrame(corners(3.5, 3.5, 3.5, 0)) },
  { id: 'arch', label: 'Arch', build: () => eyeFrame(corners(3.5, 3.5, 0, 0)) },
]

function eyeFrame(outer: Corners): Shape {
  const inner: Corners = {
    tl: Math.max(0, outer.tl - 1),
    tr: Math.max(0, outer.tr - 1),
    br: Math.max(0, outer.br - 1),
    bl: Math.max(0, outer.bl - 1),
  }
  return [...roundRect(7, 7, outer), ...roundRect(5, 5, inner, true)]
}

/** Eye pupils, drawn in the 3x3 module core of a finder pattern. */
export const EYE_PUPILS: readonly ShapeDef[] = [
  { id: 'square', label: 'Square', build: (r) => scaleShape(roundRect(1, 1, corners(r * HALF)), 3) },
  { id: 'rounded', label: 'Rounded', build: () => scaleShape(roundRect(1, 1, corners(0.28)), 3) },
  { id: 'circle', label: 'Circle', build: () => scaleShape(roundRect(1, 1, corners(HALF)), 3) },
  { id: 'diamond', label: 'Diamond', build: () => scaleShape(regular(4, 0.62), 3) },
  { id: 'leaf', label: 'Leaf', build: () => scaleShape(roundRect(1, 1, corners(HALF, 0, HALF, 0)), 3) },
  { id: 'drop', label: 'Teardrop', build: () => scaleShape(roundRect(1, 1, corners(0, HALF, HALF, HALF)), 3) },
  { id: 'flower', label: 'Flower', build: () => scaleShape(flower(), 3) },
  { id: 'clover', label: 'Clover', build: () => scaleShape(clover(), 3) },
  { id: 'sparkle', label: 'Sparkle', build: () => scaleShape(sparkle(), 3) },
  { id: 'star4', label: 'Star', build: () => scaleShape(star(4, 0.56, 0.2), 3) },
]

export function scaleShape(shape: Shape, k: number): Shape {
  return shape.map((cmd) => {
    if (cmd.c === 'Z') return cmd
    if (cmd.c === 'C') {
      return { c: 'C', x1: cmd.x1 * k, y1: cmd.y1 * k, x2: cmd.x2 * k, y2: cmd.y2 * k, x: cmd.x * k, y: cmd.y * k }
    }
    return { c: cmd.c, x: cmd.x * k, y: cmd.y * k }
  })
}

export interface Placement {
  /** Centre of the shape, in module coordinates. */
  cx: number
  cy: number
  scale: number
  /** Radians, clockwise in screen space. */
  rotate?: number
}

/** Applies rotate, then scale, then translate. */
export function place(shape: Shape, at: Placement): Shape {
  const { cx, cy, scale, rotate = 0 } = at
  const cos = Math.cos(rotate)
  const sin = Math.sin(rotate)

  const map = (x: number, y: number): [number, number] => [
    cx + (x * cos - y * sin) * scale,
    cy + (x * sin + y * cos) * scale,
  ]

  return shape.map((cmd) => {
    if (cmd.c === 'Z') return cmd
    if (cmd.c === 'C') {
      const [x1, y1] = map(cmd.x1, cmd.y1)
      const [x2, y2] = map(cmd.x2, cmd.y2)
      const [x, y] = map(cmd.x, cmd.y)
      return { c: 'C', x1, y1, x2, y2, x, y }
    }
    const [x, y] = map(cmd.x, cmd.y)
    return { c: cmd.c, x, y }
  })
}

const PRECISION = 3

function n(value: number): string {
  const rounded = Number(value.toFixed(PRECISION))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/** Serialises one or more shapes into a single SVG `d` attribute. */
export function toPathData(shapes: readonly Shape[]): string {
  const out: string[] = []
  for (const shape of shapes) {
    for (const cmd of shape) {
      switch (cmd.c) {
        case 'M':
          out.push(`M${n(cmd.x)} ${n(cmd.y)}`)
          break
        case 'L':
          out.push(`L${n(cmd.x)} ${n(cmd.y)}`)
          break
        case 'C':
          out.push(`C${n(cmd.x1)} ${n(cmd.y1)} ${n(cmd.x2)} ${n(cmd.y2)} ${n(cmd.x)} ${n(cmd.y)}`)
          break
        case 'Z':
          out.push('Z')
          break
      }
    }
  }
  return out.join('')
}

export function findShape(list: readonly ShapeDef[], id: string): ShapeDef {
  return list.find((s) => s.id === id) ?? list[0]!
}
