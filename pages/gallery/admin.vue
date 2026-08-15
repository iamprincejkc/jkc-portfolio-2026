<script setup lang="ts">
import { computed } from 'vue'

definePageMeta({ layout: 'gallery' })

useHead({
  title: 'Upload — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

// The gate middleware already requires an admin session for /gallery/admin,
// and every admin endpoint re-checks it server-side.
const { data, refresh } = useGalleryPhotos()

const photos = computed(() => data.value?.photos ?? [])
</script>

<template>
  <GallerySetupNotice v-if="data && !data.configured" />

  <div v-else class="container-edge pb-[clamp(4rem,10vw,8rem)]">
    <section class="pt-[clamp(2.5rem,7vw,5rem)]">
      <p class="eyebrow">Admin</p>
      <h1 class="font-display headline-lg mt-5">Add to the gallery.</h1>
      <p class="mt-6 max-w-prose text-sm text-text-muted">
        Files upload straight to Cloudinary from this browser. Fill in the details
        first — they are written into the asset’s metadata and drive the titles,
        filters and captions on the gallery.
      </p>
    </section>

    <div class="mt-[clamp(2.5rem,6vw,4rem)]">
      <GalleryUploader @uploaded="refresh()" />
    </div>

    <section class="mt-[clamp(4rem,10vw,7rem)]">
      <h2 class="eyebrow">In the gallery ({{ photos.length }})</h2>
      <div class="mt-6">
        <GalleryManager :photos="photos" @deleted="refresh()" />
      </div>
    </section>
  </div>
</template>
