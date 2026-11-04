import { describe, expect, it } from 'vitest'
import {
  FORMED,
  TIMELINE,
  createTiles,
  poseAt,
  spin,
  stageFor,
  type Pose,
  type Stage,
  type Tile,
} from './choreography'
import type { Point } from './text-targets'

/** mulberry32: small, seedable, good enough to pin a test. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 1440
const H = 900

/** A block of targets where the words would be. */
function targets(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({ x: 120 + (i % 60) * 20, y: 80 + Math.floor(i / 60) * 20 }))
}

function setup(count = 600, heroes = 56): { tiles: Tile[]; stage: Stage } {
  const tiles = createTiles({ targets: targets(count), heroes, cells: 40, random: seeded(7) })
  return { tiles, stage: stageFor(W, H, heroes, 20) }
}

/** Where a pose lands on screen, through the same camera the renderer uses. */
function project(pose: Pose, stage: Stage): Point {
  const k = stage.camera / (stage.camera - pose.z)
  return { x: W / 2 + (pose.x - W / 2) * k, y: H / 2 + (pose.y - H / 2) * k }
}

describe('spin', () => {
  it('starts still, then only ever speeds up, without a jump at the end of the ramp', () => {
    expect(spin(0)).toBe(0)
    expect(spin(TIMELINE.gather)).toBe(0)

    let previousRate = 0
    for (let t = TIMELINE.gather; t < 10; t += 0.01) {
      const rate = (spin(t + 0.01) - spin(t)) / 0.01
      expect(rate).toBeGreaterThanOrEqual(previousRate - 1e-6)
      expect(rate - previousRate).toBeLessThan(0.05)
      previousRate = rate
    }
  })
})

describe('createTiles', () => {
  it('shows every photo on the wall before any repeats', () => {
    const tiles = createTiles({ targets: targets(300), heroes: 30, cells: 40, random: seeded(1) })
    const wall = tiles.filter((tile) => tile.hero).map((tile) => tile.cell)
    expect(new Set(wall).size).toBe(wall.length)
  })

  it('gives every target exactly one tile', () => {
    const points = targets(300)
    const tiles = createTiles({ targets: points, heroes: 30, cells: 12, random: seeded(2) })
    expect(new Set(tiles.map((tile) => tile.target)).size).toBe(points.length)
  })
})

describe('poseAt', () => {
  it('keeps the wall on screen and everything else out of sight before the tap', () => {
    const { tiles, stage } = setup()
    for (const tile of tiles) {
      const pose = poseAt(tile, null, 12.3, stage)
      const at = project(pose, stage)
      const half = (pose.size * (stage.camera / (stage.camera - pose.z))) / 2
      const visible = at.x + half > 0 && at.x - half < W && at.y + half > 0 && at.y - half < H
      if (!tile.hero) expect(visible).toBe(false)
      else {
        expect(at.x).toBeGreaterThanOrEqual(-stage.heroSize * 1.6)
        expect(at.x).toBeLessThanOrEqual(W + stage.heroSize * 1.6)
      }
    }
  })

  it('has every tile on the funnel at the height of the tornado', () => {
    const { tiles, stage } = setup()
    const t = TIMELINE.form - 0.1
    const maxR = Math.min(W * 0.4, H * 0.42) * 1.2
    for (const tile of tiles) {
      const pose = poseAt(tile, t, t + 3, stage)
      expect(pose.y).toBeGreaterThanOrEqual(H * 0.1 - 1)
      expect(pose.y).toBeLessThanOrEqual(H * 0.9 + 1)
      expect(Math.hypot(pose.x - W / 2, pose.z)).toBeLessThan(maxR + W * 0.07)
    }
  })

  it('lands every tile on its own target once the words have formed', () => {
    const { tiles, stage } = setup()
    for (const tile of tiles) {
      const pose = poseAt(tile, FORMED, FORMED + 3, stage)
      expect(pose.x).toBeCloseTo(tile.target.x, 6)
      expect(pose.y).toBeCloseTo(tile.target.y, 6)
      expect(Math.abs(pose.z)).toBeLessThan(1e-6)
      expect(pose.size).toBeLessThan(stage.pitch)
    }
  })

  it('never jumps between frames, from the gate to well after the words form', () => {
    const { tiles, stage } = setup(400, 40)
    const dt = 1 / 60
    // The tap lands 4.2 s into the wall, partway through a drift.
    const tap = 4.2
    const onScreen = (pose: Pose) => {
      const at = project(pose, stage)
      const half = (pose.size * (stage.camera / (stage.camera - pose.z))) / 2
      return { ...at, visible: at.x + half > 0 && at.x - half < W && at.y + half > 0 && at.y - half < H }
    }
    let previous = tiles.map((tile) => onScreen(poseAt(tile, null, 0, stage)))

    for (let wall = dt; wall < tap + FORMED + 2; wall += dt) {
      const show = wall < tap ? null : wall - tap
      const now = tiles.map((tile) => onScreen(poseAt(tile, show, wall, stage)))
      for (let i = 0; i < tiles.length; i += 1) {
        // A wrap is a jump of a whole screen, and is only allowed out of sight.
        const moved = Math.hypot(now[i].x - previous[i].x, now[i].y - previous[i].y)
        if (now[i].visible || previous[i].visible) expect(moved).toBeLessThan(90)
      }
      previous = now
    }
  })
})
