import { describe, expect, it } from 'vitest'
import { tileSizes } from '../../composables/useCloudinaryImage'

/**
 * `sizes` is the browser's only input when picking from `srcset`, so a wrong
 * value silently wastes bandwidth on every tile. These lock it to the grid in
 * assets/css/main.css - if that grid changes and this does not, the mismatch
 * should fail here rather than quietly cost megabytes.
 */
describe('tileSizes', () => {
  it('matches each density rhythm from 1024px', () => {
    const rhythms = {
      l: [58, 42, 42, 58, 50, 50], // two across
      m: [42, 33, 25, 33, 25, 42], // three across
      s: [25, 25, 25, 25, 25, 25], // four across
    } as const

    for (const [density, expected] of Object.entries(rhythms)) {
      expected.forEach((vw, index) => {
        expect(tileSizes(index, density as 's' | 'm' | 'l')).toContain(
          `(min-width: 1024px) ${vw}vw`,
        )
      })
    }
  })

  it('declares narrower tiles as density increases', () => {
    for (let i = 0; i < 6; i += 1) {
      const at = (d: 's' | 'm' | 'l') =>
        Number(tileSizes(i, d).match(/\(min-width: 1024px\) (\d+)vw/)![1])
      expect(at('s')).toBeLessThanOrEqual(at('m'))
      expect(at('m')).toBeLessThanOrEqual(at('l'))
    }
  })

  it('keeps the tablet tier at two across whatever the density', () => {
    // The control only applies from 1024px; below that there is no room.
    const expected = [58, 42, 42, 58, 50, 50]
    for (const d of ['s', 'm', 'l'] as const) {
      expected.forEach((vw, index) => {
        expect(tileSizes(index, d)).toContain(`(min-width: 640px) ${vw}vw`)
      })
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
      const vw = Number(tileSizes(i, 'l').match(/\(min-width: 1024px\) (\d+)vw/)![1])
      expect(vw).toBeLessThanOrEqual(58)
      expect(vw).toBeGreaterThan(0)
    }
  })

  it('fills exactly 12 columns per row at every density', () => {
    // A row that does not sum to 12 leaves a hole or wraps early.
    const span = (i: number, d: 's' | 'm' | 'l') =>
      Math.round((Number(tileSizes(i, d).match(/\(min-width: 1024px\) (\d+)vw/)![1]) / 100) * 12)

    const perRow = { l: 2, m: 3, s: 4 } as const
    for (const [d, n] of Object.entries(perRow)) {
      for (let start = 0; start + n <= 6; start += n) {
        let total = 0
        for (let i = start; i < start + n; i += 1) total += span(i, d as 's' | 'm' | 'l')
        expect(total).toBe(12)
      }
    }
  })
})
