<script setup lang="ts">
import { ref } from 'vue'
import type { Photo } from '../composables/useGallery'

const props = withDefaults(
  defineProps<{
    photo: Photo
    index: number
    /** True for the first row - these are the LCP candidates. */
    priority?: boolean
  }>(),
  { priority: false },
)

const { src, srcset } = useCloudinaryImage()
const loaded = ref(false)
</script>

<template>
  <article class="g-reveal">
    <NuxtLink :to="galleryHref(photo)" class="frame-link block group">
      <div
        class="frame"
        :style="{
          aspectRatio: `${photo.width} / ${photo.height}`,
          backgroundColor: photo.color,
        }"
      >
        <img
          :src="src(photo.publicId)"
          :srcset="srcset(photo.publicId)"
          sizes="(min-width: 1024px) 58vw, (min-width: 640px) 50vw, 100vw"
          :alt="photo.alt"
          :width="photo.width"
          :height="photo.height"
          :loading="props.priority ? 'eager' : 'lazy'"
          :fetchpriority="props.priority ? 'high' : undefined"
          decoding="async"
          :data-loaded="String(loaded)"
          @load="loaded = true"
        />
      </div>

      <div class="mt-4 flex items-baseline justify-between gap-4">
        <div class="min-w-0">
          <h2
            class="truncate text-lg leading-tight tracking-tight transition-colors duration-fast group-hover:text-accent"
          >
            {{ photo.title }}
          </h2>
          <p v-if="photo.client" class="mt-1 truncate text-xs text-text-muted">
            {{ photo.client }}
          </p>
        </div>
        <p class="eyebrow shrink-0 tabular-nums">
          {{ String(index + 1).padStart(2, '0') }}<template v-if="photo.year"> / {{ photo.year }}</template>
        </p>
      </div>
    </NuxtLink>
  </article>
</template>
