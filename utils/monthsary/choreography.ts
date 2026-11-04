import type { Point } from './text-targets'

/**
 * The /monthsary tile choreography, as pure functions of time.
 *
 * Every tile's pose is computed from its own fixed parameters and two clocks,
 * never integrated frame by frame. That is what makes this testable with a
 * stepped clock, lets a hidden tab come back to the right moment rather than
 * a stalled one, and means a replay is just a clock reset.
 *
 * Three acts, blended per tile with staggered starts:
 *
 * 1. The wall. A few dozen photos drift in four directions at four depths,
 *    the same idea as /gallery/wall. The rest wait just off screen.
 * 2. The tornado. Each tile is pulled onto a funnel - narrow at the bottom,
 *    wide at the top - that spins faster the lower you go and leans as it
 *    turns. Tiles keep their own height, radius and spin rate, so the funnel
 *    reads as a mass of debris rather than a rotating cylinder.
 * 3. The words. Tiles leave the funnel left to right and settle onto a grid
 *    traced from "Happy Monthsary Langga", popping toward the viewer mid-flight.
 *
 * Coordinates are screen pixels with y pointing down and z pointing at the
 * viewer; the renderer flips y for WebGL. At z = 0 one unit is one CSS pixel.
 */

/** Seconds from the tap that opens the page. */
export const TIMELINE = {
  /** The wall keeps drifting for a beat after the tap, while the gate fades. */
  gather: 0.9,
  /** The last tile leaves the wall this long after the first. */
  gatherSpread: 1.6,
  /** How long one tile takes to reach the funnel. */
  gatherFor: 1.8,
  /** The vortex reaches full speed this long after the gather begins. */
  spinUp: 2.2,
  /** Tiles begin leaving the tornado for the words. */
  form: 5.8,
  formSpread: 1.3,
  formFor: 1.7,
} as const

/** Every tile is in place in the words by this time. */
export const FORMED = TIMELINE.form + TIMELINE.formSpread + TIMELINE.formFor

/** Radians per second at the vortex's full speed, before each tile's own rate. */
const SPIN_MAX = 2.6

/** Vertical field of view of the scene camera, in degrees. */
export const STAGE_FOV = 36

export type Tile = {
  /** Atlas cell: which photo this tile shows. */
  cell: number
  /** Drifts on the opening wall. The others wait off screen. */
  hero: boolean
  /** Where it lands in the words. */
  target: Point

  // The wall
  /** Normalised screen position at wall time zero. */
  sx: number
  sy: number
  /** 0 is nearest, 1 is furthest. */
  depth: number
  /** 0 right-to-left, 1 left-to-right, 2 top-to-bottom, 3 bottom-to-top. */
  band: 0 | 1 | 2 | 3
  /** Screen pixels per second. */
  drift: number
  /** Size multiplier, so no two tiles are quite the same. */
  size: number

  // The tornado
  gatherDelay: number
  /** 0 is the funnel's tip, 1 its mouth. */
  level: number
  phase: number
  spinRate: number
  /** Radius multiplier: how far out of the funnel's wall this tile rides. */
  reach: number
  tumble: number
  seed: number

  // The words
  formDelay: number
}

export type Stage = {
  width: number
  height: number
  /** Camera distance from the z = 0 plane, in pixels. */
  camera: number
  /** Edge of a hero tile on the wall, in screen pixels. */
  heroSize: number
  /** Edge of a debris tile in the funnel, in pixels. */
  debrisSize: number
  /** Grid pitch of the words: one tile's slot. */
  pitch: number
}

