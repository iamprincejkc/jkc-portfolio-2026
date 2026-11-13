/**
 * Google Tag Manager for the business landing page, and nothing else.
 *
 * Why it is shaped like this:
 *
 * - Only `/` loads it (pages/index.vue). The landing page links out with full
 *   page loads, so the container never follows a visitor into the portfolio.
 * - Only the production hosts load it, so local dev, `nuxt preview` and
 *   Netlify deploy previews never count as visits.
 * - Consent defaults are pushed before gtm.js loads, which is the order
 *   Google requires ("If your consent code is called out of order, consent
 *   defaults won't work"). There is no cookie banner, so:
 *     - in the EEA, the UK and Switzerland, analytics storage is denied and
 *       Google tags send cookieless pings only;
 *     - everywhere else analytics storage is granted;
 *     - advertising storage, ad user data and ad personalisation are denied
 *       everywhere. This page runs no ads.
 * - gtm.js is fetched once the page is idle, after the headline and hero
 *   have painted, so analytics never competes with the content for bandwidth.
 *
 * GA4 itself is configured inside the GTM container (a Google tag with the
 * G- measurement ID, firing on All Pages). The events below are pushed to the
 * dataLayer; GTM turns them into GA4 events with "Custom Event" triggers.
 */

/** EU member states, the rest of the EEA (IS, LI, NO), the UK and Switzerland. ISO 3166-1 alpha-2. */
export const CONSENT_REQUIRED_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
] as const

type Consent = 'granted' | 'denied'
export interface ConsentDefault {
  ad_storage: Consent
  ad_user_data: Consent
  ad_personalization: Consent
  analytics_storage: Consent
  region?: string[]
  wait_for_update?: number
}

/**
 * The two `gtag('consent', 'default', ...)` calls, most specific first.
 * Google applies the most specific matching region, and a call without a
 * region covers everyone else.
 */
export function consentDefaults(): ConsentDefault[] {
  const ads = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' } as const
  return [
    { ...ads, analytics_storage: 'denied', region: [...CONSENT_REQUIRED_REGIONS] },
    { ...ads, analytics_storage: 'granted' },
  ]
}

/** Whether this page view should load the container at all. */
export function shouldLoadTags(hostname: string, containerId: string, hosts: readonly string[]): boolean {
  return /^GTM-[A-Z0-9]+$/.test(containerId) && hosts.includes(hostname.toLowerCase())
}

export function gtmSrc(containerId: string): string {
  return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`
}

/** The events this page sends. `generate_lead` is a GA4 recommended event. */
export type LandingEvent =
  | { event: 'generate_lead'; method: 'contact_form'; has_email: boolean; has_phone: boolean }
  | { event: 'contact_click'; method: 'email' | 'messenger' | 'phone' | 'whatsapp' }
  | { event: 'cta_click'; cta: string }
