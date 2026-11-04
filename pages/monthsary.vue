<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { MAX_PHOTOS, createMonthsaryScene, type MonthsaryScene, type ScenePhoto } from '../composables/useMonthsaryScene'
import { createMonthsarySky, type MonthsarySky } from '../composables/useMonthsarySky'
import { CAKE_TIMING } from '../utils/monthsary/cake'
import { FORMED } from '../utils/monthsary/choreography'
import { monthsaryLayout } from '../utils/monthsary/layout'
import type { MonthsaryPhoto } from '../server/utils/monthsary'

/**
 * /monthsary - an unlisted page for one person, opened from a link.
 *
 * The gallery's photos drift like /gallery/wall, get pulled into a tornado,
 * and land as "Happy Monthsary Langga". Fireworks start, a cake builds itself
 * underneath, and tapping the candle blows it out for the finale.
 *
 * No PIN: /api/monthsary/photos hands over image ids and nothing else. The
 * page opens on a "tap to open" gate because a phone will not start sound
 * before a tap - iOS never does on a first visit - and the song should begin
 * with the show, not halfway through it.
 *
 * This file only conducts. The motion is utils/monthsary/*, pure and tested;
 * the drawing is the two composables and the cake component.
 */

definePageMeta({ layout: 'blank' })

/**
 * The letter that opens over the cake once the candle is out, in JKC's own
 * words. The first sentence is set as its heading. An empty body shows nothing.
 */
const MESSAGE = {
  title: 'Happy monthsary, my love! ❤️',
  body:
    "I'm grateful to have you in my life. Thank you for all the love, patience, and happiness you bring me. " +
    "No matter the distance or challenges, I'll always choose you. " +
    "Here's to more months and memories together. I love you so much langga! ❤️",
}

const TITLE = 'Happy Monthsary, Langga'

useHead({
  title: TITLE,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  // Nothing on this page scrolls, and a pull-to-refresh mid-show would end it.
  htmlAttrs: { class: 'ms-lock' },
})

// What a link preview shows. The site-wide defaults describe the portfolio.
useSeoMeta({
  description: 'Tap to open.',
  ogTitle: TITLE,
  ogDescription: 'Tap to open.',
  twitterTitle: TITLE,
  twitterDescription: 'Tap to open.',
})

type Phase = 'loading' | 'gate' | 'show' | 'wish' | 'finale'

const phase = ref<Phase>('loading')
const reduced = ref(false)
/** No WebGL: the words are set in type instead of built from tiles. */
const flat = ref(false)
const glow = ref(false)
const cakeRunning = ref(false)
const cakeKey = ref(0)
const muted = ref(false)
const canReplay = ref(false)
const showLetter = ref(false)
const fading = ref(false)

// The server render uses a stand-in size; the real one arrives on mount,
// before anything sized from it is visible.
const layout = ref(monthsaryLayout(1440, 900))

const stage = ref<HTMLElement | null>(null)
const skyCanvas = ref<HTMLCanvasElement | null>(null)
const frontCanvas = ref<HTMLCanvasElement | null>(null)
const starsA = ref<HTMLCanvasElement | null>(null)
const starsB = ref<HTMLCanvasElement | null>(null)
const audio = ref<HTMLAudioElement | null>(null)
const openButton = ref<HTMLButtonElement | null>(null)

const { square } = useCloudinaryImage()

const box = (b: { x: number; y: number; width: number; height: number }) => ({
  left: `${b.x}px`,
  top: `${b.y}px`,
  width: `${b.width}px`,
  height: `${b.height}px`,
})

const cakeStyle = computed(() => box(layout.value.cake))
const haloStyle = computed(() => box(layout.value.text))

// Everything under the words is the letter's to use; the bottom edge is CSS, for the safe area.
const letterStyle = computed(() => ({ top: `${layout.value.text.y + layout.value.text.height}px` }))

// The heading's last word and the heart after it never part: an emoji alone on a line reads as a mistake.
const letterTitle = MESSAGE.title.replace(/ (?=\S+$)/, ' ')

