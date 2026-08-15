import { describe, expect, it } from 'vitest'
import { tileSizes } from '../../composables/useCloudinaryImage'

/**
 * `sizes` is the browser's only input when picking from `srcset`, so a wrong
 * value silently wastes bandwidth on every single tile. These lock it to the
 * grid defined in assets/css/main.css - if that grid changes and this does
 * not, the mismatch should fail here rather than quietly cost megabytes.
 */
describe('tileSizes', () => {
  it('matches the six-item rhythm of the feed grid', () => {
    // Spans out of 12 at >=1024px: 7, 5, 4, 8, 6, 6
    const expected = [58, 42, 33, 67, 50, 50]
    expected.forEach((vw, index) => {
      expect(tileSizes(index)).toContain(`(min-width: 1024px) ${vw}vw`)
    })
  })

  it('repeats every six tiles', () => {
    for (let i = 0; i < 6; i += 1) {
      expect(tileSizes(i)).toBe(tileSizes(i + 6))
      expect(tileSizes(i)).toBe(tileSizes(i + 60))
    }
  })

  it('caps in pixels past the container max width', () => {
    // Beyond 1600px the container stops growing, so vw would keep
    // over-estimating and pull a larger source than can ever be displayed.
    expect(tileSizes(0)).toMatch(/^\(min-width: 1600px\) \d+px,/)
  })

  it('falls back to full width on small screens', () => {
    for (let i = 0; i < 6; i += 1) {
      expect(tileSizes(i).endsWith('100vw')).toBe(true)
    }
  })

  it('never claims more than the widest possible tile', () => {
    // 8 of 12 columns is the largest span in the rhythm. Anything above that
    // would mean the grid and this helper have drifted apart.
    for (let i = 0; i < 12; i += 1) {
      const vw = Number(tileSizes(i).match(/\(min-width: 1024px\) (\d+)vw/)![1])
      expect(vw).toBeLessThanOrEqual(67)
      expect(vw).toBeGreaterThan(0)
    }
  })
})
