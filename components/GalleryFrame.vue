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

const { src, srcset, videoPoster, videoSrc } = useCloudinaryImage()
const loaded = ref(false)
const video = ref<HTMLVideoElement | null>(null)

/*
 * Video tiles show a poster until hover, then play muted and looping. The
 * source is only attached on first hover, so a grid of videos costs nothing
 * to scroll past - otherwise every tile would start buffering on load.
 */
const videoArmed = ref(false)

function play() {
  if (props.photo.kind !== 'video') return
  videoArmed.value = true
  // The element may not exist yet on the very first hover.
  requestAnimationFrame(() => video.value?.play().catch(() => undefined))
}

function pause() {
  if (props.photo.kind !== 'video') return
  video.value?.pause()
}
</script>

<template>
  <article class="g-reveal">
    <NuxtLink
      :to="galleryHref(photo)"
      class="frame-link block group"
      @mouseenter="play"
      @mouseleave="pause"
    >
      <div
        class="frame"
        :style="{
          aspectRatio: `${photo.width} / ${photo.height}`,
          backgroundColor: photo.color,
        }"
      >
        <!-- Still image -->
        <img
          v-if="photo.kind === 'image'"
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

        <!-- Video: poster first, source attached on hover -->
        <template v-else>
          <img
            v-show="!videoArmed"
            :src="videoPoster(photo.publicId)"
            :alt="photo.alt"
            :width="photo.width"
            :height="photo.height"
            :loading="props.priority ? 'eager' : 'lazy'"
            decoding="async"
            :data-loaded="String(loaded)"
            @load="loaded = true"
          />
          <video
            v-if="videoArmed"
            ref="video"
            :src="videoSrc(photo.publicId)"
            :poster="videoPoster(photo.publicId)"
            muted
            loop
            playsinline
            preload="none"
            :aria-label="photo.alt"
          />

          <span class="frame__badge">
            <template v-if="photo.duration">{{ formatDuration(photo.duration) }}</template>
            <template v-else>Video</template>
          </span>
        </template>
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
          {{ String(index + 1).padStart(2, '0')
          }}<template v-if="photo.year"> / {{ photo.year }}</template>
        </p>
      </div>
    </NuxtLink>
  </article>
</template>

<style scoped>
.frame video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Marks a tile as video without needing a play triangle over the artwork. */
.frame__badge {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 2;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  background: rgba(10, 10, 10, 0.72);
  backdrop-filter: blur(6px);
  color: #fafafa;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}
</style>
