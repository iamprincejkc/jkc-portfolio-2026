import { consentDefaults, gtmSrc, shouldLoadTags, type LandingEvent } from '~/utils/landing/analytics'

declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

/** Set once per page load, so the container is never booted twice. */
let started = false

/**
 * Boots Google Tag Manager on the landing page. Call it once, from
 * pages/index.vue. The rules (which hosts, consent defaults, when it loads)
 * are in utils/landing/analytics.ts.
 */
export function useLandingAnalytics() {
  const config = useRuntimeConfig().public
  const containerId = String(config.gtmId ?? '')
  const hosts = String(config.gtmHosts ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)

  onMounted(() => {
    if (started || !shouldLoadTags(window.location.hostname, containerId, hosts)) return
    started = true

    const dl = (window.dataLayer = window.dataLayer || [])
    // gtag() pushes the real `arguments` object, not an array: Google's tags
    // tell commands from plain dataLayer events by that difference.
    function gtag(..._args: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      dl.push(arguments)
    }
    for (const defaults of consentDefaults()) gtag('consent', 'default', defaults)
    dl.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

    const load = () => {
      const s = document.createElement('script')
      s.async = true
      s.src = gtmSrc(containerId)
      document.head.appendChild(s)
    }
    // After the page has painted and gone quiet; never later than 3 s.
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback
    const schedule = () => (idle ? idle(load, { timeout: 3000 }) : window.setTimeout(load, 1500))
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
  })
}

/**
 * Pushes one of the landing page's events. Safe anywhere: before the
 * container loads the event waits in the dataLayer, and on hosts that never
 * load it, it never leaves the browser.
 */
export function trackLanding(payload: LandingEvent) {
  if (typeof window === 'undefined') return
  ;(window.dataLayer = window.dataLayer || []).push(payload)
}