/** The type fallback, sized so its widest line fills the box. */
const flatStyle = computed(() => {
  const { text, lines } = layout.value
  const longest = Math.max(...lines.map((line) => line.length))
  const size = Math.min(text.height / (lines.length * 1.08), text.width / (longest * 0.56))
  return { ...box(text), fontSize: `${size}px` }
})

let scene: MonthsaryScene | null = null
let sky: MonthsarySky | null = null
let frame = 0
let mountedAt = 0
let last = 0
let startedAt: number | null = null
let disposed = false
const timers: number[] = []

type Cue = { at: number; run: () => void }
let cues: Cue[] = []
let nextCue = 0

const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))

/** When the words are readable, in seconds from the tap. */
function wordsAt(): number {
  if (reduced.value) return 0.2
  return flat.value ? 1.2 : FORMED
}

function showCues(): Cue[] {
  const words = wordsAt()
  const cake = words + (reduced.value ? 0 : 0.6)
  return [
    {
      at: Math.max(0, words - 0.6),
      run: () => {
        glow.value = true
        if (!reduced.value) sky?.setMode('celebrate')
      },
    },
    { at: cake, run: () => (cakeRunning.value = true) },
    {
      at: cake + (reduced.value ? 0.6 : CAKE_TIMING.built + 0.4),
      // An early tap on the candle has already moved on to the finale.
      run: () => {
        if (phase.value === 'show') phase.value = 'wish'
      },
    },
  ]
}

function loop(now: number) {
  frame = requestAnimationFrame(loop)
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  const wall = (now - mountedAt) / 1000
  const show = startedAt === null ? null : (now - startedAt) / 1000

  // Reduced motion: a still wall, and the words in place the moment the show starts.
  scene?.render(reduced.value && show !== null ? FORMED + 0.5 : show, reduced.value ? 0 : wall)
  sky?.frame(dt, wall)

  if (show !== null) {
    while (nextCue < cues.length && show >= cues[nextCue].at) cues[nextCue++].run()
  }

  // A gentle fade-in. iOS ignores `volume` entirely, so there it simply starts.
  const player = audio.value
  if (player && !player.paused && player.volume < 0.7) player.volume = Math.min(0.7, player.volume + dt * 0.3)
}

function startShow() {
  startedAt = performance.now()
  cues = showCues()
  nextCue = 0
}

function open() {
  if (phase.value !== 'gate') return
  phase.value = 'show'
  startShow()

  // Called inside the tap's handler, which is the only place a browser allows it.
  const player = audio.value
  if (player) {
    player.volume = 0.05
    player.play().catch(() => (muted.value = true))
  }
}

function toggleSound() {
  const player = audio.value
  if (!player) return
  if (muted.value || player.paused) {
    player.muted = false
    player.play().then(() => (muted.value = false)).catch(() => (muted.value = true))
  } else {
    player.muted = true
    muted.value = true
  }
}

function blown() {
  phase.value = 'finale'
  if (!reduced.value) {
    sky?.salute(3)
    sky?.setMode('finale')
    sky?.rain(70)
    // The sky has its moment, then settles back to an easy show.
    later(6000, () => sky?.setMode('celebrate'))
  }
  // A beat after the first bursts, so the letter does not arrive on top of the tap.
  if (MESSAGE.body) later(reduced.value ? 300 : 1400, () => (showLetter.value = true))
  later(reduced.value ? 800 : 4000, () => (canReplay.value = true))
}

function replay() {
  canReplay.value = false
  showLetter.value = false
  fading.value = true
  sky?.setMode('off')
  while (timers.length) window.clearTimeout(timers.pop())

  later(700, () => {
    glow.value = false
    cakeRunning.value = false
    cakeKey.value += 1
    sky?.clear()
    phase.value = 'show'
    startShow()
    fading.value = false
  })
}

function measure() {
  layout.value = monthsaryLayout(window.innerWidth, window.innerHeight)
  sky?.setBand(layout.value.sky)
}

function webgl2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    // Lost straight away: browsers cap live contexts, and this one is only a probe.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

