<script setup lang="ts">
const { siteUrl } = useRuntimeConfig().public
const route = useRoute()

const DESCRIPTION =
  'Jan Kevin Cadampog (JKC) — full-stack developer in Cebu City building enterprise web applications with .NET and Angular. Five years shipping production software.'

/** Absolute URL for the page being rendered - canonical and og:url need one. */
const canonical = computed(() => new URL(route.path, siteUrl as string).href)
const ogImage = computed(() => new URL('/images/main.webp', siteUrl as string).href)

useSeoMeta({
  description: DESCRIPTION,
  ogType: 'website',
  ogSiteName: 'Jan Kevin Cadampog',
  ogTitle: 'Jan Kevin Cadampog — .NET & Angular Developer',
  ogDescription: DESCRIPTION,
  ogImage: ogImage,
  ogImageAlt: 'Jan Kevin Cadampog',
  ogUrl: canonical,
  twitterCard: 'summary_large_image',
  twitterTitle: 'Jan Kevin Cadampog — .NET & Angular Developer',
  twitterDescription: DESCRIPTION,
  twitterImage: ogImage,
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      // Person schema: this is what lets a search engine connect the name to
      // the job title, location and social profiles rather than guessing.
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'Jan Kevin Cadampog',
          alternateName: 'JKC',
          url: siteUrl,
          image: ogImage.value,
          jobTitle: 'Software Engineer',
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
