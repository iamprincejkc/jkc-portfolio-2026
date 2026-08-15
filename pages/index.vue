<script setup lang="ts">
// The descriptive title lives in nuxt.config so it applies everywhere. A page
// title of "JKC" tells a search result nothing about who this is.
useHead({
  title: 'Jan Kevin Cadampog — .NET & Angular Developer',
})
</script>

<template>
  <main>
    <HeroSection />

    <PinnedHeadline
      eyebrow="About"
      text="I design and build full-stack web applications — focused on enterprise systems, clean APIs, and interfaces that get out of the way. Five years in, still chasing the craft."
    />

    <SelectedWork />

    <ExperienceSection />

    <FamilySection />

    <SkillsSection />

    <CraftRevealSection />

    <ContactSection />
  </main>
</template>
