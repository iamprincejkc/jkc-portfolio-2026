/**
 * Fireworks and falling hearts for /monthsary, as plain simulation.
 *
 * No canvas in here: these step particles and decide when to launch, and
 * composables/useMonthsarySky.ts draws whatever they hold. Randomness is
 * injected so the tests can pin it.
 */

export const SKY_COLORS = ['#ff8fb1', '#ffd1dc', '#ffc76b', '#ffffff', '#c9a7ff', '#ff5d8f'] as const

export type BurstShape = 'peony' | 'heart' | 'ring'

export type Spark = {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  color: string
  size: number
  /** Velocity lost per second, as an exponential rate. */
  drag: number
  gravity: number
}

export type Rocket = {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  shape: BurstShape
  scale: number
}

export type Flash = { x: number; y: number; age: number; color: string; radius: number }

/**
 * Pulls rockets back down, so they slow to a stop at the top of their climb.
 * Strong enough that a climb to the top of a laptop screen takes under two
 * seconds; at 260 a finale was all rising streaks for the first two.
 */
const ROCKET_GRAVITY = 380

/** A hard ceiling, so a phone in the finale never drowns in particles. */
export const MAX_SPARKS = 1400

/** The classic parametric heart, scaled to a unit-ish width and y pointing down. */
export function heartPoint(t: number): { x: number; y: number } {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
  return { x: x / 16, y: y / 16 }
}

export function createFireworks(random: () => number = Math.random) {
  const sparks: Spark[] = []
  const rockets: Rocket[] = []
  const flashes: Flash[] = []

  /** Fire a rocket from `groundY` that will burst at `peakY`. */
  function launch(x: number, groundY: number, peakY: number, shape: BurstShape, color: string, scale = 1) {
    const rise = Math.max(40, groundY - peakY)
    rockets.push({
      x,
      y: groundY,
      vx: (random() - 0.5) * 40,
      // Exactly the speed that runs out of climb at peakY.
      vy: -Math.sqrt(2 * ROCKET_GRAVITY * rise),
      color,
      shape,
      scale,
    })
  }

  function burst(x: number, y: number, shape: BurstShape, color: string, scale = 1) {
    const count = shape === 'heart' ? 96 : shape === 'ring' ? 72 : 110
    if (sparks.length + count > MAX_SPARKS) return

    const speed = 230 * scale
    for (let i = 0; i < count; i += 1) {
      let vx: number
      let vy: number
      if (shape === 'heart') {
        const point = heartPoint((i / count) * Math.PI * 2)
        vx = point.x * speed
        vy = point.y * speed
      } else if (shape === 'ring') {
        const angle = (i / count) * Math.PI * 2
        vx = Math.cos(angle) * speed
        vy = Math.sin(angle) * speed
      } else {
        // sqrt keeps a peony evenly filled rather than bunched in the middle.
        const angle = random() * Math.PI * 2
        const s = speed * (0.3 + 0.7 * Math.sqrt(random()))
        vx = Math.cos(angle) * s
        vy = Math.sin(angle) * s
      }
      sparks.push({
        x,
        y,
        vx,
        vy,
        age: 0,
        life: 1.3 + random() * 0.7,
        // A few white glints in every burst read as glitter.
        color: random() < 0.12 ? '#ffffff' : color,
        size: 2.2 + random() * 1.4,
        // The same drag and gravity for every spark of a shaped burst, or the
        // heart smears into a blob before anyone sees it.
        drag: shape === 'peony' ? 1.1 + random() * 0.5 : 1.3,
        gravity: 85,
      })
    }
    flashes.push({ x, y, age: 0, color, radius: 140 * scale })
  }

  function step(dt: number) {
    for (let i = rockets.length - 1; i >= 0; i -= 1) {
      const rocket = rockets[i]
      rocket.vy += ROCKET_GRAVITY * dt
      rocket.x += rocket.vx * dt
      rocket.y += rocket.vy * dt

      if (sparks.length < MAX_SPARKS) {
        sparks.push({
          x: rocket.x,
          y: rocket.y,
          vx: (random() - 0.5) * 20,
          vy: 20 + random() * 30,
          age: 0,
          life: 0.35 + random() * 0.25,
          color: '#ffd9a8',
          size: 1.2,
          drag: 2,
          gravity: 40,
        })
      }

      if (rocket.vy >= -30) {
        rockets.splice(i, 1)
        burst(rocket.x, rocket.y, rocket.shape, rocket.color, rocket.scale)
      }
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i]
      spark.age += dt
      if (spark.age >= spark.life) {
        sparks.splice(i, 1)
        continue
      }
      const keep = Math.exp(-spark.drag * dt)
      spark.vx *= keep
      spark.vy = spark.vy * keep + spark.gravity * dt
      spark.x += spark.vx * dt
      spark.y += spark.vy * dt
    }

    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      flashes[i].age += dt
      if (flashes[i].age > 0.35) flashes.splice(i, 1)
    }
  }

  function clear() {
    sparks.length = 0
    rockets.length = 0
    flashes.length = 0
  }

  return { sparks, rockets, flashes, launch, burst, step, clear }
}

