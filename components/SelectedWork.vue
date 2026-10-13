<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { WORK, playhead } from '~/utils/work/reel'

/**
 * Selected work, as a reel.
 *
 * It opens on a showreel in a small window that scrolling opens to the full
 * screen. Then each project is a chapter: a full-height card with a recording
 * of the project, which sticks while the next one slides over it - the
 * screen straightening out of a tilt as it arrives, the one underneath sinking
 * back into the dark. A player bar along the bottom shows which chapter is on,
 * scrubs with the scroll, seeks on click, and pauses everything.
 *
 * Everything here is driven by the scroll position and one piece of geometry:
 * where the chapters start and how far apart they are. The cards are equal
 * heights with equal gaps, so chapter i reaches the top at `start + i * step`,
 * and that is all the playback, the animations and the player bar need. It is
 * computed rather than read off the cards because a stuck sticky element
 * reports where it is stuck, not where it sits in the page.
 */

interface ChapterHandle {
  root: HTMLElement | null
  load: () => void
  play: () => void
  pause: () => void
}
interface ReelHandle {
  root: HTMLElement | null
  video: HTMLVideoElement | null
  load: () => void
}

const reel = ref<ReelHandle | null>(null)
const chaptersEl = ref<HTMLElement | null>(null)
const chapters: ChapterHandle[] = []

const index = ref(0)
const within = ref(0)
const seconds = ref(0)
const hud = ref(false)
const paused = ref(false)
/** Reduced motion: nothing plays unasked, and each screen gets its own button. */
const manual = ref(false)

const durations = WORK.map((w) => w.clip.duration)
const n = WORK.length

function setChapter(el: unknown, i: number) {
  if (el) chapters[i] = el as ChapterHandle
}

let geo = { start: 0, step: 1, end: 0, reelTop: 0, reelEnd: 0 }
const startOf = (i: number) => geo.start + i * geo.step
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function measure() {
  const box = chaptersEl.value
  const first = chapters[0]?.root
  const reelRoot = reel.value?.root
  if (!box || !first || !reelRoot) return
  const second = chapters[1]?.root
  const dwell = second ? parseFloat(getComputedStyle(second).marginTop) || 0 : 0
  const top = box.getBoundingClientRect().top + window.scrollY
  const reelTop = reelRoot.getBoundingClientRect().top + window.scrollY
  geo = {
    start: top,
    step: first.offsetHeight + dwell,
    end: top + box.offsetHeight,
    reelTop,
    reelEnd: reelTop + reelRoot.offsetHeight,
  }
}

/** Which clips should be running, so play() is only called on a change. */
const running: boolean[] = []
let reelRunning = false

function update() {
  if (manual.value) return
  const y = window.scrollY
  const vh = window.innerHeight

  // Halfway up the screen is where a chapter counts as "on".
  const ph = playhead((y - (geo.start - vh * 0.5)) / (n * geo.step), durations)
  index.value = ph.index
  within.value = ph.within
  seconds.value = ph.seconds
  // Out once the last chapter has mostly scrolled away.
  hud.value = y > geo.start - vh * 0.6 && y < geo.end - vh * 0.3

  const leaving = clamp01((geo.end - y) / vh)
  for (let i = 0; i < n; i++) {
    const c = chapters[i]
    if (!c) continue
    const entered = clamp01((y - (startOf(i) - vh)) / vh)
    const covered = i + 1 < n ? clamp01((y - (startOf(i + 1) - vh)) / vh) : 0
    const shown = Math.min(entered, 1 - covered, leaving)

    // Fetch a clip about a screen before it arrives.
    const near = !paused.value && y > startOf(i) - vh * 2 && y < geo.end
    if (near) c.load()

    const want = !paused.value && shown > 0.3
    if (want !== !!running[i]) {
      running[i] = want
      want ? c.play() : c.pause()
    }
  }

  const r = reel.value
  if (r?.video) {
    if (!paused.value && y > geo.reelTop - vh * 2) r.load()
    const want = !paused.value && y > geo.reelTop - vh * 0.6 && y < geo.reelEnd - vh * 0.35
    if (want !== reelRunning) {
      reelRunning = want
      want ? r.video.play().catch(() => (reelRunning = false)) : r.video.pause()
    }
  }
}

function toggle() {
  paused.value = !paused.value
  update()
}

function seek(i: number) {
  const top = startOf(i) + 2
  const { $lenis } = useNuxtApp() as { $lenis?: { scrollTo: (y: number, o?: object) => void } }
  if ($lenis) $lenis.scrollTo(top, { duration: 1.4 })
  else window.scrollTo({ top, behavior: 'smooth' })
}

let mm: { revert: () => void } | null = null
let tracker: { kill: () => void } | null = null
let onRefreshInit: (() => void) | null = null

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    manual.value = true
    return
  }
  // Save-Data: the motion stays, but nothing downloads until play is pressed.
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) paused.value = true

  const { $gsap, $ScrollTrigger } = useNuxtApp() as any
  measure()

  if ($gsap && $ScrollTrigger) {
    onRefreshInit = measure
    $ScrollTrigger.addEventListener('refreshInit', onRefreshInit)
    mm = $gsap.matchMedia()
    ;(mm as any).add(
      { wide: '(min-width: 768px)', motion: '(prefers-reduced-motion: no-preference)' },
      (ctx: { conditions: { wide: boolean; motion: boolean } }) => {
        if (!ctx.conditions.motion) return
        animate($gsap, ctx.conditions.wide)
      },
    )
    // One trigger spanning the page: every scroll, wherever it lands.
    tracker = $ScrollTrigger.create({ start: 0, end: 'max', onUpdate: update, onRefresh: update })
  } else {
    window.addEventListener('scroll', update, { passive: true })
  }
  update()
})