async function loadPhotos(): Promise<ScenePhoto[]> {
  try {
    const { photos } = await $fetch<{ photos: MonthsaryPhoto[] }>('/api/monthsary/photos')
    // A fresh sample every visit, so a big gallery is not always the same 64.
    const deck = [...photos]
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    return deck
      .slice(0, MAX_PHOTOS)
      .map((photo) => ({ src: square(photo.publicId, 256), color: photo.color }))
      .filter((photo) => photo.src)
  } catch {
    // No photos is not a reason to show nothing: the tiles fall back to colour.
    return []
  }
}

onMounted(async () => {
  reduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  measure()
  window.addEventListener('resize', measure)

  sky = createMonthsarySky(skyCanvas.value!, frontCanvas.value!, [starsA.value!, starsB.value!])
  sky.setBand(layout.value.sky)
  mountedAt = last = performance.now()
  frame = requestAnimationFrame(loop)

  const photos = await loadPhotos()
  if (disposed) return

  if (webgl2()) {
    try {
      const created = await createMonthsaryScene(stage.value!, photos)
      if (disposed) {
        created.destroy()
        return
      }
      scene = created
      await scene.ready
    } catch {
      flat.value = true
    }
  } else {
    flat.value = true
  }
  if (disposed) return

  phase.value = 'gate'
  await nextTick()
  openButton.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', measure)
  while (timers.length) window.clearTimeout(timers.pop())
  scene?.destroy()
  sky?.destroy()
  audio.value?.pause()
})
</script>

<template>
  <div
    class="ms"
    :class="{ 'is-fading': fading, 'is-reduced': reduced, 'is-finale': phase === 'finale', 'is-letter': showLetter }"
  >
    <h1 class="sr-only">Happy Monthsary, Langga</h1>

    <canvas ref="starsA" class="ms-layer ms-stars" aria-hidden="true" />
    <canvas ref="starsB" class="ms-layer ms-stars ms-stars--late" aria-hidden="true" />
    <div class="ms-halo" :class="{ 'is-on': glow }" :style="haloStyle" aria-hidden="true" />
    <canvas ref="skyCanvas" class="ms-layer ms-sky" aria-hidden="true" />
    <div ref="stage" class="ms-layer ms-stage" aria-hidden="true" />

    <p v-if="flat" class="ms-words" :class="{ 'is-on': glow }" :style="flatStyle" aria-hidden="true">
      <span v-for="line in layout.lines" :key="line">{{ line }}</span>
    </p>

    <MonthsaryCake
      :key="cakeKey"
      class="ms-cake"
      :style="cakeStyle"
      :width="layout.cake.width"
      :running="cakeRunning"
      :reduced="reduced"
      @blown="blown"
    />

    <canvas ref="frontCanvas" class="ms-layer ms-front" aria-hidden="true" />

    <div class="ms-caption" aria-live="polite">
      <Transition name="ms-fade">
        <p v-if="phase === 'wish'" class="ms-wish">Make a wish, then tap the candle</p>
      </Transition>
    </div>

    <!-- Always in the DOM, so screen readers announce the letter when it fills. -->
    <div class="ms-letter-slot" :style="letterStyle" aria-live="polite">
      <Transition name="ms-letter">
        <div v-if="showLetter" class="ms-letter">
          <p class="ms-letter__title">{{ letterTitle }}</p>
          <p class="ms-letter__body">{{ MESSAGE.body }}</p>
        </div>
      </Transition>
    </div>

    <div v-if="phase !== 'loading' && phase !== 'gate'" class="ms-controls">
      <Transition name="ms-fade">
        <button v-if="canReplay" type="button" class="ms-pill" @click="replay">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Watch again
        </button>
      </Transition>
      <button
        type="button"
        class="ms-round"
        :aria-label="muted ? 'Play the music' : 'Mute the music'"
        @click="toggleSound"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
          <template v-if="muted">
            <path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </template>
          <template v-else>
            <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </template>
        </svg>
      </button>
    </div>

    <Transition name="ms-gate">
      <div v-if="phase === 'loading' || phase === 'gate'" class="ms-gate">
        <p class="ms-gate__eyebrow">For you</p>
        <p class="ms-gate__title">Hi, Langga</p>
        <button
          ref="openButton"
          type="button"
          class="ms-gate__open"
          :disabled="phase === 'loading'"
          @click="open"
        >
          {{ phase === 'loading' ? 'One moment' : 'Tap to open' }}
        </button>
        <p class="ms-gate__hint">Turn your sound on</p>
      </div>
    </Transition>

    <audio ref="audio" src="/monthsary/ngiti.mp3" preload="auto" loop />
  </div>
