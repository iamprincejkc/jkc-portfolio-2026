<script setup lang="ts">
// The descriptive title lives in nuxt.config so it applies everywhere. A page
// title of "JKC" tells a search result nothing about who this is.
useHead({
  title: 'Jan Kevin Cadampog — .NET & Angular Developer',
  link: [
    /*
     * The hero mosaic is this page's LCP element and is painted from a CSS
     * background-image, which the preload scanner cannot discover.
     *
     * The hint lives here rather than in nuxt.config: from the config it fires
     * on every route, and a high-priority fetch for an image the page never
     * paints - /qr-generator, /gallery - competes with the assets those pages
     * actually need.
     */
    { rel: 'preload', as: 'image', href: '/images/main.webp', fetchpriority: 'high' },
  ],
})
</script>

<template>
  <main>
    <HeroSection />

    <!--
      The short version. The long one - how I got here, and the people it is
      for - lives on /about, which this links out to rather than inlining.
      The home page is the summary; it should not also be the biography.
    -->
    <PinnedHeadline
      eyebrow="About"
      text="I design and build full-stack web applications — focused on enterprise systems, clean APIs, and interfaces that get out of the way. Five years in, still chasing the craft."
      to="/about"
      cta="More about me"
    />

    <SelectedWork />

    <ExperienceSection />

    <SkillsSection />

    <CraftRevealSection />

    <ContactSection />
  </main>
</template>
