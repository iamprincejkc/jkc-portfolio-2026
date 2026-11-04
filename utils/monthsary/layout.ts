/**
 * Where everything sits on /monthsary, for any viewport.
 *
 * The screen is stacked in bands: the photo-mosaic words on top, the cake
 * under them, and a caption line at the very bottom (the wish hint, then the
 * message once the candle is out - that one is placed by CSS, because it needs
 * the safe-area inset). The scene, the cake and the tests all read this one
 * function, so they cannot disagree about where the words end and the cake
 * begins.
 */

export type Box = { x: number; y: number; width: number; height: number }

export type MonthsaryLayout = {
  width: number
  height: number
  /** The words, one entry per line. */
  lines: readonly string[]
  /** Where the mosaic words are fitted. */
  text: Box
  /**
   * The cake SVG's box, in CSS pixels. Far taller than the cake itself: the
   * layers fall in from above, so most of the box is empty sky.
   */
  cake: Box
  /** Roughly how many tiles the words are built from. */
  tiles: number
  /** Tiles drifting on the opening wall, before the tornado takes them. */
  heroes: number
  /** The band fireworks burst in, in pixels from the top. */
  sky: { top: number; bottom: number }
  tall: boolean
}

export const WIDE_LINES = ['Happy Monthsary', 'Langga'] as const
export const TALL_LINES = ['Happy', 'Monthsary', 'Langga'] as const

/** The cake SVG's own coordinate space - see cake.json. */
export const CAKE_VIEWBOX = { width: 200, height: 500 } as const

/** Where the plate sits, in viewBox units. */
export const CAKE_PLATE_Y = 480

/** Top of the flame at the height of its flicker: the cake's highest point. */
export const CAKE_FLAME_TOP_Y = 330

/**
 * Below this aspect ratio the words go over three lines. "Happy Monthsary" on
 * one line of a phone would leave every tile two or three pixels wide.
 */
const TALL_ASPECT = 0.9

/** The cake never grows past this, however big the screen. */
const CAKE_MAX_WIDTH = 460

export function monthsaryLayout(width: number, height: number): MonthsaryLayout {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const tall = w / h < TALL_ASPECT

  /*
   * On a phone the words get every pixel the cake can spare: "Monthsary" is
   * the widest line and sets the font size, so the side gutter is as narrow as
   * it can be, and the band is tall enough that the size is never cut by height.
   */
  const gutter = Math.max(16, w * (tall ? 0.04 : 0.07))
  const text: Box = {
    x: gutter,
    y: h * (tall ? 0.05 : 0.06),
    width: w - gutter * 2,
    height: h * (tall ? 0.45 : 0.38),
  }

  /*
   * The cake fills the band between the words and the caption. Its visible
   * height is the flame-to-plate span, so the width is solved from that
   * rather than from the SVG's full 500-unit box.
   */
  const bandTop = h * (tall ? 0.52 : 0.49)
  const plateY = h * (tall ? 0.86 : 0.85)
  const visiblePerWidth = (CAKE_PLATE_Y - CAKE_FLAME_TOP_Y) / CAKE_VIEWBOX.width
  const cakeWidth = Math.min((plateY - bandTop) / visiblePerWidth, w * 0.82, CAKE_MAX_WIDTH)
  const unit = cakeWidth / CAKE_VIEWBOX.width
  const cake: Box = {
    x: (w - cakeWidth) / 2,
    y: plateY - CAKE_PLATE_Y * unit,
    width: cakeWidth,
    height: CAKE_VIEWBOX.height * unit,
  }

  /*
   * Tiers like the gallery wall's, but tuned for legibility rather than for
   * how many photos are recognisable: below about four tiles across a stroke,
   * an "s" or a "g" stops reading as a letter. Phones need the most, because
   * their letters are the smallest. It is one instanced draw call either way.
   */
  const tiles = w < 640 ? 1400 : w < 1024 ? 1500 : 1600
  const heroes = w < 640 ? 32 : w < 1024 ? 44 : 56

  /*
   * On a wide screen there is sky either side of the words. On a phone the
   * words span the width, so bursts also use the gap between them and the
   * candle - otherwise every one of them goes off behind the letters.
   */
  const flameTop = cake.y + CAKE_FLAME_TOP_Y * unit
  const sky = tall ? { top: h * 0.06, bottom: flameTop - h * 0.04 } : { top: h * 0.08, bottom: h * 0.42 }

  return { width: w, height: h, lines: tall ? TALL_LINES : WIDE_LINES, text, cake, tiles, heroes, sky, tall }
}

/**
 * Whether a resize moved far enough that the words must be laid out again. A
 * phone's address bar sliding in is not a reason; a rotation is.
 */
export function needsRelayout(from: MonthsaryLayout, width: number, height: number): boolean {
  const next = monthsaryLayout(width, height)
  if (next.tall !== from.tall) return true
  return Math.abs(next.width - from.width) > from.width * 0.15 || Math.abs(next.height - from.height) > from.height * 0.2
}
