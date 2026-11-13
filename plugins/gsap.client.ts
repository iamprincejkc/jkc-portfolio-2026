import { skipsMotion } from '~/utils/motion'

/**
 * GSAP and ScrollTrigger, loaded as their own chunk rather than in the entry
 * bundle, and not at all on pages that never animate. See utils/motion.ts.
 */
export default defineNuxtPlugin(async () => {
  if (import.meta.server) return
  if (skipsMotion(window.location.pathname)) return

  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
  gsap.registerPlugin(ScrollTrigger)
  return {
    provide: { gsap, ScrollTrigger },
  }
})
