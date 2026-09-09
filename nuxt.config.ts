// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/image'],

  css: ['~/assets/css/main.css', '~/assets/css/qr.css', '~/assets/css/n8n.css'],

  /*
   * Resize images at Netlify's edge rather than inside the server function.
   *
   * The default provider is `ipx`, which pulls in `sharp` and, through it,
   * native libvips and libheif. Those carry five open CVEs that cannot be
   * cleared without `@nuxt/image@2` - which was tried and breaks the build,
   * stopping during prerender and never emitting the client assets.
   *
   * Netlify's Image CDN does the same job outside the function, so the native
   * decoder stops being deployed at all and the `/_ipx/` endpoint stops
   * existing. It also means no cold start pays for image processing.
   *
   * `ipx` is kept for local development, where `/.netlify/images` does not
   * exist. `NETLIFY` is set by Netlify during the build, and the provider is
   * baked in at build time, so this is decided once and never at runtime.
   */
  image: {
    provider: process.env.NETLIFY ? 'netlifyImageCdn' : 'ipx',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      // Searchers look for the person, not the initials.
      title: 'Jan Kevin Cadampog — .NET & Angular Developer',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0a0a0a' },
        { name: 'author', content: 'Jan Kevin Cadampog' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        /*
         * Fontshare serves the CSS from api. and the font files from cdn.
         * Without the second preconnect the fonts pay a fresh DNS + TLS
         * handshake after the stylesheet resolves, which lands squarely in the
         * critical path for first text paint.
         */
        { rel: 'preconnect', href: 'https://api.fontshare.com' },
        { rel: 'preconnect', href: 'https://cdn.fontshare.com', crossorigin: '' },
        // Last.fm album art for the now-playing card.
        { rel: 'dns-prefetch', href: 'https://lastfm.freetls.fastly.net' },
        {
          rel: 'stylesheet',
          href: 'https://api.fontshare.com/v2/css?f[]=general-sans@500,600,400&f[]=melodrama@500,400&display=swap',
        },
      ],
    },
  },

  // Lenis/GSAP need the client, but Nuxt SSR for first paint is fine.
  ssr: true,

  /*
   * Values here are overridden at runtime by environment variables, using
   * Nuxt's NUXT_ / NUXT_PUBLIC_ convention. Anything outside `public` stays on
   * the server and is never serialised into the page.
   *
   *   NUXT_AUTH_SECRET, NUXT_SITE_PIN, NUXT_ADMIN_PIN,
   *   NUXT_CLOUDINARY_API_KEY, NUXT_CLOUDINARY_API_SECRET,
   *   NUXT_CLOUDINARY_FOLDER, NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME
   */
  runtimeConfig: {
    authSecret: '',
    sitePin: '',
    adminPin: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    cloudinaryFolder: 'gallery',
    /*
     * Last.fm now-playing. Server-side so the API key is never shipped to the
     * browser. Spotify's own Web API needs Premium, which this account does
     * not have, so scrobbles are the read path instead.
     */
    lastfmApiKey: '',
    lastfmUser: '',
    /*
     * Contact email. The form posts to /api/contact, which sends through
     * Resend from our own domain and archives to Netlify Forms afterwards.
     * All three are required; the endpoint answers 503 rather than half-work.
     */
    resendApiKey: '',
    contactToEmail: '',
    contactFromEmail: '',
    public: {
      // The cloud name appears in every image URL, so it is public by nature.
      cloudinaryCloudName: '',
      /*
       * Absolute origin for canonical, Open Graph and sitemap URLs.
       *
       * Every one of those is an absolute URL, so this value decides which
       * origin search engines are told is the real one. Point it at a domain
       * that is not serving the site and the live site stops being indexed -
       * which is exactly what happened while `iamjkc.space` was parked: the
       * Netlify deploy was up and healthy and every page on it still carried
       * `<link rel="canonical" href="https://iamjkc.space/">`.
       *
       * So the default is the origin that is actually serving, and a custom
       * domain arrives by setting NUXT_PUBLIC_SITE_URL - not by editing this
       * line and hoping the next person remembers.
       *
       * Deliberately not Netlify's own $URL: on deploy previews and branch
       * builds that points at a per-deploy *.netlify.app host, and a canonical
       * advertising a preview origin splits ranking signals.
       *
       * It is read at build time as well as runtime, because the prerendered
       * pages bake their canonical in - changing the variable needs a
       * redeploy, not just a restart.
       */
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://iamprincejkc.netlify.app',
    },
  },

  routeRules: {
    /*
     * The portfolio itself has no per-request state, so it is prerendered at
     * build time and served from the CDN - moving to SSR for the gallery must
     * not slow the homepage down.
     */
    '/': { prerender: true },

    /*
     * The QR generator does all of its work in the browser - there is no API
     * behind it - so the page itself is static and prerendered alongside the
     * homepage. Shared links carry their state in the query string, which the
     * page reads on the client.
     */
    '/qr-generator': { prerender: true },

    /*
     * The n8n library is a static shell over static data. The catalog and each
     * workflow are files under `public/n8n/`, fetched by the browser after
     * mount rather than during setup - baking 700 kB of catalog into the
     * prerendered HTML would slow first paint down for no benefit, and would
     * go stale the next time the catalog is regenerated.
     *
     * The two are cached differently on purpose. A workflow file is a leaf:
     * serving yesterday's copy shows a workflow that is still perfectly valid.
     * The catalog is the index of which ids exist, so a stale one hands the
     * page ids whose files have been removed - every card a dead end. It
     * revalidates on every visit instead, which is one conditional request
     * answered with a 304 and a few hundred bytes.
     */
    '/n8n': { prerender: true },
    '/n8n/catalog.json': { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } },
    '/n8n/workflows/**': { headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } },

    /*
     * The gallery is per-request by definition: it reads the session cookie.
     * `noindex` is belt-and-braces alongside robots.txt and the Netlify
     * X-Robots-Tag headers, for the case where a link leaks.
     */
    '/gate': { ssr: true, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/gallery/**': { ssr: true, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },

    /*
     * Evently is a prebuilt Three.js bundle in public/evently, served as a
     * static directory.
     *
     * Do NOT add a `/evently -> /evently/` redirect rule here. Nitro matches
     * such a rule against both forms, so the slashed URL redirects to itself
     * and the route becomes an infinite loop. Netlify resolves the directory
     * index for the bare path on its own.
     */
  },

  nitro: {
    // Netlify auto-detects its preset during a Netlify build; this keeps
    // `npm run build` honest when run anywhere else.
    // robots and the sitemap never change per request, so they are baked at
    // build time and served straight from the CDN.
    prerender: { crawlLinks: false, routes: ['/', '/qr-generator', '/n8n', '/robots.txt', '/sitemap.xml'] },
  },
})