export type SkyMode = 'off' | 'celebrate' | 'finale'

export type Launch = { x: number; peakY: number; shape: BurstShape; color: string; scale: number }

/**
 * The next volley: how long to wait before it, and what goes up.
 *
 * `celebrate` is an unhurried show that leaves the words readable; `finale`
 * fills the sky and leans on hearts. Bursts stay inside `band` (pixels from
 * the top; the layout decides it) and away from the very edges, so a phone
 * does not clip them.
 */
export function planVolley(
  mode: Exclude<SkyMode, 'off'>,
  width: number,
  height: number,
  random: () => number = Math.random,
  band: { top: number; bottom: number } = { top: height * 0.1, bottom: height * 0.42 },
): { wait: number; launches: Launch[] } {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]
  const scale = Math.max(0.55, Math.min(1.25, Math.min(width, height) / 800))

  const one = (): Launch => {
    const roll = random()
    const shape: BurstShape =
      mode === 'finale'
        ? roll < 0.5 ? 'heart' : roll < 0.75 ? 'peony' : 'ring'
        : roll < 0.3 ? 'heart' : roll < 0.75 ? 'peony' : 'ring'
    return {
      x: width * (0.12 + random() * 0.76),
      peakY: band.top + random() * Math.max(0, band.bottom - band.top),
      shape,
      color: pick(SKY_COLORS),
      scale: scale * (0.8 + random() * 0.4),
    }
  }

  if (mode === 'finale') {
    const count = random() < 0.35 ? 2 : 1
    return { wait: 0.18 + random() * 0.22, launches: Array.from({ length: count }, one) }
  }
  return { wait: 0.9 + random() * 0.9, launches: [one()] }
}

export type Heart = {
  x: number
  y: number
  vy: number
  rotation: number
  spin: number
  size: number
  color: string
  sway: number
  phase: number
}

/** Hearts drifting down in front of everything, for the finale. */
export function createHearts(random: () => number = Math.random) {
  const hearts: Heart[] = []

  function drop(count: number, width: number, height: number) {
    for (let i = 0; i < count; i += 1) {
      hearts.push({
        x: random() * width,
        // Staggered above the top edge so they arrive as a fall, not a wall.
        y: -20 - random() * height * 0.6,
        vy: 70 + random() * 90,
        rotation: (random() - 0.5) * 0.8,
        spin: (random() - 0.5) * 1.6,
        size: 9 + random() * 12,
        color: SKY_COLORS[Math.floor(random() * SKY_COLORS.length)],
        sway: 18 + random() * 30,
        phase: random() * Math.PI * 2,
      })
    }
  }

  function step(dt: number, t: number, height: number) {
    for (let i = hearts.length - 1; i >= 0; i -= 1) {
      const heart = hearts[i]
      heart.y += heart.vy * dt
      heart.x += Math.cos(t * 1.4 + heart.phase) * heart.sway * dt
      heart.rotation += heart.spin * dt
      if (heart.y > height + 40) hearts.splice(i, 1)
    }
  }

  return { hearts, drop, step, clear: () => (hearts.length = 0) }
}
