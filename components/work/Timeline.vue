<script setup lang="ts">
import { computed } from 'vue'
import { timecode, type Work } from '~/utils/work/reel'

const props = defineProps<{
  work: Work[]
  /** The chapter on screen, and how far through it the scroll is (0..1). */
  index: number
  within: number
  seconds: number
  visible: boolean
  paused: boolean
}>()

const emit = defineEmits<{ seek: [index: number]; toggle: [] }>()

const total = computed(() => props.work.reduce((sum, w) => sum + w.clip.duration, 0))
const current = computed(() => props.work[props.index]!)

function fill(i: number) {
  if (i < props.index) return 1
  if (i > props.index) return 0
  return props.within
}
</script>

<template>
  <!--
    The section dressed as a video player: chapters as segments of a scrub
    bar, the playhead driven by the scroll, the timecode summed from the real
    clip lengths. Seeking scrolls to the chapter; the button pauses every clip,
    which is also how anything moving on its own for more than five seconds
    has to be stoppable.
  -->
  <div class="timeline" :class="{ 'is-visible': props.visible }" :aria-hidden="!props.visible">
    <button
      type="button"
      class="timeline__toggle"
      :aria-pressed="props.paused"
      :aria-label="props.paused ? 'Play the project recordings' : 'Pause the project recordings'"
      :tabindex="props.visible ? 0 : -1"
      @click="emit('toggle')"
    >
      <svg v-if="props.paused" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
    </button>

    <p class="timeline__now">
      <span class="timeline__num">{{ String(props.index + 1).padStart(2, '0') }}</span>
      <span class="timeline__name">{{ current.short }}</span>
    </p>

    <ol class="timeline__bar">
      <li v-for="(w, i) in props.work" :key="w.slug" :style="{ flexGrow: w.clip.duration }">
        <button
          type="button"
          class="timeline__seg"
          :class="{ 'is-current': i === props.index }"
          :aria-label="`Chapter ${i + 1}: ${w.name}`"
          :aria-current="i === props.index ? 'step' : undefined"
          :tabindex="props.visible ? 0 : -1"
          @click="emit('seek', i)"
        >
          <span class="timeline__fill" :style="{ transform: `scaleX(${fill(i)})` }" />
          <span class="timeline__tip" aria-hidden="true">{{ w.short }}</span>
        </button>
      </li>
    </ol>

    <p class="timeline__time" aria-hidden="true">
      {{ timecode(props.seconds) }} <span>/ {{ timecode(total) }}</span>
    </p>
  </div>
</template>

<style scoped>
.timeline {
  position: fixed;
  z-index: 40;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 1rem;
  width: min(calc(100% - 2rem), 56rem);
  padding: 0.5rem 1.25rem 0.5rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  background: rgba(14, 14, 14, 0.72);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  backdrop-filter: blur(16px) saturate(1.4);
  box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.8);
  translate: -50% 140%;
  opacity: 0;
  pointer-events: none;
  transition:
    translate 0.6s var(--ease-out-expo),
    opacity 0.4s var(--ease-out-expo);
}

.timeline.is-visible {
  translate: -50% 0;
  opacity: 1;
  pointer-events: auto;
}

.timeline__toggle {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--color-accent);
  color: var(--color-bg);
  transition: scale 0.3s var(--ease-out-expo);
}
.timeline__toggle svg {
  width: 1.1rem;
  height: 1.1rem;
}
.timeline__toggle:hover {
  scale: 1.06;
}

.timeline__now {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 10.5rem;
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
}
.timeline__num {
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}
.timeline__name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline__bar {
  flex: 1;
  display: flex;
  gap: 4px;
  min-width: 0;
}
.timeline__bar li {
  flex-basis: 0;
  min-width: 0;
}

.timeline__seg {
  position: relative;
  display: block;
  width: 100%;
  /* A thin bar with a tall hit area. */
  height: 1.75rem;
}
.timeline__seg::before,
.timeline__fill {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 3px;
  margin-top: -1.5px;
  border-radius: 2px;
}
.timeline__seg::before {
  background: rgba(255, 255, 255, 0.16);
}
.timeline__fill {
  background: var(--color-fg);
  transform-origin: left center;
}
.timeline__seg.is-current .timeline__fill {
  background: var(--color-accent);
}
.timeline__seg:hover::before {
  background: rgba(255, 255, 255, 0.32);
}

.timeline__tip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.5rem);
  translate: -50% 4px;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  background: #1f1f1f;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s,
    translate 0.3s var(--ease-out-expo);
}
.timeline__seg:hover .timeline__tip,
.timeline__seg:focus-visible .timeline__tip {
  opacity: 1;
  translate: -50% 0;
}

.timeline__time {
  flex: none;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.timeline__time span {
  color: var(--color-muted);
}

/*
 * Phones: one slim row - button, chapter number, bar, time. The chapter's own
 * heading names it, so the bar does not need to, and every pixel of height it
 * gives back is a pixel of the chapter it is not covering.
 */
@media (max-width: 767px) {
  .timeline {
    gap: 0.625rem;
    width: calc(100% - 1.5rem);
    padding: 0.3125rem 0.875rem 0.3125rem 0.3125rem;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
  }
  .timeline__toggle {
    width: 2.125rem;
    height: 2.125rem;
  }
  .timeline__now {
    width: auto;
  }
  .timeline__name {
    display: none;
  }
  .timeline__bar {
    gap: 3px;
  }
  .timeline__seg {
    height: 1.5rem;
  }
  .timeline__tip {
    display: none;
  }
  .timeline__time span {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline {
    display: none;
  }
}
</style>
