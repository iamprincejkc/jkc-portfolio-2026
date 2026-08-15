import { describe, expect, it } from 'vitest'
import { tileSizes } from '../../composables/useCloudinaryImage'

/**
 * `sizes` is the browser's only input when picking from `srcset`, so a wrong
 * value silently wastes bandwidth on every tile. These lock it to the grid in
 * assets/css/main.css - if that grid changes and this does not, the mismatch
 * should fail here rather than quietly cost megabytes.
 */
describe('tileSizes', () => {
  it('matches the two-across rhythm from 1024px', () => {
    // Spans out of 12: 7, 5, 4, 8, 6, 6
    const expected = [58, 42, 33, 67, 50, 50]
    expected.forEach((vw, index) => {
      expect(tileSizes(index)).toContain(`(min-width: 1024px) ${vw}vw`)
    })
  })

  it('matches the three-across rhythm from 1536px', () => {
    // Spans out of 12: 5, 4, 3, 4, 3, 5 - two rows of three
    const expected = [42, 33, 25, 33, 25, 42]
    expected.forEach((vw, index) => {
      expect(tileSizes(index)).toContain(`(min-width: 1536px) ${vw}vw`)
    })
  })

  it('declares narrower tiles at 1536px than at 1024px', () => {
    // Three across means smaller tiles. If a breakpoint ever declared a wider
    // value than the one below it, something is inverted.
    for (let i = 0; i < 6; i += 1) {
      const s = tileSizes(i)
      const xl = Number(s.match(/\(min-width: 1536px\) (\d+)vw/)![1])
      const lg = Number(s.match(/\(min-width: 1024px\) (\d+)vw/)![1])
      expect(xl).toBeLessThanOrEqual(lg)
    }
  })

  it('orders media conditions widest-first', () => {
    // `sizes` is first-match-wins, so a narrower condition listed first would
    // shadow every wider one.
    const widths = [...tileSizes(0).matchAll(/\(min-width: (\d+)px\)/g)].map((m) =>
      Number(m[1]),
    )
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
  })

  it('repeats every six tiles', () => {
    for (let i = 0; i < 6; i += 1) {
      expect(tileSizes(i)).toBe(tileSizes(i + 6))
      expect(tileSizes(i)).toBe(tileSizes(i + 60))
    }
  })

  it('caps in pixels past the container max width', () => {
    expect(tileSizes(0)).toMatch(/^\(min-width: 1600px\) \d+px,/)
  })

  it('falls back to full width on small screens', () => {
    for (let i = 0; i < 6; i += 1) {
      expect(tileSizes(i).endsWith('100vw')).toBe(true)
    }
  })

  it('never claims more than the widest possible tile', () => {
    for (let i = 0; i < 12; i += 1) {
      const vw = Number(tileSizes(i).match(/\(min-width: 1024px\) (\d+)vw/)![1])
      expect(vw).toBeLessThanOrEqual(67)
      expect(vw).toBeGreaterThan(0)
    }
  })

  it('sums each three-across row to a full 12 columns', () => {
    // Rows that do not sum to 12 leave a hole or wrap, which is the whole
    // reason the ratios were pinned in the first place.
    const vwToSpan = (i: number) =>
      Math.round((Number(tileSizes(i).match(/\(min-width: 1536px\) (\d+)vw/)![1]) / 100) * 12)
    expect(vwToSpan(0) + vwToSpan(1) + vwToSpan(2)).toBe(12)
    expect(vwToSpan(3) + vwToSpan(4) + vwToSpan(5)).toBe(12)
  })
})
