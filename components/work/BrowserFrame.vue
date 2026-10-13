<script setup lang="ts">
import { ref } from 'vue'
import { clipPoster, clipSrc, type Work } from '~/utils/work/reel'

const props = defineProps<{
  work: Work
  /**
   * Show a play button instead of autoplaying - for reduced motion and
   * Save-Data, where nothing should start moving or downloading unasked.
   */
  manual?: boolean
}>()

const video = ref<HTMLVideoElement | null>(null)
const playing = ref(false)

const FILMED: Record<Work['filmed'], string> = {
  live: 'Recorded live',
  demo: 'Demo build',
  still: 'Still',
}

/**
 * Sources are written as `data-src` and attached on demand, so the page never
 * downloads eight clips just to render. Without JavaScript the poster stands
 * in, which is the same picture.
 */
function load() {
  const el = video.value
  if (!el || el.dataset.loaded) return
  el.querySelectorAll('source').forEach((s) => {
    if (s.dataset.src) s.src = s.dataset.src
  })
  el.dataset.loaded = '1'
  el.load()
}

function play() {
  const el = video.value
  if (!el) return
  load()
  // Muted and inline, so this needs no gesture; it can still be refused (a
  // battery saver, an old policy), in which case the poster simply stays.
  el.play().then(() => (playing.value = true), () => (playing.value = false))
}

function pause() {
  video.value?.pause()
  playing.value = false
}

defineExpose({ load, play, pause })
</script>

<template>
  <figure class="frame">
    <div class="frame__bar" aria-hidden="true">
      <span class="frame__dots"><i /><i /><i /></span>
      <span class="frame__url">{{ props.work.host }}</span>
      <span class="frame__tag" :class="`is-${props.work.filmed}`">{{ FILMED[props.work.filmed] }}</span>
    </div>

    <div class="frame__screen">
      <video
        ref="video"
        muted
        loop
        playsinline
        preload="none"
        disablepictureinpicture
        disableremoteplayback
        :poster="clipPoster(props.work.clip)"
        :aria-label="`Screen recording of ${props.work.name}`"
        @play="playing = true"
        @pause="playing = false"
      >
        <source :data-src="clipSrc(props.work.clip, true)" media="(max-width: 767px)" type="video/mp4" />
        <source :data-src="clipSrc(props.work.clip)" type="video/mp4" />
      </video>

      <button
        v-if="props.manual"
        type="button"
        class="frame__play"
        :class="{ 'is-playing': playing }"
        :aria-label="`${playing ? 'Pause' : 'Play'} the ${props.work.short} recording`"
        @click="playing ? pause() : play()"
      >
        <svg v-if="!playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
      </button>
    </div>
  </figure>
</template>

<style scoped>
.frame {
  position: relative;
  margin: 0;
  border-radius: 14px;
  overflow: hidden;
  background: #161616;
  border: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow:
    0 40px 80px -30px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(0, 0, 0, 0.6);
}

.frame__bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 2.25rem;
  padding: 0 0.875rem;
  background: #1b1b1b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
  line-height: 1;
}

.frame__dots {
  display: flex;
  gap: 6px;
  flex: none;
}
.frame__dots i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #3a3a3a;
}

.frame__url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  color: var(--color-muted);
  letter-spacing: 0.01em;
}

.frame__tag {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 10px;
}
.frame__tag::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.frame__tag.is-live::before {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

.frame__screen {
  position: relative;
  aspect-ratio: 16 / 10;
  background: #0d0d0d;
}

.frame__screen video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame__play {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  translate: -50% -50%;
  border-radius: 50%;
  color: var(--color-bg);
  background: var(--color-accent);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  transition: scale 0.3s var(--ease-out-expo), opacity 0.3s;
}
.frame__play svg {
  width: 1.5rem;
  height: 1.5rem;
}
.frame__play:hover {
  scale: 1.06;
}
/* Out of the way while the clip runs; back on hover or keyboard focus. */
.frame__play.is-playing {
  opacity: 0;
}
.frame:hover .frame__play.is-playing,
.frame__play.is-playing:focus-visible {
  opacity: 1;
}
.frame__play:focus-visible {
  outline: 2px solid var(--color-fg);
  outline-offset: 4px;
}
</style>