function animate(gsap: any, wide: boolean) {
  const root = reel.value?.root
  if (root) {
    const q = (sel: string) => root.querySelector(sel)
    gsap
      .timeline({ scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
      .fromTo(
        q('[data-reel-window]'),
        { clipPath: wide ? 'inset(31% 34% 31% 34% round 24px)' : 'inset(36% 8% 36% 8% round 18px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', duration: 0.7 },
        0,
      )
      .fromTo(q('[data-reel-video]'), { scale: 1.2 }, { scale: 1, ease: 'none', duration: 0.7 }, 0)
      .to(q('[data-reel-a]'), { ...(wide ? { xPercent: -70 } : { yPercent: -140 }), opacity: 0, ease: 'none', duration: 0.45 }, 0)
      .to(q('[data-reel-b]'), { ...(wide ? { xPercent: 70 } : { yPercent: 140 }), opacity: 0, ease: 'none', duration: 0.45 }, 0)
      .to(q('[data-reel-hint]'), { opacity: 0, ease: 'none', duration: 0.12 }, 0)
      .fromTo(q('[data-reel-caption]'), { opacity: 0, y: 40 }, { opacity: 1, y: 0, ease: 'none', duration: 0.18 }, 0.72)
      .to({}, { duration: 0.1 })
  }

  chapters.forEach((c, i) => {
    const el = c?.root
    if (!el) return
    const screen = el.querySelector('[data-chapter-screen]')?.firstElementChild
    const vh = () => window.innerHeight

    // Arriving: the screen stands up out of a tilt and the copy rises in.
    gsap
      .timeline({ scrollTrigger: { start: () => startOf(i) - vh(), end: () => startOf(i), scrub: 0.5 } })
      .fromTo(
        screen,
        { rotateX: 20, yPercent: 16, scale: 0.86, transformOrigin: '50% 100%' },
        { rotateX: 0, yPercent: 0, scale: 1, ease: 'power2.out' },
        0,
      )
      .fromTo(
        el.querySelectorAll('[data-chapter-reveal]'),
        { y: 48, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.07, ease: 'power2.out', duration: 0.6 },
        0.25,
      )
      .fromTo(el.querySelector('[data-chapter-number]'), { yPercent: 35 }, { yPercent: 0, ease: 'none' }, 0)

    // Covered: sink back and darken as the next chapter slides over.
    if (i < n - 1) {
      gsap
        .timeline({ scrollTrigger: { start: () => startOf(i + 1) - vh(), end: () => startOf(i + 1), scrub: true } })
        .to(el.querySelector('[data-chapter-inner]'), { scale: wide ? 0.92 : 0.95, yPercent: -2, ease: 'none' }, 0)
        .to(el.querySelector('[data-chapter-shade]'), { opacity: 0.72, ease: 'none' }, 0)
    }
  })
}

onBeforeUnmount(() => {
  const { $ScrollTrigger } = useNuxtApp() as any
  if (onRefreshInit) $ScrollTrigger?.removeEventListener('refreshInit', onRefreshInit)
  tracker?.kill()
  mm?.revert()
  window.removeEventListener('scroll', update)
})
</script>

<template>
  <section id="work" class="work" aria-labelledby="work-heading">
    <WorkReelIntro ref="reel" />

    <div ref="chaptersEl" class="work__chapters">
      <WorkChapter
        v-for="(w, i) in WORK"
        :key="w.slug"
        :ref="(el) => setChapter(el, i)"
        :work="w"
        :index="i"
        :total="WORK.length"
        :manual="manual"
      />
    </div>

    <div class="container-edge work__outro">
      <p class="eyebrow">End of reel</p>
      <p class="font-display work__outro-line">Got something worth filming?</p>
      <a href="#contact" class="work__outro-cta">Start a project <span aria-hidden="true">→</span></a>
    </div>

    <WorkTimeline
      :work="WORK"
      :index="index"
      :within="within"
      :seconds="seconds"
      :visible="hud"
      :paused="paused"
      @seek="seek"
      @toggle="toggle"
    />
  </section>
</template>

<style scoped>
.work {
  position: relative;
  background: var(--color-bg);
}

.work__chapters {
  /* How long each chapter holds alone at the top before the next arrives. */
  --work-dwell: 35vh;
  position: relative;
}

@media (max-width: 1023px) {
  .work__chapters {
    --work-dwell: 18vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .work__chapters {
    --work-dwell: 0px;
  }
}

.work__outro {
  display: grid;
  justify-items: center;
  gap: 1.25rem;
  padding-block: 5rem 8rem;
  text-align: center;
}

@media (max-width: 767px) {
  .work__outro {
    padding-block: 3.5rem 6rem;
  }
}

.work__outro-line {
  font-size: clamp(2.25rem, 5vw, 4.5rem);
  line-height: 1;
}

.work__outro-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 1px solid var(--color-border, rgba(118, 118, 118, 0.35));
  border-radius: 9999px;
  font-size: 15px;
  transition:
    background-color 0.3s var(--ease-out-expo),
    color 0.3s var(--ease-out-expo);
}
.work__outro-cta:hover {
  background: var(--color-fg);
  color: var(--color-bg);
}
</style>
