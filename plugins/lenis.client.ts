import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  gsap.registerPlugin(ScrollTrigger)

  /*
   * Smooth scrolling is the one effect on this site that moves the page
   * without being asked to - the wheel stops and the content keeps gliding.
   * That is exactly what `prefers-reduced-motion` is about, so it comes off.
   *
   * Lenis is still constructed rather than skipped: `$lenis.stop()` is what
   * locks the background behind the /n8n dialog, and dropping the instance
   * would quietly take that with it. With `smoothWheel` off it hands the
   * wheel straight to the browser and stays a working scroll lock.
   */
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    duration: reduced ? 0 : 1.15,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: !reduced,
    syncTouch: false,
  })

  // Tell ScrollTrigger to ask Lenis for the scroll position instead of native.
  lenis.on('scroll', ScrollTrigger.update)

  // Drive Lenis from GSAP's ticker so RAFs stay in sync.
  gsap.ticker.add((time: number) => {
    lenis.raf(time * 1000)
  })
  gsap.ticker.lagSmoothing(0)

  return {
    provide: { lenis },
  }
})
