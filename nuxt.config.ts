// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/image'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'JKC',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Jan Kevin Cadampog (JKC) — Frontend Developer building thoughtful interfaces and digital experiences.',
        },
        { name: 'theme-color', content: '#0a0a0a' },
      ],
      link: [
        // Fontshare delivers General Sans + Melodrama free for commercial use.
        { rel: 'preconnect', href: 'https://api.fontshare.com' },
        {
          rel: 'stylesheet',
          href: 'https://api.fontshare.com/v2/css?f[]=general-sans@500,600,400&f[]=melodrama@500,400&display=swap',
        },
      ],
    },
  },

  // Lenis/GSAP need the client, but Nuxt SSR for first paint is fine.
  ssr: true,
})