export type Pose = {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  roll: number
  /** Edge length in world units. */
  size: number
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const wrap = (v: number, lo: number, hi: number) => {
  const span = hi - lo
  return lo + ((((v - lo) % span) + span) % span)
}

/** Distance from the camera to the z = 0 plane that makes one unit one pixel. */
export function cameraDistance(height: number): number {
  return height / 2 / Math.tan(((STAGE_FOV / 2) * Math.PI) / 180)
}

/**
 * Tile sizes for a viewport. The wall's hero size is solved for screen
 * coverage, like /gallery/wall's, so the opening looks equally full on a
 * phone and on a 1440p monitor.
 */
export function stageFor(width: number, height: number, heroes: number, pitch: number): Stage {
  // Mean of (1 - 0.35 * depth)^2 over a uniform depth: the area lost to distance.
  const depthArea = 0.69
  const heroSize = Math.max(80, Math.min(240, Math.sqrt((0.6 * width * height) / (Math.max(1, heroes) * depthArea))))
  // Smaller than the wall's tiles: there are over a thousand of them in the funnel.
  const debrisSize = Math.max(14, Math.min(38, Math.min(width, height) * 0.038))
  return { width, height, camera: cameraDistance(height), heroSize, debrisSize, pitch }
}

/**
 * How far the vortex has turned by show time `t`, in radians.
 *
 * The angular speed eases up with a smoothstep and this is its exact
 * integral, so the spin accelerates without ever jumping.
 */
export function spin(t: number): number {
  const start = TIMELINE.gather
  const ramp = TIMELINE.spinUp
  const u = (t - start) / ramp
  if (u <= 0) return 0
  if (u <= 1) return SPIN_MAX * ramp * (u * u * u - (u * u * u * u) / 2)
  return SPIN_MAX * ramp * 0.5 + SPIN_MAX * (t - start - ramp)
}

/**
 * Per-tile parameters. `random` is injected so tests are deterministic; the
 * page passes `Math.random`, so every visit is a different arrangement.
 */
export function createTiles(options: {
  targets: Point[]
  heroes: number
  cells: number
  random: () => number
}): Tile[] {
  const { targets, random } = options
  const cells = Math.max(1, options.cells)
  const between = (min: number, max: number) => min + random() * (max - min)

  // Shuffled so the heroes, which are the first few, land all over the words.
  const order = targets.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  let minX = Infinity
  let maxX = -Infinity
  for (const point of targets) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
  }
  const spanX = Math.max(1, maxX - minX)

  /*
   * Photos are dealt from a reshuffled deck rather than picked at random: the
   * heroes then show every photo before any repeats, and the words get an
   * even mix instead of clumps of the same face.
   */
  let deck: number[] = []
  const deal = () => {
    if (!deck.length) {
      deck = Array.from({ length: cells }, (_, i) => i)
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }
    }
    return deck.pop()!
  }

  return order.map((targetIndex, i) => {
    const hero = i < options.heroes
    const target = targets[targetIndex]
    const level = Math.sqrt(random())
    return {
      cell: deal(),
      hero,
      target,
      sx: random(),
      sy: random(),
      depth: random(),
      band: (i % 4) as Tile['band'],
      drift: between(24, 48),
      size: hero ? between(0.85, 1.15) : between(0.6, 1.2),
      // The wall goes first and the stragglers fly in from off screen after,
      // so the funnel visibly thickens.
      gatherDelay: TIMELINE.gatherSpread * (hero ? between(0, 0.55) : between(0.25, 1)),
      level,
      phase: random() * Math.PI * 2,
      // Faster at the tip, like the real thing.
      spinRate: (1.4 - 0.65 * level) * between(0.85, 1.15),
      reach: between(0.8, 1.2),
      tumble: between(-1, 1),
      seed: random() * 1000,
      // A left-to-right sweep, loosened so it reads as a flurry, not a wipe.
      formDelay: TIMELINE.formSpread * (0.72 * ((target.x - minX) / spanX) + 0.28 * random()),
    }
  })
}

/** On the wall, or waiting just off screen. */
export function wallPose(tile: Tile, wall: number, stage: Stage): Pose {
  const { width: w, height: h, camera: d } = stage

  if (!tile.hero) {
    // A ring just outside the frame, so the stragglers swoop in from every side.
    const reach = Math.hypot(w, h) / 2 + stage.heroSize * 2
    const z = lerp(h * 0.15, -h, tile.depth)
    const k = (d - z) / d
    const sx = w / 2 + Math.cos(tile.phase) * reach
    const sy = h / 2 + Math.sin(tile.phase) * reach
    return { x: w / 2 + (sx - w / 2) * k, y: h / 2 + (sy - h / 2) * k, z, yaw: 0, pitch: 0, roll: 0, size: stage.debrisSize * tile.size * k }
  }

  // Placed in screen space, then pushed back along the view ray, so the wall
  // fills the frame at every depth instead of crowding toward the centre.
  const z = lerp(h * 0.05, -h * 0.85, tile.depth)
  const k = (d - z) / d
  const onScreen = stage.heroSize * tile.size * (1 - 0.35 * tile.depth)
  const travel = tile.drift * (1 - 0.5 * tile.depth) * wall
  const sway = Math.sin(wall + tile.seed) * 3

  let sx = tile.sx * w
  let sy = tile.sy * h
  if (tile.band === 0) sx -= travel
  else if (tile.band === 1) sx += travel
  else if (tile.band === 2) sy += travel
  else sy -= travel
  sx = wrap(sx, -onScreen, w + onScreen) + (tile.band >= 2 ? sway : 0)
  sy = wrap(sy, -onScreen, h + onScreen) + (tile.band < 2 ? sway : 0)

  return {
    x: w / 2 + (sx - w / 2) * k,
    y: h / 2 + (sy - h / 2) * k,
    z,
    yaw: 0,
    pitch: 0,
    roll: tile.tumble * 0.06,
    size: onScreen * k,
  }
}

