<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Work } from '~/utils/work/reel'

const props = defineProps<{
  work: Work
  index: number
  total: number
  manual?: boolean
}>()

const frame = ref<{ load: () => void; play: () => void; pause: () => void } | null>(null)
const root = ref<HTMLElement | null>(null)

const number = computed(() => String(props.index + 1).padStart(2, '0'))

defineExpose({
  root,
  load: () => frame.value?.load(),
  play: () => frame.value?.play(),
  pause: () => frame.value?.pause(),
})
</script>

<template>
  <!--
    One chapter of the reel. Each is a full-height card that sticks to the top
    while the next one slides over it; SelectedWork drives the motion and the
    playback, this only lays the chapter out.
  -->
  <article
    ref="root"
    class="chapter"
    :class="{ 'chapter--flip': props.index % 2 === 1 }"
    :style="{ '--tint': props.work.tint }"
    :aria-labelledby="`work-${props.work.slug}`"
  >
    <div class="chapter__inner" data-chapter-inner>
      <span class="chapter__number" aria-hidden="true" data-chapter-number>{{ number }}</span>

      <div class="container-edge chapter__grid">
        <header class="chapter__meta">
          <p class="eyebrow chapter__eyebrow" data-chapter-reveal>
            <span class="chapter__count">{{ number }} / {{ String(props.total).padStart(2, '0') }}</span>
            {{ props.work.category }}
          </p>

          <h3 :id="`work-${props.work.slug}`" class="font-display chapter__title" data-chapter-reveal>
            {{ props.work.name }}
            <span v-if="props.work.aka" class="chapter__aka">{{ props.work.aka }}</span>
          </h3>

          <p class="chapter__blurb" data-chapter-reveal>{{ props.work.blurb }}</p>

          <ul class="chapter__stack" aria-label="Built with" data-chapter-reveal>
            <li v-for="s in props.work.stack" :key="s">{{ s }}</li>
          </ul>

          <div class="chapter__foot" data-chapter-reveal>
            <p class="chapter__role">{{ props.work.role }} · {{ props.work.year }}</p>
            <a
              v-if="props.work.url"
              :href="props.work.url"
              target="_blank"
              rel="noopener noreferrer"
              class="chapter__link"
            >
              {{ props.work.cta ?? `Visit ${props.work.short}` }} <span aria-hidden="true">↗</span>
            </a>
            <span v-else class="chapter__private">Internal · no public link</span>
          </div>
        </header>

        <div class="chapter__screen" data-chapter-screen>
          <WorkBrowserFrame ref="frame" :work="props.work" :manual="props.manual" />
        </div>
      </div>

      <div class="chapter__shade" aria-hidden="true" data-chapter-shade />
    </div>
  </article>
</template>

<style scoped>
.chapter {
  /*
   * Sticky, so each chapter holds at the top while the next slides over it.
   * The cards are siblings in one container, which is what lets them pile up
   * instead of each leaving with its own parent.
   */
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100svh;
}

/* The gap between chapters is how long each one holds alone at the top. */
.chapter + .chapter {
  margin-top: var(--work-dwell);
}

.chapter__inner {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: 28px 28px 0 0;
  background:
    radial-gradient(60% 55% at var(--glow-x, 72%) 55%, color-mix(in srgb, var(--tint) 16%, transparent), transparent 70%),
    #0e0e0e;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow: 0 -30px 60px -10px rgba(0, 0, 0, 0.6);
  transform-origin: 50% 0%;
  will-change: transform;
}

.chapter--flip .chapter__inner {
  --glow-x: 28%;
}

/* A giant outlined chapter number behind everything, like a film slate. */
.chapter__number {
  position: absolute;
  right: -0.04em;
  bottom: -0.18em;
  font-family: 'Melodrama', 'General Sans', serif;
  font-size: clamp(12rem, 34vw, 34rem);
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255, 255, 255, 0.07);
  pointer-events: none;
  user-select: none;
}
.chapter--flip .chapter__number {
  right: auto;
  left: -0.04em;
}

