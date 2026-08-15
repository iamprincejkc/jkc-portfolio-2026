// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/image'],

  css: ['~/assets/css/main.css'],

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
        {
          rel: 'stylesheet',
          href: 'https://api.fontshare.com/v2/css?f[]=general-sans@500,600,400&f[]=melodrama@500,400&display=swap',
        },
        // The hero mosaic is the LCP element and is painted from CSS
        // background-image, which the preload scanner cannot discover.
        { rel: 'preload', as: 'image', href: '/images/main.webp', fetchpriority: 'high' },
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
    public: {
      // The cloud name appears in every image URL, so it is public by nature.
      cloudinaryCloudName: '',
      /*
       * Absolute origin for canonical, Open Graph and sitemap URLs.
       *
       * Hardcoded to the custom domain rather than Netlify's $URL: on deploy
       * previews and branch builds that variable points at a *.netlify.app
       * host, and a canonical tag advertising the wrong origin actively splits
       * ranking signals. NUXT_PUBLIC_SITE_URL still overrides it if the domain
       * ever changes.
       */
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://iamjkc.space',
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
     * The gallery is per-request by definition: it reads the session cookie.
     * `noindex` is belt-and-braces alongside robots.txt and the Netlify
     * X-Robots-Tag headers, for the case where a link leaks.
     */
    '/gate': { ssr: true, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/gallery/**': { ssr: true, headers: { 'X-Robots-Tag': 'noindex, nofollow' } },

    /*
     * Evently is a prebuilt Three.js bundle living in public/evently. The
     * redirect makes the bare /evently resolve to its index.html rather than
     * 404, which static hosts do implicitly but the dev server does not.
     */
    '/evently': { redirect: { to: '/evently/', statusCode: 302 } },
  },

  nitro: {
    // Netlify auto-detects its preset during a Netlify build; this keeps
    // `npm run build` honest when run anywhere else.
    // robots and the sitemap never change per request, so they are baked at
    // build time and served straight from the CDN.
    prerender: { crawlLinks: false, routes: ['/', '/robots.txt', '/sitemap.xml'] },
  },
})
