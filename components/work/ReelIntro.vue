<script setup lang="ts">
import { ref } from 'vue'
import { REEL, WORK, clipPoster, clipSrc } from '~/utils/work/reel'

const root = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)

const years = WORK.map((w) => Number(w.year))
const span = `${Math.min(...years)}–${Math.max(...years)}`

function load() {
  const el = video.value
  if (!el || el.dataset.loaded) return
  el.querySelectorAll('source').forEach((s) => {
    if (s.dataset.src) s.src = s.dataset.src
  })
  el.dataset.loaded = '1'
  el.load()
}

defineExpose({ root, video, load })
</script>

<template>
  <!--
    The opening shot. A small window plays the showreel between the two words
    of the heading; scrolling opens it to the full screen and pushes the words
    out, the way a title card gives way to the film. The runway is the extra
    height on .reel, and the stage sticks while it is used up.
  -->
  <div ref="root" class="reel">
    <div class="reel__stage">
      <h2 id="work-heading" class="reel__title font-display">
        <span class="reel__word reel__word--a" data-reel-a>Selected</span>
        <span class="reel__word reel__word--b" data-reel-b>work</span>
      </h2>

      <div class="reel__window" data-reel-window>
        <video
          ref="video"
          class="reel__video"
          muted
          loop
          playsinline
          preload="none"
          disablepictureinpicture
          disableremoteplayback
          :poster="clipPoster(REEL)"
          aria-label="Showreel: two seconds of each project below"
          data-reel-video
        >
          <source :data-src="clipSrc(REEL, true)" media="(max-width: 767px)" type="video/mp4" />
          <source :data-src="clipSrc(REEL)" type="video/mp4" />
        </video>
        <div class="reel__vignette" aria-hidden="true" />
      </div>

      <div class="reel__caption" data-reel-caption>
        <p class="eyebrow">Showreel · {{ WORK.length }} projects · {{ span }}</p>
        <p class="reel__lede">
          Every project below is a recording of the real thing. Keep scrolling to play them one by one.
        </p>
      </div>

      <p class="reel__hint eyebrow" aria-hidden="true" data-reel-hint>Scroll to play</p>
    </div>
  </div>
</template>

<style scoped>
.reel {
  position: relative;
  height: 220vh;
  height: 220svh;
}

.reel__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100svh;
  overflow: hidden;
}

/*
 * The window starts as a small rounded inset of a full-screen video and opens
 * to the edges. Only `clip-path` moves, so the video is laid out once at full
 * size and never resized mid-scroll.
 */
.reel__window {
  position: absolute;
  inset: 0;
  clip-path: inset(31% 34% 31% 34% round 24px);
  background: #111;
}

.reel__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.2);
  transform-origin: 50% 50%;
}

/* Keeps the caption readable over any frame of the reel. */
.reel__vignette {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to top, rgba(10, 10, 10, 0.92), rgba(10, 10, 10, 0.25) 45%, transparent 70%),
    linear-gradient(to bottom, rgba(10, 10, 10, 0.5), transparent 20%);
  pointer-events: none;
}

.reel__title {
  position: absolute;
  inset: 0;
  z-index: 2;
  /* Two columns either side of the window, so each word hugs its own edge. */
  display: grid;
  grid-template-columns: 1fr 34vw 1fr;
  align-items: center;
  font-size: clamp(3.5rem, 7.6vw, 9rem);
  line-height: 0.9;
  pointer-events: none;
  white-space: nowrap;
}

.reel__word--a {
  grid-column: 1;
  justify-self: end;
}

.reel__word--b {
  grid-column: 3;
  justify-self: start;
  font-style: italic;
  color: var(--color-accent);
}

.reel__caption {
  position: absolute;
  z-index: 3;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 1.5rem 3rem;
  max-width: 1600px;
  margin-inline: auto;
}

.reel__lede {
  margin-top: 0.75rem;
  max-width: 30rem;
  font-size: 18px;
  line-height: 1.5;
}

.reel__hint {
  position: absolute;
  z-index: 3;
  left: 50%;
  bottom: 2rem;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.reel__hint::after {
  content: '';
  width: 1px;
  height: 2.5rem;
  background: linear-gradient(var(--color-muted), transparent);
  animation: reel-hint 2.2s var(--ease-out-expo) infinite;
  transform-origin: top;
}

@keyframes reel-hint {
  0% { transform: scaleY(0); }
  50% { transform: scaleY(1); }
  100% { transform: scaleY(1); opacity: 0; }
}

@media (min-width: 1024px) {
  .reel__caption {
    padding: 0 3rem 3.5rem;
  }
}

/* Phones: the words sit above and below a wider window instead of beside it. */
@media (max-width: 767px) {
  .reel {
    height: 190vh;
    height: 190svh;
  }
  .reel__window {
    clip-path: inset(36% 8% 36% 8% round 18px);
  }
  .reel__title {
    grid-template-columns: none;
    grid-template-rows: 1fr 32svh 1fr;
    justify-items: center;
    font-size: clamp(3.25rem, 17vw, 5rem);
  }
  .reel__word--a {
    grid-row: 1;
    grid-column: auto;
    align-self: end;
    justify-self: center;
  }
  .reel__word--b {
    grid-row: 3;
    grid-column: auto;
    align-self: start;
    justify-self: center;
  }
}

/*
 * Reduced motion: no runway and no zoom. The reel is a still, framed under
 * the heading, and the caption is simply there.
 */
@media (prefers-reduced-motion: reduce) {
  .reel {
    height: auto;
  }
  .reel__stage {
    position: relative;
    height: auto;
    display: grid;
    gap: 2rem;
    padding: 6rem 1.5rem 3rem;
  }
  .reel__title {
    position: relative;
    display: flex;
    gap: 0.25em;
  }
  .reel__window {
    position: relative;
    aspect-ratio: 16 / 10;
    clip-path: inset(0 round 18px);
  }
  .reel__video {
    transform: none;
  }
  .reel__caption {
    position: relative;
    padding: 0;
    opacity: 1;
  }
  .reel__hint {
    display: none;
  }
}
</style>