.chapter__grid {
  position: relative;
  height: 100%;
  display: grid;
  align-content: center;
  gap: 1.75rem;
  padding-block: 4.5rem 2.5rem;
}

.chapter__eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.chapter__count {
  color: var(--tint);
  font-variant-numeric: tabular-nums;
}

.chapter__title {
  margin-top: 0.75rem;
  font-size: clamp(2.25rem, 5.2vw, 4.75rem);
  line-height: 1;
  text-wrap: balance;
}

.chapter__aka {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.42em;
  line-height: 1.15;
  font-style: italic;
  color: var(--color-accent);
}

.chapter__blurb {
  margin-top: 1rem;
  max-width: 34rem;
  color: var(--color-muted);
  font-size: 16px;
  line-height: 1.6;
}

.chapter__stack {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
}
.chapter__stack li {
  padding: 0.3rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  font-size: 13px;
  line-height: 1.4;
  color: #cfcfcf;
}

.chapter__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 1.5rem;
  margin-top: 1.75rem;
}
.chapter__role {
  font-size: 14px;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.chapter__link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  font-size: 14px;
  transition:
    background-color 0.3s var(--ease-out-expo),
    color 0.3s var(--ease-out-expo),
    border-color 0.3s var(--ease-out-expo);
}
.chapter__link:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg);
}
.chapter__private {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.chapter__screen {
  /* The 3D tilt the screen straightens out of as it arrives. */
  perspective: 1600px;
  /* Never taller than the card leaves room for, whatever the window shape. */
  width: min(100%, calc((100svh - 13rem) * 1.6));
  justify-self: center;
}

.chapter__shade {
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1023px) {
  .chapter__grid {
    /* Centred, so a tall phone does not leave the bottom half of the card empty. */
    align-content: start;
    align-content: safe center;
    gap: 1.25rem;
    /* The bottom keeps the chapter's link clear of the player bar. */
    padding-block: 4rem 4.75rem;
  }
  .chapter__screen {
    order: -1;
    width: 100%;
  }
  .chapter__title {
    margin-top: 0.5rem;
  }
  .chapter__blurb {
    margin-top: 0.75rem;
    font-size: 15px;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .chapter__stack {
    margin-top: 1rem;
  }
  .chapter__foot {
    margin-top: 1.25rem;
  }
}

@media (min-width: 1024px) {
  .chapter__grid {
    /* The recording is the point, so it gets two thirds. */
    grid-template-columns: minmax(20rem, 4fr) minmax(0, 8fr);
    gap: 3.5rem;
    align-items: center;
  }
  .chapter--flip .chapter__grid {
    grid-template-columns: minmax(0, 8fr) minmax(20rem, 4fr);
  }
  .chapter--flip .chapter__meta {
    order: 2;
  }
}

/* Short screens: drop the extras before the screen. */
@media (max-height: 640px) {
  .chapter__stack {
    display: none;
  }
}

/* Shorter phones - an iPhone SE, most budget Androids. */
@media (max-width: 1023px) and (max-height: 780px) {
  .chapter__grid {
    gap: 1rem;
    padding-top: 3.5rem;
  }
  .chapter__title {
    font-size: clamp(1.875rem, 8.5vw, 2.25rem);
  }
  .chapter__blurb {
    -webkit-line-clamp: 3;
  }
  .chapter__stack {
    display: none;
  }
  .chapter__foot {
    margin-top: 1rem;
  }
}

/*
 * Reduced motion: no stacking and no sticking. The chapters read as an
 * ordinary list of cards, each one simply following the last.
 */
@media (prefers-reduced-motion: reduce) {
  .chapter {
    position: relative;
    height: auto;
    min-height: 100svh;
  }
  .chapter + .chapter {
    margin-top: 0;
  }
  .chapter__inner {
    will-change: auto;
  }
}
</style>