/** Riding the funnel at show time `t`. */
export function vortexPose(tile: Tile, t: number, stage: Stage): Pose {
  const { width: w, height: h } = stage
  const level = clamp01(tile.level + 0.04 * Math.sin(t * 0.8 + tile.seed))

  const mouth = h * 0.1
  const tip = h * 0.9
  const minR = Math.min(w, h) * 0.03
  const maxR = Math.min(w * 0.4, h * 0.42)
  const radius = (minR + (maxR - minR) * Math.pow(level, 1.4)) * tile.reach
  const angle = tile.phase + spin(t) * tile.spinRate

  // The whole funnel leans and wanders, more at the mouth than at the tip.
  const lean = (Math.sin(t * 0.9) * 0.05 + Math.sin(t * 2.1 + 1.3) * 0.015) * w * level

  const base = tile.hero ? stage.heroSize * 0.55 : stage.debrisSize
  return {
    x: w / 2 + lean + radius * Math.cos(angle),
    y: tip + (mouth - tip) * level,
    z: radius * Math.sin(angle),
    // Turned partway along the spin, never edge-on: a sliver of a photo reads as a glitch.
    yaw: Math.cos(angle) * 0.85,
    pitch: -0.25 * level,
    roll: tile.tumble * Math.sin(t * 1.6 + tile.seed),
    size: base * tile.size * (0.55 + 0.65 * level),
  }
}

/** Settled in the words, with a slow shine running across them. */
export function wordPose(tile: Tile, t: number, stage: Stage): Pose {
  const settled = clamp01((t - FORMED) / 1.5)
  const wave = Math.max(0, Math.sin(t * 1.8 - tile.target.x * 0.008 - tile.target.y * 0.004))
  const shine = 1 + 0.18 * Math.pow(wave, 6) * settled
  // A hairline gap only: wider gaps read as a grid laid over the letters.
  return { x: tile.target.x, y: tile.target.y, z: 0, yaw: 0, pitch: 0, roll: 0, size: stage.pitch * 0.93 * shine }
}

const mix = (a: Pose, b: Pose, t: number): Pose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  roll: lerp(a.roll, b.roll, t),
  size: lerp(a.size, b.size, t),
})

/**
 * A tile's pose.
 *
 * `show` is seconds since the tap, or null while the gate is still up. `wall`
 * is seconds since the page mounted; it drives the drift, and keeps running
 * underneath so the wall does not jump when the show begins.
 */
export function poseAt(tile: Tile, show: number | null, wall: number, stage: Stage): Pose {
  if (show === null) return wallPose(tile, wall, stage)

  const into = show - (TIMELINE.gather + tile.gatherDelay)
  if (into <= 0) return wallPose(tile, wall, stage)

  // Frozen where it left the wall, so a wrap at the edge cannot yank it mid-flight.
  const from = wallPose(tile, wall - into, stage)
  let pose = mix(from, vortexPose(tile, show, stage), easeInOutCubic(clamp01(into / TIMELINE.gatherFor)))

  const flight = clamp01((show - TIMELINE.form - tile.formDelay) / TIMELINE.formFor)
  if (flight <= 0) return pose

  pose = mix(pose, wordPose(tile, show, stage), easeInOutCubic(flight))
  pose.z += Math.sin(Math.PI * flight) * stage.height * 0.16
  return pose
}

/** How far the words have come together, 0 to 1. Drives the tile brightening. */
export function formProgress(show: number | null): number {
  if (show === null) return 0
  return clamp01((show - TIMELINE.form - 1) / (FORMED - TIMELINE.form - 1))
}
