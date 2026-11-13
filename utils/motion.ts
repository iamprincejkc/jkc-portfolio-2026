/**
 * Which pages load the scroll-motion stack (GSAP, ScrollTrigger and Lenis).
 *
 * The stack is about 110 kB of the entry bundle, gzipped, and only the
 * portfolio pages use it. The business landing page at `/` is the page most
 * visitors on mobile data open first, so it skips the download entirely:
 * plugins/gsap.client.ts and plugins/lenis.client.ts import the libraries
 * dynamically, and not at all when the visit starts on one of these paths.
 *
 * Plugins run once per visit, so a client-side jump from `/` to a portfolio
 * page would arrive without the stack. Every component that uses it already
 * checks for `$gsap` / `$lenis` and skips its effect, but the effects are part
 * of those pages, so the landing page links out of itself with plain `<a>`
 * (full page loads), never `<NuxtLink>`.
 */
const MOTION_FREE = new Set(['/'])

export function skipsMotion(pathname: string): boolean {
  return MOTION_FREE.has(pathname.replace(/\/index\.html$/, '/'))
}
