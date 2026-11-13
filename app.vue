<script setup lang="ts">
import { pageUrl } from '~/utils/page-url'
const { siteUrl } = useRuntimeConfig().public
const route = useRoute()

const DESCRIPTION =
  'Jan Kevin Cadampog (JKC), Senior Software Engineer in Cebu City. Five years building websites and enterprise systems with .NET and Angular for companies in Japan, New Zealand and the Philippines.'

/** Absolute URL for the page being rendered - canonical and og:url need one. */
const canonical = computed(() => pageUrl(String(siteUrl), route.path))
const ogImage = computed(() => new URL('/images/main.webp', siteUrl as string).href)

useSeoMeta({
  description: DESCRIPTION,
  ogType: 'website',
  ogSiteName: 'Jan Kevin Cadampog',
  ogTitle: 'Jan Kevin Cadampog - Senior Software Engineer',
  ogDescription: DESCRIPTION,
  ogImage: ogImage,
  ogImageAlt: 'Jan Kevin Cadampog',
  ogUrl: canonical,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Jan Kevin Cadampog - Senior Software Engineer',
  twitterDescription: DESCRIPTION,
  twitterImage: ogImage,
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      // Person schema: this is what lets a search engine connect the name to
      // the job title, location and social profiles rather than guessing.
      // Keyed: the landing page (pages/index.vue) replaces it with a fuller
      // graph that holds this same Person under the same @id.
      type: 'application/ld+json',
      key: 'ld-person',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Person',
          '@id': `${String(siteUrl).replace(/\/$/, '')}/#person`,
          name: 'Jan Kevin Cadampog',
          alternateName: 'JKC',
          url: siteUrl,
          image: ogImage.value,
          jobTitle: 'Senior Software Engineer',
          description: DESCRIPTION,
          email: 'mailto:princejankevin@gmail.com',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Cebu City',
            addressCountry: 'PH',
          },
          worksFor: { '@type': 'Organization', name: 'OSL International Inc.' },
          knowsAbout: [
            '.NET',
            'C#',
            'Angular',
            'TypeScript',
            'SQL Server',
            'Tailwind CSS',
            'MongoDB',
          ],
          sameAs: [
            'https://github.com/iamprincejkc',
            'https://ph.linkedin.com/in/iamprincejkc',
            'https://dev.to/iamprincejkc',
          ],
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="min-h-screen bg-bg text-primary">
    <!--
      The portfolio shell moved into layouts/default.vue so the unlisted
      /gate and /gallery routes can opt into their own chrome. Pages that do
      not name a layout render exactly as before.
    -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
