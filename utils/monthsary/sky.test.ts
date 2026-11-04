import { describe, expect, it } from 'vitest'
import { MAX_SPARKS, createFireworks, createHearts, heartPoint, planVolley } from './sky'

function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('heartPoint', () => {
  it('is symmetric about the vertical axis, lobes up and point down', () => {
    for (let t = 0.1; t < Math.PI; t += 0.3) {
      const right = heartPoint(t)
      const left = heartPoint(-t)
      expect(left.x).toBeCloseTo(-right.x, 10)
      expect(left.y).toBeCloseTo(right.y, 10)
    }
    // y points down on a canvas, so the tip has the largest y.
    expect(heartPoint(Math.PI).y).toBeGreaterThan(heartPoint(Math.PI / 2).y)
  })
})

describe('createFireworks', () => {
  it('bursts a rocket close to the height it was aimed at', () => {
    const sky = createFireworks(seeded(3))
    sky.launch(400, 900, 200, 'ring', '#ff8fb1')
    let flashY: number | null = null
    for (let i = 0; i < 600 && flashY === null; i += 1) {
      sky.step(1 / 60)
      if (sky.flashes.length) flashY = sky.flashes[0].y
    }
    expect(flashY).not.toBeNull()
    expect(Math.abs(flashY! - 200)).toBeLessThan(40)
  })

  it('keeps a heart burst shaped like a heart while it expands', () => {
    const sky = createFireworks(seeded(4))
    sky.burst(0, 0, 'heart', '#ff5d8f')
    for (let i = 0; i < 30; i += 1) sky.step(1 / 60)
    const coloured = sky.sparks.filter((spark) => spark.color === '#ff5d8f')
    // The burst spread out from the origin; every spark moved by the same law.
    const widest = Math.max(...coloured.map((spark) => Math.abs(spark.x)))
    expect(widest).toBeGreaterThan(50)
    const sameDrag = new Set(sky.sparks.map((spark) => spark.drag))
    expect(sameDrag.size).toBe(1)
  })

  it('burns out completely', () => {
    const sky = createFireworks(seeded(5))
    sky.launch(100, 800, 300, 'peony', '#ffc76b')
    sky.burst(500, 300, 'heart', '#ffffff')
    for (let i = 0; i < 60 * 8; i += 1) sky.step(1 / 60)
    expect(sky.sparks).toHaveLength(0)
    expect(sky.rockets).toHaveLength(0)
    expect(sky.flashes).toHaveLength(0)
  })

  it('never holds more sparks than the ceiling, however hard the finale pushes', () => {
    const sky = createFireworks(seeded(6))
    for (let i = 0; i < 60; i += 1) sky.burst(300, 300, 'peony', '#ff8fb1')
    for (let i = 0; i < 20; i += 1) sky.launch(300, 900, 200, 'heart', '#ff8fb1')
    for (let i = 0; i < 120; i += 1) {
      sky.step(1 / 60)
      expect(sky.sparks.length).toBeLessThanOrEqual(MAX_SPARKS)
    }
  })
})

describe('planVolley', () => {
  it('fires faster in the finale than in the celebration', () => {
    const random = seeded(8)
    const average = (mode: 'celebrate' | 'finale') => {
      let total = 0
      for (let i = 0; i < 200; i += 1) total += planVolley(mode, 1440, 900, random).wait
      return total / 200
    }
    expect(average('finale')).toBeLessThan(average('celebrate') / 3)
  })

  it('keeps bursts inside the band it is given and away from the edges', () => {
    const random = seeded(9)
    const band = { top: 50, bottom: 450 }
    for (let i = 0; i < 200; i += 1) {
      for (const launch of planVolley('finale', 375, 812, random, band).launches) {
        expect(launch.x).toBeGreaterThan(375 * 0.1)
        expect(launch.x).toBeLessThan(375 * 0.9)
        expect(launch.peakY).toBeGreaterThanOrEqual(band.top)
        expect(launch.peakY).toBeLessThanOrEqual(band.bottom)
      }
    }
  })
})

describe('createHearts', () => {
  it('falls past the bottom and is gone', () => {
    const hearts = createHearts(seeded(10))
    hearts.drop(40, 375, 812)
    let t = 0
    for (let i = 0; i < 60 * 30; i += 1) {
      t += 1 / 60
      hearts.step(1 / 60, t, 812)
    }
    expect(hearts.hearts).toHaveLength(0)
  })
})
