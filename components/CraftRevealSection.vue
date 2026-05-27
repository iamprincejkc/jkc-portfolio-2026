<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

// Six scattered project thumbnails. Edit these freely — each can move
// independently because positions are inline. (left/top are % of section.)
const thumbs = [
  { image: '/images/project-ibc.webp',     top: '8%',  left: '22%',  rotate: -3, w: 280 },
  { image: '/images/project-gis.webp',     top: '5%',  left: '70%',  rotate:  4, w: 300 },
  { image: '/images/project-jet.webp',     top: '38%', left: '12%',  rotate: -5, w: 320 },
  { image: '/images/project-hope.webp',    top: '34%', left: '68%',  rotate:  6, w: 280 },
  { image: '/images/project-rdgcash.webp', top: '68%', left: '8%',   rotate:  3, w: 240 },
  { image: '/images/project-anime.webp',   top: '70%', left: '58%',  rotate: -4, w: 280 },
]

const sectionRef = ref<HTMLElement | null>(null)
const pinRef = ref<HTMLElement | null>(null)
const thumbRefs = ref<HTMLElement[]>([])
const revealRef = ref<HTMLElement | null>(null)
const text1Ref = ref<HTMLElement | null>(null)
const text2Ref = ref<HTMLElement | null>(null)
const isDesktop = ref(true)
let st: any = null

onMounted(() => {
  // Skip the pinned multi-stage effect on mobile — render a simple statement.
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
  if (!isDesktop.value) return

  const { $gsap, $ScrollTrigger } = useNuxtApp() as any
  if (!$gsap || !$ScrollTrigger || !sectionRef.value || !pinRef.value) return

  // ---- Initial state ------------------------------------------------------
  $gsap.set(thumbRefs.value, { opacity: 0, scale: 0.4, transformOrigin: 'center' })
  $gsap.set(revealRef.value, { opacity: 0, scale: 0.35, transformOrigin: 'center' })
  $gsap.set(text2Ref.value, { opacity: 0 })

  // ---- Master timeline ---------------------------------------------------
  // 4× viewport of scroll length for the full pinned story.
  const tl = $gsap.timeline({
    scrollTrigger: {
      trigger: sectionRef.value,
      start: 'top top',
      end: '+=400%',
      pin: pinRef.value,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })

  // Scene 1 (0 → 0.25): thumbnails fade in at small scale, scattered.
  tl.to(
    thumbRefs.value,
    { opacity: 1, scale: 0.85, stagger: 0.03, ease: 'none' },
    0
  )

  // Scene 2 (0.25 → 0.5): thumbnails grow larger — same positions, bigger.
  tl.to(
    thumbRefs.value,
    { scale: 1.25, ease: 'none' },
    0.25
  )

  // Scene 3 (0.5 → 0.65): thumbnails fly out & fade; reveal image appears small.
  tl.to(
    thumbRefs.value,
    { opacity: 0, scale: 1.6, ease: 'none' },
    0.5
  )
  tl.to(
    revealRef.value,
    { opacity: 1, scale: 0.55, ease: 'none' },
    0.5
  )

  // Scene 4 (0.65 → 1): reveal image scales to fullscreen + text crossfade.
  tl.to(revealRef.value, { scale: 3.2, ease: 'none' }, 0.65)
  tl.to(text1Ref.value,  { opacity: 0, ease: 'none' }, 0.65)
  tl.to(text2Ref.value,  { opacity: 1, ease: 'none' }, 0.78)

  st = tl.scrollTrigger
})

onBeforeUnmount(() => {
  if (st) st.kill()
})
</script>

<template>
  <section
    ref="sectionRef"
    class="craft-reveal"
  >
    <!-- DESKTOP: pinned multi-stage reveal -->
    <div v-if="isDesktop" ref="pinRef" class="craft-reveal__pin">
      <!-- Layer 1: scattered project thumbnails (z-1) -->
      <div class="craft-reveal__thumbs">
        <div
          v-for="(t, i) in thumbs"
          :key="i"
          :ref="(el) => { if (el) thumbRefs[i] = el as HTMLElement }"
          class="craft-thumb"
          :style="{
            top: t.top,
            left: t.left,
            width: t.w + 'px',
            transform: `rotate(${t.rotate}deg)`,
          }"
        >
          <img :src="t.image" alt="" class="block w-full h-auto rounded-xs shadow-lg" />
        </div>
      </div>

      <!-- Layer 2: reveal image (z-2) -->
      <div class="craft-reveal__image-wrap">
        <div ref="revealRef" class="craft-reveal__image">
          <NuxtImg
            src="/images/me.jpg"
            alt="Jan Kevin Cadampog"
            class="block w-full h-full object-cover"
          />
        </div>
      </div>

      <!-- Layer 3: text (z-3, always centered) -->
      <h2 ref="text1Ref" class="craft-reveal__text craft-reveal__text--dark">
        <span class="font-display">less noise.</span><br />
        <span class="font-display italic">more craft.</span>
      </h2>

      <h2 ref="text2Ref" class="craft-reveal__text craft-reveal__text--light">
        <span class="font-display italic">Got something to build?</span><br />
        <a
          href="#contact"
          class="font-display italic underline decoration-1 underline-offset-[0.18em] pointer-events-auto"
        >
          Let&apos;s talk →
        </a>
      </h2>
    </div>

    <!-- MOBILE: static statement section -->
    <div v-else class="craft-reveal__mobile">
      <div class="craft-reveal__mobile-image">
        <NuxtImg
          src="/images/me.jpg"
          alt="Jan Kevin Cadampog"
          class="w-full h-full object-cover"
        />
      </div>
      <h2 class="craft-reveal__mobile-text">
        <span class="font-display">less noise.</span><br />
        <span class="font-display italic">more craft.</span>
      </h2>
      <a
        href="#contact"
        class="craft-reveal__mobile-cta font-display italic"
      >
        Got something to build? Let&apos;s talk →
      </a>
    </div>
  </section>
