import { describe, expect, it } from 'vitest'
import { fitWords, inkArea, pitchFor, sampleGrid, type Mask } from './text-targets'

/** An RGBA mask with an opaque rectangle in it, like a canvas would give. */
function rectMask(width: number, height: number, rect: { x: number; y: number; w: number; h: number }): Mask {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) data[(y * width + x) * 4 + 3] = 255
  }
  return { data, width, height, stride: 4 }
}

describe('inkArea', () => {
  it('counts opaque pixels, reading alpha from the last byte of each pixel', () => {
    expect(inkArea(rectMask(50, 40, { x: 5, y: 5, w: 10, h: 20 }))).toBe(200)
  })
})

describe('pitchFor', () => {
  it('is the side of a square holding one tile worth of ink', () => {
    expect(pitchFor(10_000, 100)).toBe(10)
  })

  it('clamps at both ends', () => {
    expect(pitchFor(100, 10_000)).toBe(4)
    expect(pitchFor(10_000_000, 10)).toBe(36)
    expect(pitchFor(0, 10)).toBe(36)
  })
})

describe('sampleGrid', () => {
  it('puts one point in every grid square that is mostly ink, and none outside', () => {
    const mask = rectMask(100, 100, { x: 20, y: 20, w: 40, h: 40 })
    const points = sampleGrid(mask, 10)

    expect(points).toHaveLength(16)
    for (const point of points) {
      expect(point.x).toBeGreaterThan(20)
      expect(point.x).toBeLessThan(60)
      expect(point.y).toBeGreaterThan(20)
      expect(point.y).toBeLessThan(60)
    }
  })

  it('lands near the requested tile count when the pitch comes from pitchFor', () => {
    const mask = rectMask(400, 200, { x: 0, y: 0, w: 400, h: 200 })
    const points = sampleGrid(mask, pitchFor(inkArea(mask), 800))
    expect(points.length).toBeGreaterThan(700)
    expect(points.length).toBeLessThanOrEqual(800)
  })
})

describe('fitWords', () => {
  const metrics = [
    { width: 300, ascent: 72, descent: 4 },
    { width: 520, ascent: 72, descent: 22 },
    { width: 360, ascent: 72, descent: 22 },
  ]

  it('fits every line, heart included, inside the box', () => {
    const box = { width: 340, height: 330 }
    const fitted = fitWords(metrics, 100, box, { heart: true })

    for (const [i, line] of fitted.lines.entries()) {
      const scale = fitted.fontSize / 100
      expect(line.x).toBeGreaterThanOrEqual(-0.001)
      expect(line.baseline - metrics[i].ascent * scale).toBeGreaterThanOrEqual(-0.001)
      expect(line.baseline + metrics[i].descent * scale).toBeLessThanOrEqual(box.height + 0.001)
    }
    const heart = fitted.heart!
    expect(heart.x + heart.width / 2).toBeLessThanOrEqual(box.width + 0.001)
    expect(heart.y).toBeLessThan(fitted.lines[2].baseline)
  })

  it('centres the widest line', () => {
    const fitted = fitWords(metrics, 100, { width: 1000, height: 300 })
    const scale = fitted.fontSize / 100
    const left = fitted.lines[1].x
    const right = 1000 - (left + metrics[1].width * scale)
    expect(left).toBeCloseTo(right, 5)
  })
})
