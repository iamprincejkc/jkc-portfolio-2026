import { traceHeart } from '../utils/monthsary/heart'
import { createFireworks, createHearts, planVolley, type SkyMode } from '../utils/monthsary/sky'

/**
 * Draws /monthsary's sky: two star fields, the fireworks behind the tiles,
 * and the hearts that fall in front of everything in the finale.
 *
 * The simulation is utils/monthsary/sky.ts; this only paints it. Every canvas
 * is cleared each frame and sparks are drawn as short velocity streaks. The
 * usual trick of fading the previous frame with a translucent fill leaves a
 * permanent faint ghost of every trail on a transparent canvas - 8-bit alpha
 * rounding stops the fade a step short of zero.
 */

export type MonthsarySky = {
  frame: (dt: number, t: number) => void
  setMode: (mode: SkyMode) => void
  /** Hearts falling in front of everything. */
  rain: (count: number) => void
  /** Bursts already in the air, for the instant the candle goes out. */
  salute: (count: number) => void
  /** Where bursts may go, in pixels from the top. The layout decides. */
  setBand: (band: { top: number; bottom: number }) => void
  clear: () => void
  destroy: () => void
}

/** Seconds of travel each spark's streak covers. */
const STREAK = 0.045

export function createMonthsarySky(
  back: HTMLCanvasElement,
  front: HTMLCanvasElement,
  stars: HTMLCanvasElement[],
): MonthsarySky {
  const fireworks = createFireworks()
  const hearts = createHearts()
  const backPen = back.getContext('2d')!
  const frontPen = front.getContext('2d')!

  let width = 0
  let height = 0
  let ratio = 1
  let mode: SkyMode = 'off'
  let wait = 0.3
  let band: { top: number; bottom: number } | undefined

  /*
   * Two fields of stars, painted once. The page cross-fades them out of step
   * with CSS, which twinkles without redrawing anything.
   */
  function paintStars() {
    const count = Math.round((width * height) / 9000)
    stars.forEach((canvas, field) => {
      const pen = canvas.getContext('2d')!
      pen.setTransform(ratio, 0, 0, ratio, 0, 0)
      pen.clearRect(0, 0, width, height)
      for (let i = 0; i < count; i += 1) {
        const x = Math.random() * width
        // Thinner toward the bottom, where the cake and the horizon glow sit.
        const y = Math.pow(Math.random(), 1.6) * height
        const r = Math.random() < 0.08 ? 1.4 + Math.random() : 0.5 + Math.random() * 0.7
        pen.globalAlpha = 0.35 + Math.random() * 0.55
        pen.fillStyle = field === 0 ? '#ffffff' : '#ffe3ec'
        pen.beginPath()
        pen.arc(x, y, r, 0, Math.PI * 2)
        pen.fill()
      }
      pen.globalAlpha = 1
    })
  }

  function resize() {
    width = back.clientWidth
    height = back.clientHeight
    ratio = Math.min(window.devicePixelRatio || 1, 2)
    for (const canvas of [back, front, ...stars]) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    paintStars()
  }

  resize()
  window.addEventListener('resize', resize)

  function drawBack() {
    const pen = backPen
    pen.setTransform(ratio, 0, 0, ratio, 0, 0)
    pen.clearRect(0, 0, width, height)
    if (!fireworks.sparks.length && !fireworks.rockets.length && !fireworks.flashes.length) return

    pen.globalCompositeOperation = 'lighter'
    pen.lineCap = 'round'

    // The burst lights the sky around it for a moment.
    for (const flash of fireworks.flashes) {
      const fade = 1 - flash.age / 0.35
      const light = pen.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.radius)
      light.addColorStop(0, flash.color)
      light.addColorStop(1, 'rgba(0,0,0,0)')
      pen.globalAlpha = 0.22 * fade
      pen.fillStyle = light
      pen.fillRect(flash.x - flash.radius, flash.y - flash.radius, flash.radius * 2, flash.radius * 2)
    }

    for (const spark of fireworks.sparks) {
      const fade = 1 - spark.age / spark.life
      // Old sparks crackle as they die.
      const crackle = fade < 0.35 ? 0.55 + 0.45 * Math.sin(spark.age * 45 + spark.x) : 1
      pen.globalAlpha = Math.pow(fade, 1.3) * crackle
      pen.strokeStyle = spark.color
      pen.lineWidth = spark.size
      pen.beginPath()
      pen.moveTo(spark.x - spark.vx * STREAK, spark.y - spark.vy * STREAK)
      pen.lineTo(spark.x, spark.y)
      pen.stroke()
    }

    for (const rocket of fireworks.rockets) {
      pen.globalAlpha = 1
      pen.strokeStyle = '#fff1dc'
      pen.lineWidth = 2.4
      pen.beginPath()
      pen.moveTo(rocket.x - rocket.vx * STREAK * 1.6, rocket.y - rocket.vy * STREAK * 1.6)
      pen.lineTo(rocket.x, rocket.y)
      pen.stroke()
    }

    pen.globalAlpha = 1
    pen.globalCompositeOperation = 'source-over'
  }

  let frontDrawn = false
  function drawFront() {
    if (!hearts.hearts.length && !frontDrawn) return
    const pen = frontPen
    pen.setTransform(ratio, 0, 0, ratio, 0, 0)
    pen.clearRect(0, 0, width, height)
    for (const heart of hearts.hearts) {
      pen.setTransform(ratio, 0, 0, ratio, heart.x * ratio, heart.y * ratio)
      pen.rotate(heart.rotation)
      pen.globalAlpha = 0.9
      pen.fillStyle = heart.color
      pen.beginPath()
      traceHeart(pen, 0, 0, heart.size)
      pen.fill()
    }
    pen.globalAlpha = 1
    frontDrawn = hearts.hearts.length > 0
  }

  function frame(dt: number, t: number) {
    if (mode !== 'off') {
      wait -= dt
      if (wait <= 0) {
        const volley = planVolley(mode, width, height, Math.random, band)
        wait = volley.wait
        for (const launch of volley.launches) {
          fireworks.launch(launch.x, height + 10, launch.peakY, launch.shape, launch.color, launch.scale)
        }
      }
    }
    fireworks.step(dt)
    hearts.step(dt, t, height)
    drawBack()
    drawFront()
  }

  return {
    frame,
    setMode(next) {
      // The first rocket of a new mode goes up at once, not after a full wait.
      if (next !== mode) wait = next === 'finale' ? 0 : 0.2
      mode = next
    },
    rain(count) {
      hearts.drop(count, width, height)
    },
    salute(count) {
      // Rockets need a second or two to climb; these skip the climb so the
      // tap and the sky answer each other.
      const volley = Array.from({ length: count }, () => planVolley('finale', width, height, Math.random, band).launches[0])
      volley.forEach((burst, i) => {
        fireworks.burst(burst.x, burst.peakY, i === 0 ? 'heart' : burst.shape, burst.color, burst.scale)
      })
    },
    setBand(next) {
      band = next
    },
    clear() {
      fireworks.clear()
      hearts.clear()
    },
    destroy() {
      window.removeEventListener('resize', resize)
      fireworks.clear()
      hearts.clear()
    },
  }
}
