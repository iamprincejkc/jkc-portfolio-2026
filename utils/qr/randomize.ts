/**
 * "Randomize style", and the locks that hold parts of it still.
 *
 * The randomiser is deliberately not uniform over the option space. A QR code
 * only works if the modules stay darker than the paper, so colours are drawn
 * from curated pairs rather than from the full RGB cube, and thickness never
 * drops far enough to break a scan. Randomising into an unscannable code is
 * not a fun surprise.
 */
import { BODY_SHAPES, EYE_FRAMES, EYE_PUPILS } from './shapes'
import type { GradientMode, JoinMode, QrStyle, RotationMode } from './render'

/** A facet the user can lock so a reroll leaves it alone. */
export type StyleFacet = 'shape' | 'rotation' | 'eyes' | 'layout' | 'gradient' | 'colors'

export const STYLE_FACETS: readonly { id: StyleFacet; label: string }[] = [
  { id: 'shape', label: 'Module shape' },
  { id: 'rotation', label: 'Rotation and jitter' },
  { id: 'eyes', label: 'Eye shapes' },
  { id: 'layout', label: 'Join and thickness' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'colors', label: 'Colours' },
]

/**
 * Foreground / background pairs, every one of them above 7:1. The backgrounds
 * are off-white or very pale so the code still reads as a code.
 */
const COLOR_PAIRS: readonly [string, string][] = [
  ['#0a0a0a', '#f4f1f1'],
  ['#101820', '#f7f4ec'],
  ['#1b1b3a', '#f2f0ff'],
  ['#0f3d3e', '#f0f7f5'],
  ['#3d1f2f', '#fdf2f4'],
  ['#20293a', '#eef2f8'],
  ['#2b1810', '#faf3e8'],
  ['#0d2818', '#eef7f0'],
  ['#31123e', '#f8f0fb'],
  ['#7c1d1d', '#fdf1ee'],
  ['#123a5c', '#eef5fb'],
  ['#3a2c0f', '#fbf6e9'],
]

/** Second stops for a gradient, paired with a foreground by index. */
const GRADIENT_PARTNERS: readonly string[] = [
  '#102e4c',
  '#3b1d5e',
  '#0f5132',
  '#6b1d3a',
  '#1d3557',
  '#4a2511',
  '#2d3142',
  '#5c2018',
]

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)]!
}

function chance(random: () => number, probability: number): boolean {
  return random() < probability
}

export interface RandomizeOptions {
  /** Facets to leave exactly as they are. */
  locked: ReadonlySet<StyleFacet>
  random?: () => number
}

export function randomizeStyle(style: QrStyle, options: RandomizeOptions): QrStyle {
  const random = options.random ?? Math.random
  const locked = options.locked
  const next: QrStyle = { ...style, seed: Math.floor(random() * 2 ** 31) }

  if (!locked.has('shape')) {
    next.bodyShape = pick(BODY_SHAPES, random).id
    next.cornerRadius = Math.round(random() * 10) / 10
  }

  if (!locked.has('eyes')) {
    next.eyeFrameShape = pick(EYE_FRAMES, random).id
    next.eyePupilShape = pick(EYE_PUPILS, random).id
  }

  if (!locked.has('layout')) {
    const joins: JoinMode[] = ['none', 'none', 'none', 'horizontal', 'vertical', 'both']
    next.join = pick(joins, random)
    // Below ~0.7 the gaps start to dominate, which reads as noise rather than
    // as a style, so the floor sits there.
    next.thickness = 0.7 + Math.round(random() * 6) / 20
  }

  if (!locked.has('rotation')) {
    const modes: RotationMode[] = ['none', 'none', 'random', 'spiral', 'radial', 'wave']
    next.rotation = pick(modes, random)
    next.rotationStrength = Math.round(random() * 8) / 10
    next.jitter = chance(random, 0.35) ? Math.round(random() * 4) / 10 : 0
  }

  if (!locked.has('colors')) {
    const index = Math.floor(random() * COLOR_PAIRS.length)
    const [fg, bg] = COLOR_PAIRS[index]!
    next.foreground = fg
    next.background = bg
    next.gradientStart = fg
    // Outlines only make sense in the background colour; anything else muddies
    // the module edges.
    next.bodyOutlineColor = bg
    next.eyePupilOutlineColor = bg
    next.bodyOutline = chance(random, 0.3)

    next.separateEyeColors = chance(random, 0.25)
    if (next.separateEyeColors) {
      next.eyeFrameColor = fg
      next.eyePupilColor = pick(GRADIENT_PARTNERS, random)
    }
  }

  if (!locked.has('gradient')) {
    const modes: GradientMode[] = ['none', 'none', 'linear', 'radial']
    next.gradient = pick(modes, random)
    next.gradientEnd = pick(GRADIENT_PARTNERS, random)
    next.gradientAngle = Math.round(random() * 12) * 30
  }

  return next
}
