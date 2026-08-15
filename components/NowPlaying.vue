<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { NowPlaying } from '../server/api/now-playing.get'

/**
 * The now-playing card.
 *
 * Data comes from our own /api/now-playing, which holds the Spotify refresh
 * token server-side. The card renders nothing at all when Spotify is not
 * configured or nothing has been played, so the hero never shows a hole.
 */

const REFRESH_MS = 30_000

const { data, refresh } = await useFetch<NowPlaying>('/api/now-playing', {
  key: 'now-playing',
  default: () => ({ configured: false }) as NowPlaying,
})

const state = computed(() => data.value)

const track = computed(() =>
  state.value && state.value.configured && 'track' in state.value ? state.value.track : null,
)

const isPlaying = computed(
  () => Boolean(state.value && state.value.configured && 'playing' in state.value && state.value.playing),
)

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Only poll while the tab is visible. A background tab hitting Spotify every
  // 30s forever is pure waste.
  const tick = () => {
    if (document.visibilityState === 'visible') void refresh()
  }
  timer = setInterval(tick, REFRESH_MS)
  document.addEventListener('visibilitychange', tick)

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', tick)
  })
})
</script>

<template>
  <div v-if="track" class="now-playing">
    <p class="text-text-muted text-sm mb-2">
      {{ isPlaying ? 'Currently listening' : 'Last played' }}
    </p>

    <a
      :href="track.url"
      target="_blank"
      rel="noopener noreferrer"
      class="now-playing__card group"
    >
      <img
        v-if="track.albumArt"
        :src="track.albumArt"
        alt=""
        width="56"
        height="56"
        loading="lazy"
        decoding="async"
        class="now-playing__art"
      />

      <span class="now-playing__meta">
        <span class="now-playing__title">{{ track.title }}</span>
        <span class="now-playing__artist">{{ track.artist }}</span>
      </span>

      <!-- Four bars, only animated while something is actually playing. -->
      <span v-if="isPlaying" class="now-playing__eq" aria-hidden="true">
        <i v-for="n in 4" :key="n" :style="{ animationDelay: `${n * 0.13}s` }" />
      </span>
    </a>
  </div>
</template>

<style scoped>
.now-playing {
  width: 100%;
  max-width: 280px;
}

.now-playing__card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem;
  border: 1px solid var(--color-muted);
  border-color: rgba(118, 118, 118, 0.25);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.03);
  transition:
    border-color 0.3s var(--ease-out-expo),
    background 0.3s var(--ease-out-expo);
}

.now-playing__card:hover {
  border-color: var(--color-accent);
  background: rgba(255, 255, 255, 0.06);
}

.now-playing__art {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 2px;
}

.now-playing__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.now-playing__title {
  font-size: 13px;
  line-height: 1.3;
  color: var(--color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.now-playing__card:hover .now-playing__title {
  color: var(--color-accent);
}

.now-playing__artist {
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Equaliser ---- */
.now-playing__eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
  flex-shrink: 0;
}

.now-playing__eq i {
  display: block;
  width: 2px;
  height: 100%;
  background: var(--color-accent);
  transform-origin: bottom;
  animation: eq 1.1s ease-in-out infinite;
}

@keyframes eq {
  0%,
  100% {
    transform: scaleY(0.25);
  }
  50% {
    transform: scaleY(1);
  }
}

/*
 * A looping animation with no pause is a textbook vestibular trigger. Freeze
 * the bars at a static level rather than removing them, so the card still
 * reads as "playing".
 */
@media (prefers-reduced-motion: reduce) {
  .now-playing__eq i {
    animation: none;
    transform: scaleY(0.55);
  }
}
</style>
