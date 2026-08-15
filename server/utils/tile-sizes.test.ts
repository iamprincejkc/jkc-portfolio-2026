import { describe, expect, it } from 'vitest'
import { tileSizes } from '../../composables/useCloudinaryImage'

/**
 * `sizes` is the browser's only input when picking from `srcset`, so a wrong
 * value silently wastes bandwidth on every tile. These lock it to the
 * column-count rules in assets/css/main.css - if those change and this does
 * not, the mismatch should fail here rather than quietly cost megabytes.
 */
describe('tileSizes', () => {
  it('matches the column count at each density', () => {
    // 2, 3 and 4 columns -> 50vw, 33vw, 25vw
    expect(tileSizes('l')).toContain('(min-width: 1024px) 50vw')
    expect(tileSizes('m')).toContain('(min-width: 1024px) 33vw')
    expect(tileSizes('s')).toContain('(min-width: 1024px) 25vw')
  })

  it('declares narrower tiles as density increases', () => {
    const at = (d: 's' | 'm' | 'l') =>
      Number(tileSizes(d).match(/\(min-width: 1024px\) (\d+)vw/)![1])
    expect(at('s')).toBeLessThan(at('m'))
    expect(at('m')).toBeLessThan(at('l'))
  })

  it('keeps the tablet tier at two columns whatever the density', () => {
    // The control only applies from 1024px; below that there is not room.
    for (const d of ['s', 'm', 'l'] as const) {
      expect(tileSizes(d)).toContain('(min-width: 640px) 50vw')
    }
  })

  it('caps in pixels past the container max width', () => {
    // Beyond 1600px the container stops growing, so vw would keep
    // over-estimating and pull a source larger than can ever be displayed.
    expect(tileSizes('m')).toMatch(/^\(min-width: 1600px\) \d+px,/)

    const px = (d: 's' | 'm' | 'l') =>
      Number(tileSizes(d).match(/\(min-width: 1600px\) (\d+)px/)![1])
    // 1504px of content across 2, 3 and 4 columns.
    expect(px('l')).toBe(752)
    expect(px('m')).toBe(501)
    expect(px('s')).toBe(376)
  })

  it('orders media conditions widest-first', () => {
    // `sizes` is first-match-wins, so a narrower condition listed first would
    // shadow every wider one.
    const widths = [...tileSizes('m').matchAll(/\(min-width: (\d+)px\)/g)].map((m) =>
      Number(m[1]),
    )
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
  })

  it('falls back to full width on small screens', () => {
    for (const d of ['s', 'm', 'l'] as const) {
      expect(tileSizes(d).endsWith('100vw')).toBe(true)
    }
  })

  it('defaults to the medium density', () => {
    expect(tileSizes()).toBe(tileSizes('m'))
  })
})
