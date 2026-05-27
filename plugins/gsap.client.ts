import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  gsap.registerPlugin(ScrollTrigger)
  return {
    provide: { gsap, ScrollTrigger },
  }
})