</template>

<style>
/* Unscoped: this has to reach <html> and <body>, which the page does not own. */
html.ms-lock,
html.ms-lock body {
  overflow: hidden;
  overscroll-behavior: none;
  background: #07030a;
}
</style>

<style scoped>
.ms {
  position: fixed;
  inset: 0;
  overflow: hidden;
  color: #fff3f6;
  /* The night: a wine-dark glow overhead, falling off to near-black. */
  background:
    radial-gradient(ellipse 90% 60% at 50% 18%, #2d0f27 0%, rgba(45, 15, 39, 0) 70%),
    radial-gradient(ellipse 70% 40% at 50% 100%, rgba(120, 30, 70, 0.28) 0%, rgba(120, 30, 70, 0) 70%),
    #0b0510;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

/* A canvas is a replaced element: insets alone leave it at 300 x 150. */
.ms-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ms-stars {
  opacity: 0.9;
  animation: ms-twinkle 3.4s ease-in-out infinite alternate;
}

.ms-stars--late {
  animation-delay: -1.7s;
}

@keyframes ms-twinkle {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}

/*
 * While she reads, the fireworks burst behind the words. Once the candle is
 * out the sky comes forward: she has read them, and on a phone the words span
 * the screen, so a burst behind them is a burst nobody sees. The caption,
 * controls and gate stay above it.
 */
.is-finale .ms-sky {
  z-index: 1;
}

.ms-caption,
.ms-controls {
  z-index: 2;
}

.ms-stage,
.ms-cake,
.ms-halo,
.ms-words {
  transition: opacity 0.6s ease;
}

.is-fading .ms-stage,
.is-fading .ms-cake,
.is-fading .ms-halo,
.is-fading .ms-words {
  opacity: 0;
}

/* A blush behind the words once they form. A gradient, not a blur - see css-mistakes. */
.ms-halo {
  position: absolute;
  background: radial-gradient(closest-side, rgba(255, 93, 143, 0.2), rgba(255, 93, 143, 0) 100%);
  transform: scale(1.25, 1.6);
  opacity: 0;
  transition: opacity 1.6s ease;
  pointer-events: none;
}

.ms-halo.is-on {
  opacity: 1;
}

.ms-words {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-family: 'General Sans', system-ui, sans-serif;
  font-weight: 600;
  line-height: 1.05;
  color: #ffd1dc;
  text-align: center;
  text-shadow: 0 0 24px rgba(255, 93, 143, 0.45);
  opacity: 0;
  transition: opacity 1.2s ease;
}

.ms-words.is-on {
  opacity: 1;
}

.ms-caption {
  position: absolute;
  left: 50%;
  bottom: calc(3.5vh + env(safe-area-inset-bottom));
  width: min(34rem, calc(100% - 32px));
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}

.ms-wish {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #ffd1dc;
  animation: ms-bob 2.6s ease-in-out infinite;
}

/* Vue times a leave by the longer of transition and animation; an endless bob would hold it for 2.6s. */
.ms-wish.ms-fade-leave-active {
  animation: none;
}

@keyframes ms-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

/*
 * The letter takes the band under the words once the candle is out. The cake
 * steps back behind it rather than away - it is still the scene, just not
 * the thing to read.
 */
.is-letter .ms-cake {
  opacity: 0.3;
  transition-duration: 1.2s;
}

.ms-letter-slot {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: calc(3.5vh + env(safe-area-inset-bottom));
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.ms-letter {
  width: min(34rem, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 24px 24px 26px;
  border: 1px solid rgba(255, 209, 220, 0.2);
  border-radius: 22px;
  background: rgba(24, 9, 22, 0.74);
  box-shadow: 0 24px 70px -24px rgba(255, 93, 143, 0.55);
  backdrop-filter: blur(14px);
  text-align: center;
  pointer-events: auto;
  user-select: text;
}

.ms-letter__title {
  margin: 0 0 14px;
  font-family: 'Melodrama', 'General Sans', serif;
  font-size: clamp(28px, 7vw, 42px);
  line-height: 1.08;
  color: #fff3f6;
  text-shadow: 0 0 28px rgba(255, 93, 143, 0.5);
  text-wrap: balance;
}

.ms-letter__body {
  margin: 0;
  font-size: clamp(16px, 4.1vw, 18px);
  line-height: 1.6;
  color: rgba(255, 236, 242, 0.94);
}

/*
 * A phone held sideways: the whole letter has to fit in the strip under the
 * words. After the rules above on purpose - same specificity, so order wins.
 */
@media (max-height: 500px) {
  .ms-letter {
    width: min(40rem, 100%);
    padding: 12px 22px 14px;
  }

  .ms-letter__title {
    margin-bottom: 6px;
    font-size: 24px;
  }

  .ms-letter__body {
    font-size: 15px;
    line-height: 1.45;
  }
}

/* Translate and opacity only: the card carries a backdrop blur. */
.ms-letter-enter-active {
  transition: opacity 1s ease, transform 1s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ms-letter-leave-active {
  transition: opacity 0.5s ease;
}

.ms-letter-enter-from {
  opacity: 0;
  transform: translateY(18px);
}

.ms-letter-leave-to {
  opacity: 0;
}

.ms-controls {
  position: absolute;
  top: calc(14px + env(safe-area-inset-top));
  right: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ms-round,
.ms-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  color: #ffe3ec;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.ms-round {
  width: 44px;
}

.ms-pill {
  padding: 0 16px 0 14px;
}

.ms-round:hover,
.ms-pill:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.26);
}

.ms-round:focus-visible,
.ms-pill:focus-visible,
.ms-gate__open:focus-visible {
  outline: 2px solid #ffd1dc;
  outline-offset: 3px;
}

.ms-gate {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  /* Dims the drifting wall behind it without hiding it. */
  background: radial-gradient(ellipse at center, rgba(11, 5, 16, 0.45) 0%, rgba(11, 5, 16, 0.82) 75%);
}

.ms-gate__eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(255, 209, 220, 0.75);
}

.ms-gate__title {
  margin: 14px 0 34px;
  font-family: 'Melodrama', 'General Sans', serif;
  font-size: clamp(56px, 14vw, 128px);
  line-height: 0.95;
  color: #fff3f6;
  text-shadow: 0 0 40px rgba(255, 93, 143, 0.45);
}

.ms-gate__open {
  position: relative;
  min-width: 190px;
  padding: 16px 34px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffc2d3 0%, #ff8fb1 100%);
  color: #3b0a20;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 10px 40px -8px rgba(255, 93, 143, 0.6);
  cursor: pointer;
  transition: opacity 0.3s ease, transform 0.2s ease;
}

.ms-gate__open:hover:not(:disabled) {
  transform: translateY(-1px);
}

.ms-gate__open:disabled {
  opacity: 0.55;
  cursor: progress;
}

/* A ring that breathes outward once the gate is ready. No filter on it, so the scale is free. */
.ms-gate__open:not(:disabled)::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 2px solid rgba(255, 143, 177, 0.7);
  animation: ms-ring 2.2s ease-out infinite;
  pointer-events: none;
}

@keyframes ms-ring {
  0% {
    opacity: 0.8;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.3, 1.6);
  }
}

.ms-gate__hint {
  margin: 18px 0 0;
  font-size: 13px;
  color: rgba(255, 209, 220, 0.6);
}

.ms-gate-leave-active {
  transition: opacity 0.8s ease, transform 0.8s ease;
}

.ms-gate-leave-to {
  opacity: 0;
  transform: scale(1.04);
}

.ms-fade-enter-active,
.ms-fade-leave-active {
  transition: opacity 0.6s ease;
}

.ms-fade-enter-from,
.ms-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ms-stars,
  .ms-wish,
  .ms-gate__open::after {
    animation: none;
  }

  .ms-gate-leave-to,
  .ms-letter-enter-from {
    transform: none;
  }
}
</style>
