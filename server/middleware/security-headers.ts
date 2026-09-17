/**
 * Security headers, on every server-rendered response.
 *
 * `netlify.toml` carries the same set for files served straight off the CDN -
 * the prerendered pages, the JS bundles, the workflow JSON. Neither one covers
 * what the other does: `netlify.toml` rules are applied by the CDN and do not
 * reliably reach responses produced by the SSR function, and this middleware
 * only runs when a request actually reaches the server, which a cached static
 * asset never does. The two are duplicated on purpose, and must be changed
 * together.
 *
 * ---------------------------------------------------------------------------
 * On `script-src 'unsafe-inline'`
 * ---------------------------------------------------------------------------
 * The honest position: this policy does not stop injected script. It stops a
 * lot of other things, which is worth having, and it says so rather than
 * pretending otherwise.
 *
 * Nuxt writes its own inline bootstrap into every prerendered page
 * (`window.__NUXT__.config = ...`), and `/n8n` adds an inline theme script that
 * has to run before first paint or dark mode flashes white. A nonce cannot
 * work on a page that was rendered at build time and is served from a CDN, and
 * hashes would have to be regenerated on every build - where the failure mode
 * is a blank production page, discovered by a visitor.
 *
 * So the parts that can be locked down are locked down hard: no framing, no
 * plugins, no base-tag hijack, forms can only post here, and images, fonts,
 * styles and connections are restricted to named origins. That closes
 * clickjacking, base-uri injection, form-action exfiltration and most data
 * exfiltration paths, none of which `'unsafe-inline'` reopens.
 *
 * The remaining XSS surface is small and handled where it lives: the only
 * third-party content this site renders is the sticky notes on `/n8n`, and
 * `utils/n8n/markdown.ts` escapes every character of those before it emits a
 * single tag.
 */

/** Origins this site legitimately pulls from. Keep in step with netlify.toml. */
const CSP = [
  "default-src 'self'",
  // See the note above before touching this line.
  "script-src 'self' 'unsafe-inline'",
  // Vue writes component styles inline; Nuxt inlines critical CSS.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdn.fontshare.com",
  // Cloudinary serves the gallery; Last.fm serves album art for the hero card.
  "img-src 'self' data: blob: https://res.cloudinary.com https://lastfm.freetls.fastly.net",
  // Uploads go straight to Cloudinary with a signature minted server-side.
  // The wss:// hosts are the Nostr relays Evently's shared worlds use to find
  // each other for "walk together" - pinned in Evently's src/live/room.ts, and
  // the three lists must change together.
  "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com wss://nos.lol wss://relay.primal.net wss://nostr.mom wss://purplerelay.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Nothing here is a plugin, and nothing here should ever be framed.
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // An injected <base> would silently repoint every relative URL on the page.
  "base-uri 'self'",
  // The contact form posts to this origin and nowhere else.
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

const HEADERS: Record<string, string> = {
  'content-security-policy': CSP,

  /*
   * Two years, subdomains included. Only sent over HTTPS, and only in
   * production: setting it on a `localhost` response would pin the browser to
   * HTTPS for every local dev server on that host, which is a hard mistake to
   * undo.
   */
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',

  // Belt and braces with `frame-ancestors`, for anything that predates CSP2.
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',

  /*
   * Deny by default rather than listing what is denied: a new browser feature
   * arrives disabled instead of arriving enabled.
   */
  'permissions-policy': [
    'accelerometer=()',
    'autoplay=()',
    'camera=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'interest-cohort=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'usb=()',
    'xr-spatial-tracking=()',
  ].join(', '),

  // Severs the window.opener relationship, so a popup cannot reach back in.
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-site',
}

export default defineEventHandler((event) => {
  for (const [name, value] of Object.entries(HEADERS)) {
    // HSTS over plaintext is meaningless, and over localhost it is harmful.
    if (name === 'strict-transport-security' && import.meta.dev) continue
    setResponseHeader(event, name, value)
  }

  /*
   * Authenticated surfaces are never cacheable by anything in between - a
   * shared cache holding one visitor's authorised response and handing it to
   * the next is the failure that turns a gate into a formality.
   *
   * Listed explicitly rather than as "everything under /api", because
   * `/api/now-playing` is deliberately public and edge-cached for 20 seconds,
   * and that is the whole reason a hot page does not hit Last.fm per visitor.
   */
  const path = getRequestURL(event).pathname
  const isPrivate =
    path === '/gate' ||
    path.startsWith('/gallery') ||
    path.startsWith('/api/gallery') ||
    path.startsWith('/api/contact')

  if (isPrivate) setResponseHeader(event, 'cache-control', 'no-store, private')
})