</template>

<style scoped>
.craft-reveal {
  background: #f3f3f3;
  color: #0a0a0a;
  position: relative;
}

.craft-reveal__pin {
  position: relative;
  height: 100vh;
  overflow: hidden;
}

.craft-reveal__thumbs {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.craft-thumb {
  position: absolute;
  will-change: transform, opacity;
}

.craft-thumb img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
}

.craft-reveal__image-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  pointer-events: none;
}

.craft-reveal__image {
  width: min(56vw, 720px);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  will-change: transform, opacity;
  filter: grayscale(100%) brightness(0.85);
}

.craft-reveal__text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  text-align: center;
  font-size: clamp(40px, 8vw, 112px);
  line-height: 1;
  letter-spacing: -0.02em;
  pointer-events: none;
  will-change: opacity;
}

.craft-reveal__text--dark {
  color: #0a0a0a;
}

.craft-reveal__text--light {
  color: #fafafa;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.4);
}

/* Mobile: shrink thumbnails so they don't overflow */
@media (max-width: 768px) {
  .craft-thumb {
    width: 140px !important;
  }
  .craft-reveal__image {
    width: 80vw;
  }
}

/* Mobile fallback: simple static statement (no pin, no scrub) */
.craft-reveal__mobile {
  padding: 5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2rem;
}
.craft-reveal__mobile-image {
  width: min(78vw, 360px);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 4px;
  filter: grayscale(100%) brightness(0.85);
}
.craft-reveal__mobile-text {
  font-size: clamp(40px, 12vw, 72px);
  line-height: 1;
  letter-spacing: -0.02em;
  color: #0a0a0a;
}
.craft-reveal__mobile-cta {
  font-size: 1.25rem;
  color: #0a0a0a;
  text-decoration: underline;
  text-underline-offset: 0.18em;
  text-decoration-thickness: 1px;
}
</style>
