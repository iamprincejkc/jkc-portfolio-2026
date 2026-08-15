<script setup lang="ts">
import { useNuxtApp } from 'nuxt/app'
import { onMounted, onBeforeUnmount, ref } from 'vue'

const heroRef = ref<HTMLElement | null>(null)
const tilesRef = ref<HTMLElement | null>(null)

const COLS = 12
const ROWS = 16
const tiles = Array.from({ length: COLS * ROWS }, (_, i) => i)

const offsets: { x: number; y: number; r: number }[] = tiles.map(() => ({
  x: (Math.random() - 0.5) * 80,
  y: (Math.random() - 0.5) * 80,
  r: (Math.random() - 0.5) * 45,
}))

const isAssembled = ref(false)


onMounted(() => {
  const { $gsap } = useNuxtApp() as any
  if (!$gsap || !heroRef.value || !tilesRef.value) return

  // Set tiles to their shattered resting state immediately on mount.
  const tileEls = tilesRef.value.querySelectorAll<HTMLElement>('.tile')
  tileEls.forEach((el, i) => {
    const o = offsets[i]
    $gsap.set(el, {
      x: o.x,
      y: o.y,
      rotation: o.r,
      opacity: 0.6 + ((i * 37) % 40) / 100,
    })
  })

  // Then run the page-load entrance animation
  const els = heroRef.value.querySelectorAll('[data-hero-reveal]')
  $gsap.from(els, {
    y: 40,
    opacity: 0,
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.08,
    delay: 0.15,
  })
})

// Hover IN → assemble the image
function assemble() {
  if (!tilesRef.value) return
  const { $gsap } = useNuxtApp() as any
  if (!$gsap) return
  const tileEls = tilesRef.value.querySelectorAll<HTMLElement>('.tile')
  $gsap.killTweensOf(tileEls)
  isAssembled.value = true
  $gsap.to(tileEls, {
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 1,
    duration: 0.55,
    ease: 'power3.out',
    overwrite: 'auto',
  })
}

// Hover OUT → break apart again
function shatter() {
  if (!tilesRef.value) return
  const { $gsap } = useNuxtApp() as any
  if (!$gsap) return
  const tileEls = tilesRef.value.querySelectorAll<HTMLElement>('.tile')
  $gsap.killTweensOf(tileEls)
  isAssembled.value = false
  tileEls.forEach((el, i) => {
    const o = offsets[i]
    $gsap.to(el, {
      x: o.x,
      y: o.y,
      rotation: o.r,
      opacity: 0.6 + ((i * 37) % 40) / 100,
      duration: 0.6,
      ease: 'expo.inOut',
      overwrite: 'auto',
    })
  })
}

onBeforeUnmount(() => {})
</script>
<template>
  <section
    ref="heroRef"
    class="hero relative min-h-[100dvh] overflow-hidden"
  >
    <!-- Top-left: portfolio label -->
    <div class="hero__corner hero__corner--tl" data-hero-reveal>
      <p class="eyebrow">Portfolio · 2026</p>
    </div>

    <!-- Top-right: meta + Spotify -->
    <div class="hero__corner hero__corner--tr" data-hero-reveal>
      <p class="text-text-muted text-sm">Located in</p>
      <p class="text-lg">Cebu City, Philippines</p>

      <p class="text-text-muted text-sm mt-6">Currently</p>
      <p class="text-lg">
        Software Engineer<br />
        <span class="text-text-muted">@ OSL International</span>
      </p>

      <!--
        Served from our own /api/now-playing rather than a third-party widget.
        The old one shared an OAuth token that kept getting revoked, and it
        signalled failure with 200 + text/html, so the browser painted a broken
        image here. This renders nothing when Spotify is unconfigured.
      -->
      <div class="mt-8 flex flex-col items-end text-right">
        <NowPlaying />
      </div>
    </div>

    <!-- Center stage: name on left, portrait centered -->
    <div class="hero__stage">
      <h1 class="hero__name" data-hero-reveal>
        <span class="block">Jan&nbsp;Kevin</span>
        <span class="block italic text-accent">Cadampog</span>
      </h1>

      <!-- Tile-grid portrait. The hidden <img class="sizer"> gives the box
           its natural aspect ratio so the photo never stretches. -->
        <div
          class="hero__portrait"
          data-hero-reveal
          @mouseenter="assemble"
          @mouseleave="shatter"
          @click="isAssembled ? shatter() : assemble()"
        >
        <img src="/images/main.webp" alt="" class="sizer" aria-hidden="true" />
        <div ref="tilesRef" class="tile-grid">
          <div
            v-for="i in tiles"
            :key="i"
            class="tile"
            :style="{
              '--col': i % COLS,
              '--row': Math.floor(i / COLS),
            } as any"
          ></div>
        </div>
      </div>
    </div>

    <!-- Bottom-left: rotating titles -->
    <div class="hero__corner hero__corner--bl" data-hero-reveal>
      <div class="flex flex-wrap items-baseline gap-x-3 text-lg md:text-xl">
        <span class="text-text-muted">I am a</span>
        <span class="rotator font-display italic text-accent">
          <span class="rotator__track">
            <span>.NET Developer.</span>
            <span>Angular Engineer.</span>
            <span>Full-Stack Builder.</span>
            <span>.NET Developer.</span>
          </span>
        </span>
      </div>
    </div>

    <!-- Bottom marquee -->
    <div class="hero__marquee" data-hero-reveal>
      <MarqueeRow text="Building enterprise systems and digital products" />
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding-top: 6rem;
  padding-bottom: 2rem;
}

