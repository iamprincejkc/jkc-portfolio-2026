<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ layout: 'gallery' })

const route = useRoute()
const { data, pending } = useGalleryPhotos()
const { src, srcset, videoSrc, videoPoster } = useCloudinaryImage()

const key = computed(() => {
  const slug = route.params.slug
  return slugKey(Array.isArray(slug) ? slug : [slug].filter(Boolean) as string[])
})

// Filtered so a hidden asset is not reachable by guessing its URL, and so
// previous/next only walks what the feed actually shows.
const photos = computed(() => (data.value?.photos ?? []).filter(isVisible))
const index = computed(() => photos.value.findIndex((photo) => photo.slug.join('/') === key.value))
const photo = computed(() => (index.value === -1 ? null : photos.value[index.value]))
const previous = computed(() => (index.value > 0 ? photos.value[index.value - 1] : null))
const next = computed(() =>
  index.value !== -1 && index.value < photos.value.length - 1
    ? photos.value[index.value + 1]
    : null,
)

useHead(() => ({
  title: photo.value ? `${photo.value.title} — JKC` : 'Gallery — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}))

const loaded = ref(false)
</script>

<template>
  <p v-if="pending" class="eyebrow container-edge py-32 text-center">Loading</p>

  <div v-else-if="!photo" class="container-edge max-w-2xl py-[clamp(4rem,12vw,9rem)]">
    <p class="eyebrow">404</p>
    <h1 class="font-display headline-lg mt-5">No frame<br />at this address.</h1>
    <p class="mt-6 text-sm text-text-muted">It may have been deleted, or the link is wrong.</p>
    <NuxtLink
      to="/gallery"
      class="eyebrow mt-10 inline-block border border-accent px-6 py-4 !text-accent transition-colors duration-normal hover:bg-accent hover:!text-text-inverse"
    >
      Back to gallery
    </NuxtLink>
  </div>

  <article v-else class="container-edge pb-[clamp(4rem,10vw,8rem)]">
    <div class="flex items-center justify-between gap-4 py-5">
      <NuxtLink to="/gallery" class="eyebrow hover:text-primary transition-colors duration-fast">
        ← Gallery
      </NuxtLink>
      <p class="eyebrow tabular-nums">
        {{ String(index + 1).padStart(2, '0') }} / {{ String(photos.length).padStart(2, '0') }}
      </p>
    </div>

    <div
      class="frame w-full"
      :style="{
        aspectRatio: `${photo.width} / ${photo.height}`,
        backgroundColor: photo.color,
        maxHeight: 'calc(100dvh - var(--gallery-header-h) - 8rem)',
      }"
    >
      <video
        v-if="photo.kind === 'video'"
        :src="videoSrc(photo.publicId, 1920)"
        :poster="videoPoster(photo.publicId, 1920)"
        controls
        playsinline
        preload="metadata"
        class="!object-contain"
        :aria-label="photo.alt"
        @loadeddata="loaded = true"
      />
      <img
        v-else
        :src="src(photo.publicId)"
        :srcset="srcset(photo.publicId)"
        sizes="100vw"
        :alt="photo.alt"
        :width="photo.width"
        :height="photo.height"
        fetchpriority="high"
        decoding="async"
        class="!object-contain"
        :data-loaded="String(loaded)"
        @load="loaded = true"
      />
    </div>

    <header
      class="mt-[clamp(2rem,5vw,3.5rem)] grid gap-8 border-t border-border-muted pt-8 lg:grid-cols-[1.4fr_1fr] lg:gap-16"
    >
      <div>
        <h1 class="font-display headline-lg">{{ photo.title }}</h1>
        <p v-if="photo.client" class="mt-4 text-base text-text-muted">{{ photo.client }}</p>
      </div>

      <dl class="grid content-start">
        <div class="flex items-baseline justify-between gap-6 border-b border-border-muted py-3">
          <dt class="eyebrow shrink-0">Year</dt>
          <dd class="truncate text-right text-sm">{{ photo.year || '—' }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-6 border-b border-border-muted py-3">
          <dt class="eyebrow shrink-0">Category</dt>
          <dd class="truncate text-right text-sm">{{ photo.tags.join(', ') || '—' }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-6 border-b border-border-muted py-3">
          <dt class="eyebrow shrink-0">Dimensions</dt>
          <dd class="truncate text-right text-sm">{{ photo.width }} × {{ photo.height }}</dd>
        </div>
        <div
          v-if="photo.kind === 'video' && photo.duration"
          class="flex items-baseline justify-between gap-6 border-b border-border-muted py-3"
        >
          <dt class="eyebrow shrink-0">Duration</dt>
          <dd class="truncate text-right text-sm tabular-nums">
            {{ formatDuration(photo.duration) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-6 py-3">
          <dt class="eyebrow shrink-0">Full size</dt>
          <dd><GalleryLightbox :photo="photo" /></dd>
        </div>
      </dl>
    </header>

    <nav class="mt-[clamp(4rem,10vw,8rem)] grid border-t border-border-muted sm:grid-cols-2">
      <div class="flex flex-col gap-2 py-8">
        <span class="eyebrow">Previous</span>
        <NuxtLink
          v-if="previous"
          :to="galleryHref(previous)"
          class="text-xl tracking-tight transition-colors duration-fast hover:text-accent"
        >
          {{ previous.title }}
        </NuxtLink>
        <span v-else class="text-text-muted">—</span>
      </div>
      <div class="flex flex-col gap-2 py-8 sm:items-end sm:text-right">
        <span class="eyebrow">Next</span>
        <NuxtLink
          v-if="next"
          :to="galleryHref(next)"
          class="text-xl tracking-tight transition-colors duration-fast hover:text-accent"
        >
          {{ next.title }}
        </NuxtLink>
        <span v-else class="text-text-muted">—</span>
      </div>
    </nav>
  </article>
</template>
