import { describe, expect, it } from 'vitest'
import {
  BODY_SHAPES,
  EYE_FRAMES,
  EYE_PUPILS,
  corners,
  place,
  reverseShape,
  roundRect,
  toPathData,
  type PathCmd,
  type Shape,
} from './shapes'

function points(shape: Shape): [number, number][] {
  return shape.filter((c): c is Exclude<PathCmd, { c: 'Z' }> => c.c !== 'Z').map((c) => [c.x, c.y])
}

/**
 * True extent of the drawn outline.
 *
 * Cubics are flattened rather than bounded by their control points: a control
 * point routinely sits outside the curve it steers - the flower's petals are
 * pulled out to 0.6 to bulge to 0.51 - so a control-point box would report a
 * shape as overflowing its cell when the ink never leaves it.
 */
function bounds(shape: Shape) {
  const xs: number[] = []
  const ys: number[] = []
  let px = 0
  let py = 0

  for (const cmd of shape) {
    if (cmd.c === 'Z') continue
    if (cmd.c === 'C') {
      for (let i = 1; i <= 16; i++) {
        const t = i / 16
        const u = 1 - t
        const a = u * u * u
        const b = 3 * u * u * t
        const c = 3 * u * t * t
        const d = t * t * t
        xs.push(a * px + b * cmd.x1 + c * cmd.x2 + d * cmd.x)
        ys.push(a * py + b * cmd.y1 + c * cmd.y2 + d * cmd.y)
      }
    }
    xs.push(cmd.x)
    ys.push(cmd.y)
    px = cmd.x
    py = cmd.y
  }

  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

describe('roundRect', () => {
  it('is a plain rectangle at zero radius', () => {
    const shape = roundRect(2, 1, corners(0))
    expect(points(shape)).toEqual([
      [-1, -0.5],
      [1, -0.5],
      [1, -0.5],
      [1, 0.5],
      [1, 0.5],
      [-1, 0.5],
      [-1, 0.5],
      [-1, -0.5],
      [-1, -0.5],
    ])
  })

  it('closes back onto its own start point, which reverseShape relies on', () => {
    const shape = roundRect(1, 1, corners(0.3))
    const pts = points(shape)
    expect(pts[pts.length - 1]).toEqual(pts[0])
  })

  it('caps the radius at half the shorter side', () => {
    const shape = roundRect(1, 1, corners(50))
    const b = bounds(shape)
    expect(b.minX).toBeCloseTo(-0.5)
    expect(b.maxX).toBeCloseTo(0.5)
  })

  it('stays centred on the origin', () => {
    const b = bounds(roundRect(3, 2, corners(0.4)))
    expect(b.minX + b.maxX).toBeCloseTo(0)
    expect(b.minY + b.maxY).toBeCloseTo(0)
  })
})

describe('reverseShape', () => {
  it('visits the same points in the opposite order', () => {
    const forward = roundRect(1, 1, corners(0.25))
    const back = reverseShape(forward)
    expect(points(back).map((p) => p.join())).toEqual(
      points(forward).map((p) => p.join()).reverse(),
    )
  })

  it('is its own inverse', () => {
    const forward = roundRect(1, 1, corners(0.25))
    expect(toPathData([reverseShape(reverseShape(forward))])).toBe(toPathData([forward]))
  })
})

describe('place', () => {
  it('translates without rotating by default', () => {
    const moved = place(roundRect(1, 1, corners(0)), { cx: 5, cy: 3, scale: 1 })
    const b = bounds(moved)
    expect(b.minX).toBeCloseTo(4.5)
    expect(b.maxY).toBeCloseTo(3.5)
  })

  it('rotates a quarter turn clockwise in screen space', () => {
    const [p] = points(place([{ c: 'M', x: 1, y: 0 }], { cx: 0, cy: 0, scale: 1, rotate: Math.PI / 2 }))
    expect(p![0]).toBeCloseTo(0)
    expect(p![1]).toBeCloseTo(1)
  })

  it('scales about the placement centre, not the origin', () => {
    const b = bounds(place(roundRect(1, 1, corners(0)), { cx: 10, cy: 10, scale: 0.5 }))
    expect(b.minX).toBeCloseTo(9.75)
    expect(b.maxX).toBeCloseTo(10.25)
  })
})

describe('shape library', () => {
  it('has unique ids in every list', () => {
    for (const list of [BODY_SHAPES, EYE_FRAMES, EYE_PUPILS]) {
      const ids = list.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('emits only move, line, cubic and close, so PDF and EPS can draw it', () => {
    for (const def of [...BODY_SHAPES, ...EYE_FRAMES, ...EYE_PUPILS]) {
      for (const radius of [0, 0.5, 1]) {
        for (const cmd of def.build(radius)) {
          expect(['M', 'L', 'C', 'Z'], def.id).toContain(cmd.c)
        }
      }
    }
  })

  it('keeps every body module inside its own cell', () => {
    for (const def of BODY_SHAPES) {
      const b = bounds(def.build(1))
      // At full thickness a module may fill its cell exactly, never more:
      // anything wider would bleed into its neighbour and blur the grid.
      expect(b.minX, def.id).toBeGreaterThanOrEqual(-0.5001)
      expect(b.maxX, def.id).toBeLessThanOrEqual(0.5001)
      expect(b.minY, def.id).toBeGreaterThanOrEqual(-0.5001)
      expect(b.maxY, def.id).toBeLessThanOrEqual(0.5001)
    }
  })

  it('keeps every eye frame inside its 7x7 finder pattern', () => {
    for (const def of EYE_FRAMES) {
      const b = bounds(def.build(1))
      expect(b.minX, def.id).toBeCloseTo(-3.5, 5)
      expect(b.maxX, def.id).toBeCloseTo(3.5, 5)
    }
  })

  it('keeps every pupil clear of its frame', () => {
    for (const def of EYE_PUPILS) {
      const b = bounds(def.build(1))
      // The frame's inner edge sits at 2.5 modules from the centre.
      expect(Math.max(b.maxX, b.maxY, -b.minX, -b.minY), def.id).toBeLessThan(2.5)
    }
  })
})

describe('toPathData', () => {
  it('rounds coordinates and drops negative zero', () => {
    expect(toPathData([[{ c: 'M', x: -0.0000001, y: 1.23456 }]])).toBe('M0 1.235')
  })

  it('concatenates several shapes into one d attribute', () => {
    const d = toPathData([roundRect(1, 1, corners(0)), roundRect(1, 1, corners(0))])
    expect(d.match(/M/g)).toHaveLength(2)
  })
})
