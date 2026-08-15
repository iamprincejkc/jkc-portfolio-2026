<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createParallaxWall, type WallHandle } from '../../composables/useParallaxWall'

definePageMeta({ layout: 'gallery' })

useHead({
  title: 'Wall — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { data, pending } = useGalleryPhotos()
const { url } = useCloudinaryImage()

// Video cannot be a WebGL texture here, and hidden kinds stay hidden.
const photos = computed(() =>
  (data.value?.photos ?? []).filter((photo) => isVisible(photo) && photo.kind === 'image'),
)

const container = ref<HTMLElement | null>(null)
const status = ref<'idle' | 'running' | 'unsupported' | 'empty'>('idle')
const reducedMotion = ref(false)

let wall: WallHandle | null = null

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

async function start() {
  if (wall || !container.value) return

  if (!photos.value.length) {
    status.value = 'empty'
    return
  }
  if (!webglAvailable()) {
    status.value = 'unsupported'
    return
  }

  // 600px is plenty for a 260px tile at 2x, and keeps the texture upload
  // cheap - this route loads far more images at once than the grid does.
  wall = await createParallaxWall(container.value, photos.value, (photo) =>
    url(photo.publicId, 600, { quality: 'eco' }),
  )
  status.value = 'running'
}

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Photos may arrive after mount on a cold navigation.
  if (!pending.value) void start()
})

watch(pending, (isPending) => {
  if (!isPending) void start()
})

onBeforeUnmount(() => {
  wall?.destroy()
  wall = null
})
</script>

<template>
  <div class="wall">
    <div ref="container" class="wall__canvas" aria-hidden="true" />

    <!--
      The canvas is decorative and opaque to assistive tech, so the photo names
      are also listed as text. It is visually hidden rather than absent.
    -->
    <ul class="sr-only">
      <li v-for="photo in photos" :key="photo.publicId">{{ photo.alt }}</li>
    </ul>

    <div v-if="status !== 'running'" class="wall__notice">
      <p v-if="pending" class="eyebrow">Loading</p>
      <template v-else-if="status === 'empty'">
        <p class="eyebrow">Nothing to show</p>
        <p class="mt-3 text-sm text-text-muted">Upload some photos and the wall fills itself.</p>
      </template>
      <template v-else-if="status === 'unsupported'">
        <p class="eyebrow">WebGL unavailable</p>
        <p class="mt-3 max-w-sm text-sm text-text-muted">
          This view needs WebGL, which this browser has disabled or does not
          support. The gallery works without it.
        </p>
        <NuxtLink
          to="/gallery"
          class="eyebrow mt-6 inline-block border border-accent px-5 py-3 !text-accent transition-colors duration-normal hover:bg-accent hover:!text-text-inverse"
        >
          Back to the gallery
        </NuxtLink>
      </template>
    </div>

    <div v-if="status === 'running'" class="wall__hint">
      <p class="eyebrow">
        <span v-if="reducedMotion">Motion paused &middot; drag to move</span>
        <template v-else>
          <span class="hidden sm:inline">
            Scroll to speed up &middot; drag to steer &middot; double-click to reshuffle
          </span>
          <!-- No wheel on touch, so do not advertise it. -->
          <span class="sm:hidden">Drag to steer &middot; double-tap to reshuffle</span>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.wall {
  position: relative;
  /* Fills what is left below the gallery header. */
  height: calc(100dvh - var(--gallery-header-h));
  overflow: hidden;
  background: var(--color-bg);
}

.wall__canvas {
  position: absolute;
  inset: 0;
  cursor: grab;
  touch-action: none;
}

.wall__canvas:active {
  cursor: grabbing;
}

.wall__notice {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.5rem;
}

.wall__hint {
  position: absolute;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  padding: 0.625rem 1rem;
  border-radius: 3px;
  background: rgba(10, 10, 10, 0.6);
  backdrop-filter: blur(8px);
  pointer-events: none;
}
</style>
