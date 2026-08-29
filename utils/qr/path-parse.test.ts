import { describe, expect, it } from 'vitest'
import { parsePathData } from './path-parse'
import { BRAND_LOGOS } from './logos'
import type { PathCmd } from './shapes'

function endpoint(cmd: PathCmd): [number, number] {
  if (cmd.c === 'Z') throw new Error('close has no endpoint')
  return [cmd.x, cmd.y]
}

describe('parsePathData', () => {
  it('resolves relative commands against the running point', () => {
    const out = parsePathData('M10 10 l5 0 l0 5 z')
    expect(out.map((c) => c.c)).toEqual(['M', 'L', 'L', 'Z'])
    expect(endpoint(out[1]!)).toEqual([15, 10])
    expect(endpoint(out[2]!)).toEqual([15, 15])
  })

  it('expands H and V into lines', () => {
    const out = parsePathData('M0 0 H10 V10 h-5 v-5')
    expect(out.slice(1).map(endpoint)).toEqual([
      [10, 0],
      [10, 10],
      [5, 10],
      [5, 5],
    ])
  })

  it('repeats a command when extra argument pairs follow it', () => {
    const out = parsePathData('M0 0 L1 1 2 2 3 3')
    expect(out).toHaveLength(4)
    expect(endpoint(out[3]!)).toEqual([3, 3])
  })

  it('treats trailing pairs of an M as implicit lines', () => {
    const out = parsePathData('M0 0 5 5')
    expect(out.map((c) => c.c)).toEqual(['M', 'L'])
    expect(endpoint(out[1]!)).toEqual([5, 5])
  })

  it('reflects the previous control point for S', () => {
    const out = parsePathData('M0 0 C1 1 2 2 3 3 S5 5 6 6')
    const smooth = out[2]!
    expect(smooth.c).toBe('C')
    // Reflection of (2,2) through the current point (3,3).
    expect([(smooth as never as { x1: number }).x1, (smooth as never as { y1: number }).y1]).toEqual([4, 4])
  })

  it('converts a quadratic to the equivalent cubic', () => {
    const [, cubic] = parsePathData('M0 0 Q6 0 6 6')
    expect(cubic!.c).toBe('C')
    const c = cubic as Extract<PathCmd, { c: 'C' }>
    expect(c.x1).toBeCloseTo(4)
    expect(c.y1).toBeCloseTo(0)
    expect(c.x2).toBeCloseTo(6)
    expect(c.y2).toBeCloseTo(2)
  })

  describe('arcs', () => {
    it('lands exactly on the stated endpoint', () => {
      const out = parsePathData('M0 0 A5 5 0 0 1 10 0')
      const last = out[out.length - 1]!
      const [x, y] = endpoint(last)
      expect(x).toBeCloseTo(10, 6)
      expect(y).toBeCloseTo(0, 6)
    })

    it('traces the circle rather than cutting the chord', () => {
      // A half circle of radius 5 sweeping clockwise from (0,0) to (10,0)
      // passes through (5,-5).
      const out = parsePathData('M0 0 A5 5 0 0 1 10 0')
      const cubics = out.filter((c) => c.c === 'C') as Extract<PathCmd, { c: 'C' }>[]
      const mid = cubics[cubics.length - 1]!
      // The final slice starts at the top of the arc.
      expect(cubics.length).toBeGreaterThanOrEqual(2)
      expect(endpoint(cubics[0]!)[1]).toBeLessThan(0)
      expect(mid.y).toBeCloseTo(0, 6)
    })

    it('reads flags that a minifier ran into the next number', () => {
      // `a5 5 0 015 5` is large-arc 0, sweep 1, then x=5 y=5. Scanning it as
      // plain numbers would read `015` and produce a different curve.
      const compressed = parsePathData('M0 0a5 5 0 015 5')
      const spaced = parsePathData('M0 0 a5 5 0 0 1 5 5')
      expect(compressed).toEqual(spaced)
      const [x, y] = endpoint(compressed[compressed.length - 1]!)
      expect(x).toBeCloseTo(5, 6)
      expect(y).toBeCloseTo(5, 6)
    })

    it('degrades a zero radius to a straight line', () => {
      const out = parsePathData('M0 0 A0 0 0 0 1 4 4')
      expect(out[1]!.c).toBe('L')
    })
  })
})

describe('brand logos', () => {
  it('every mark parses into move, line, cubic and close only', () => {
    for (const logo of BRAND_LOGOS) {
      const parsed = parsePathData(logo.path)
      expect(parsed.length, logo.id).toBeGreaterThan(0)
      for (const cmd of parsed) {
        expect(['M', 'L', 'C', 'Z'], logo.id).toContain(cmd.c)
      }
    }
  })

  it('every mark stays inside its 24x24 box', () => {
    for (const logo of BRAND_LOGOS) {
      for (const cmd of parsePathData(logo.path)) {
        if (cmd.c === 'Z') continue
        // Control points may sit marginally outside; endpoints must not.
        expect(cmd.x, logo.id).toBeGreaterThanOrEqual(-0.01)
        expect(cmd.x, logo.id).toBeLessThanOrEqual(24.01)
        expect(cmd.y, logo.id).toBeGreaterThanOrEqual(-0.01)
        expect(cmd.y, logo.id).toBeLessThanOrEqual(24.01)
      }
    }
  })

  it('produces no NaN coordinates', () => {
    for (const logo of BRAND_LOGOS) {
      for (const cmd of parsePathData(logo.path)) {
        if (cmd.c === 'Z') continue
        expect(Number.isFinite(cmd.x), logo.id).toBe(true)
        expect(Number.isFinite(cmd.y), logo.id).toBe(true)
      }
    }
  })
})