.hero__corner {
  position: absolute;
  z-index: 5;
  padding: 1.5rem;
}
.hero__corner--tl { top: 5rem; left: 0; }
.hero__corner--tr { top: 5rem; right: 0; text-align: right; }
.hero__corner--bl { bottom: 5rem; left: 0; }

@media (min-width: 1024px) {
  .hero__corner { padding: 3rem; }
}

.hero__stage {
  position: relative;
  width: 100%;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero__name {
  position: absolute;
  left: 1.5rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  font-family: 'Melodrama', 'General Sans', serif;
  font-weight: 500;
  font-size: clamp(56px, 9vw, 132px);
  line-height: 0.92;
  letter-spacing: -0.03em;
  color: #fafafa;
  max-width: 50vw;
}
@media (min-width: 1024px) {
  .hero__name { left: 3rem; }
}

/* ===== Portrait as a tile grid =====
   The .sizer img (visibility:hidden but still laid out) gives the container
   its natural aspect ratio. The .tile-grid overlays absolutely on top. */
.hero__portrait {
  position: relative;
  z-index: 2;
  width: clamp(280px, 32vw, 480px);
  cursor: pointer;
  -webkit-mask-image: radial-gradient(
    ellipse 78% 82% at 50% 45%,
    black 58%,
    transparent 94%
  );
  mask-image: radial-gradient(
    ellipse 78% 82% at 50% 45%,
    black 58%,
    transparent 94%
  );
}

.hero__portrait img.sizer {
  display: block;
  width: 100%;
  height: auto;
  visibility: hidden;
  pointer-events: none;
}

.tile-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(16, 1fr);
}

.tile {
  position: relative;
  background-image: url('/images/main.webp');
  background-size: 1200% 1600%;
  background-position:
    calc(var(--col) * 100% / 11)
    calc(var(--row) * 100% / 15);
  background-repeat: no-repeat;
  will-change: transform, opacity;
  transform-origin: center;
  /* Bleed 0.5px on each side so neighboring tiles overlap and seams vanish */
  margin: -0.5px;
}

.hero__marquee {
  position: absolute;
  bottom: 1rem;
  left: 0;
  right: 0;
  z-index: 4;
}

/* --- Mobile --- */
/*
 * Switch to a clean vertical stack below the desktop breakpoint.
 *
 * This must stop exactly where the desktop refinements start (min-width:
 * 1024px). It previously ended at 767px, which left 768-1023px running the
 * absolutely-positioned desktop composition without its desktop sizing: the
 * name kept `max-width: 50vw`, so "Cadampog" overflowed its box and printed
 * straight over the meta column.
 */
@media (max-width: 1023px) {
  .hero {
    padding-top: 5rem;
    padding-bottom: 2rem;
    min-height: auto;
  }

  /* All corners become normal-flow blocks, stacked top to bottom */
  .hero__corner {
    position: static;
    padding: 0 1.5rem;
    margin-bottom: 2rem;
    text-align: left;
  }
  .hero__corner--tr {
    text-align: left;
  }

  /* Shrink the Spotify card so it doesn't dominate the screen */
  .hero__corner--tr .mt-8 {
    max-width: 220px;
    align-items: flex-start;
    text-align: left;
  }

  /* Stage becomes vertical, no fixed viewport height */
  .hero__stage {
    flex-direction: column;
    height: auto;
    min-height: auto;
    gap: 2rem;
    padding: 0 1.5rem;
    margin-bottom: 3rem;
  }

  /* Name back to normal flow, full width above portrait */
  .hero__name {
    position: static;
    transform: none;
    max-width: 100%;
    font-size: clamp(48px, 12vw, 84px);
  }

  /* Portrait centered below name */
  .hero__portrait {
    width: 70vw;
    max-width: 320px;
    margin: 0 auto;
    opacity: 1;
  }

  /* Marquee stays at the bottom but in flow, not absolute */
  .hero__marquee {
    position: static;
    margin-top: 2rem;
  }
}
</style>