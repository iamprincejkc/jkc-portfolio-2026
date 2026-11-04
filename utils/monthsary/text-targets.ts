/**
 * Turning words into tile positions.
 *
 * The words are drawn white-on-transparent into a canvas the size of the text
 * box; everything here then works on that canvas's pixels, so none of it needs
 * a DOM and all of it is unit-tested. Each square of a grid laid over the
 * glyphs becomes one tile if enough of it is ink.
 */

export type Point = { x: number; y: number }

export type Mask = {
  data: ArrayLike<number>
  width: number
  height: number
  /** Bytes per pixel. 4 for `ImageData`, where alpha is the last byte. */
  stride?: number
}

export type LineMetrics = { width: number; ascent: number; descent: number }

export type FittedWords = {
  fontSize: number
  /** Left edge and baseline of each line, in mask pixels. */
  lines: { x: number; baseline: number }[]
  /** The heart after the last line: centre and width, in mask pixels. */
  heart: { x: number; y: number; width: number } | null
}

/** The heart after the last word, in ems. */
export const HEART = { gap: 0.2, width: 0.62, lift: 0.36 } as const

const alphaAt = (mask: Mask, index: number) => {
  const stride = mask.stride ?? 1
  return mask.data[index * stride + stride - 1]
}

/** How many pixels of the mask are ink. */
export function inkArea(mask: Mask, threshold = 128): number {
  let area = 0
  const total = mask.width * mask.height
  for (let i = 0; i < total; i += 1) if (alphaAt(mask, i) >= threshold) area += 1
  return area
}

/**
 * The grid pitch that turns `area` pixels of ink into roughly `tiles` tiles.
 *
 * Clamped so a tiny screen still gets tiles big enough to see, and a huge one
 * does not end up with fifty-pixel bricks.
 */
export function pitchFor(area: number, tiles: number, min = 4, max = 36): number {
  if (area <= 0 || tiles <= 0) return max
  return Math.max(min, Math.min(max, Math.sqrt(area / tiles)))
}

/**
 * One point per grid square that is at least `coverage` ink.
 *
 * Coverage of the whole square rather than a sample at its centre: a centre
 * sample makes ragged letter edges, because a square that is 90% ink can miss
 * by one pixel. The grid is centred on the mask so the leftover margin is
 * shared, not dumped on the right.
 */
export function sampleGrid(mask: Mask, pitch: number, coverage = 0.45, threshold = 128): Point[] {
  const cols = Math.floor(mask.width / pitch)
  const rows = Math.floor(mask.height / pitch)
  const left = (mask.width - cols * pitch) / 2
  const top = (mask.height - rows * pitch) / 2
  const points: Point[] = []

  for (let row = 0; row < rows; row += 1) {
    const y0 = Math.floor(top + row * pitch)
    const y1 = Math.min(mask.height, Math.floor(top + (row + 1) * pitch))
    for (let col = 0; col < cols; col += 1) {
      const x0 = Math.floor(left + col * pitch)
      const x1 = Math.min(mask.width, Math.floor(left + (col + 1) * pitch))
      let ink = 0
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) if (alphaAt(mask, y * mask.width + x) >= threshold) ink += 1
      }
      const cells = (x1 - x0) * (y1 - y0)
      if (cells > 0 && ink / cells >= coverage) {
        points.push({ x: left + (col + 0.5) * pitch, y: top + (row + 0.5) * pitch })
      }
    }
  }
  return points
}

/**
 * One font size for every line, as large as the box allows, with the lines
 * centred both ways.
 *
 * `metrics` are measured at `measuredAt` pixels and scale linearly, which
 * holds for any outline font. The heart, when asked for, rides on the last
 * line and counts toward its width.
 */
export function fitWords(
  metrics: LineMetrics[],
  measuredAt: number,
  box: { width: number; height: number },
  options: { gap?: number; heart?: boolean } = {},
): FittedWords {
  const gap = (options.gap ?? 0.14) * measuredAt
  const last = metrics.length - 1
  const extra = options.heart ? (HEART.gap + HEART.width) * measuredAt : 0

  const widths = metrics.map((line, i) => line.width + (i === last ? extra : 0))
  const blockWidth = Math.max(...widths, 1)
  const blockHeight =
    metrics.reduce((total, line) => total + line.ascent + line.descent, 0) + gap * Math.max(0, metrics.length - 1)

  const scale = Math.min(box.width / blockWidth, box.height / Math.max(blockHeight, 1))
  const fontSize = measuredAt * scale

  let y = (box.height - blockHeight * scale) / 2
  const lines = metrics.map((line, i) => {
    const baseline = y + line.ascent * scale
    y = baseline + line.descent * scale + gap * scale
    return { x: (box.width - widths[i] * scale) / 2, baseline }
  })

  const heart = options.heart && metrics.length
    ? {
        x: lines[last].x + (metrics[last].width + HEART.gap * measuredAt) * scale + (HEART.width * fontSize) / 2,
        y: lines[last].baseline - HEART.lift * fontSize,
        width: HEART.width * fontSize,
      }
    : null

  return { fontSize, lines, heart }
}
