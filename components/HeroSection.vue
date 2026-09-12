<script setup lang="ts">
import { useNuxtApp } from 'nuxt/app'
import { onMounted, onBeforeUnmount, ref } from 'vue'

const heroRef = ref<HTMLElement | null>(null)
const tilesRef = ref<HTMLElement | null>(null)

const COLS = 12
const ROWS = 16
const tiles = Array.from({ length: COLS * ROWS }, (_, i) => i)

/**
 * Where each tile goes when the portrait comes apart.
 *
 * The old version gave every tile the same uniform random nudge, which is why
 * it read as static rather than as something breaking: noise in all directions
 * at one amplitude has no centre, so the eye never finds the face inside it.
 *
 * Each tile now flies *outward from the middle*, and how far it travels grows
 * with the square of its distance from the centre. That is the whole trick -
 * the middle of the face barely moves while the edges scatter, so the portrait
 * blooms open and stays recognisable the whole way. Angle carries a little
 * jitter so it is a bloom and not a perfect starburst, and rotation and scale
 * both scale with distance so the outer tiles tumble and recede while the
 * inner ones stay flat and near.
 *
 * Deliberately 2D. `scale` reads as depth here just as well as a real `z`
 * would, and using it avoids putting a `perspective`/`preserve-3d` subtree
 * inside `.hero__portrait`'s radial mask - a masked element wrapping a 3D
 * scene is exactly the kind of compositing arrangement that bites.
 */
const CX = (COLS - 1) / 2
const CY = (ROWS - 1) / 2
const MAX_DIST = Math.hypot(CX, CY)

interface TileOffset {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
}

const offsets: TileOffset[] = tiles.map((i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const dx = col - CX
  const dy = row - CY
  /** 0 at the centre of the face, 1 at the corners. */
  const dist = Math.hypot(dx, dy) / MAX_DIST
  const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.7
  const travel = 26 + dist * dist * 200

  return {
    x: Math.cos(angle) * travel,
    y: Math.sin(angle) * travel,
    rotation: (Math.random() - 0.5) * 80 * (0.3 + dist),
    scale: 1 - dist * 0.5 + (Math.random() - 0.5) * 0.12,
    opacity: Math.max(0, 0.92 - dist * 0.8),
  }
})

let shatterTrigger: { kill: (revert?: boolean) => void } | null = null

onMounted(() => {
  const { $gsap, $ScrollTrigger } = useNuxtApp() as any
  if (!$gsap || !heroRef.value || !tilesRef.value) return

  const tileEls = tilesRef.value.querySelectorAll<HTMLElement>('.tile')

  /*
   * The portrait now rests *assembled*.
   *
   * It used to rest shattered and reassemble on hover, which meant the first
   * thing anyone saw on a page about a person was an unrecognisable scatter -
   * and on a phone, where there is no hover and nothing said the image could
   * be touched, that was the only thing they ever saw. Resting assembled puts
   * the face on screen for everyone and keeps the effect for the scroll.
   */
  /*
   * Rest scale is 1.02, not 1.
   *
   * The grid is 12 x 16 over a width set by `clamp()`, so a tile is almost
   * never a whole number of pixels. The CSS already bleeds each one by half a
   * pixel, but at the widths where the rounding lands badly a hairline of
   * background still shows through a row or a column - which never mattered
   * while the portrait rested shattered and matters now that it rests whole.
   * Two percent is under a pixel of growth on a 40px tile: invisible as
   * scaling, enough to close the seam.
   */
  $gsap.set(tileEls, { x: 0, y: 0, rotation: 0, scale: 1.02, opacity: 1 })

  const els = heroRef.value.querySelectorAll('[data-hero-reveal]')
  $gsap.from(els, {
    y: 40,
    opacity: 0,
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.08,
    delay: 0.15,
  })

  /*
   * Coming apart is tied to scroll rather than to the pointer, so it happens
   * once, in view, for everybody - mouse, touch and keyboard alike.
   *
   * `prefers-reduced-motion` skips it outright: the portrait simply stays
   * whole, which is the better still image anyway.
   */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!$ScrollTrigger) return

  const timeline = $gsap.timeline({
    scrollTrigger: {
      trigger: heroRef.value,
      start: 'top top',
      /*
       * Fully apart about two-thirds of a screen down, not when the hero
       * finally leaves. Running the break over the hero's whole height would
       * spend most of the animation below the fold, where nobody is looking.
       */
      end: '+=70%',
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  })

  timeline.to(tileEls, {
    x: (i: number) => offsets[i].x,
    y: (i: number) => offsets[i].y,
    rotation: (i: number) => offsets[i].rotation,
    scale: (i: number) => offsets[i].scale,
    opacity: (i: number) => offsets[i].opacity,
    ease: 'power2.in',
    duration: 1,
    /*
     * Edges first, so the face is the last thing to go.
     *
     * `from: 'center'` does the opposite - it releases the middle first and
     * dissolves the features while the border is still intact, which looks
     * like the image failing rather than coming apart.
     *
     * `amount` rather than `each`: `each: 0.006` across 192 tiles spreads the
     * stagger over 1.15s against a 0.5s tween, so barely a dozen tiles are
     * ever in motion together and it reads as a wipe. Holding the whole
     * spread to roughly half the tween duration keeps most of the grid moving
     * at once, which is what makes it a bloom.
     */
    stagger: { amount: 0.55, from: 'edges', grid: [ROWS, COLS] },
  })

  shatterTrigger = timeline.scrollTrigger
})

onBeforeUnmount(() => {
  shatterTrigger?.kill()
})
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

      <!--
        Tile-grid portrait. The hidden <img class="sizer"> gives the box its
        natural aspect ratio so the photo never stretches.

        `role="img"` with a name, because the picture is built out of 192
        empty divs painting slices of a background image - there is nothing
        here a screen reader could otherwise announce, on the one page where
        the portrait is the subject. It carries no handlers: scroll drives the
        effect now, so this is a picture rather than a control, and it should
        not advertise itself as something to click.
      -->
      <div class="hero__portrait" role="img" aria-label="Jan Kevin Cadampog" data-hero-reveal>
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
  /* No `cursor: pointer` - scroll drives the effect, so this is not a control. */
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
  /*
   * Name first, details after.
   *
   * The desktop layout puts the meta block in the top-right corner, where it
   * sits *beside* the name. Stacked for a phone in source order it landed
   * *above* it, so the first screen of a page about a person was "Located in
   * / Cebu City / Currently / Software Engineer" at full size, and the name
   * itself did not appear until you scrolled. Measured: the first project was
   * 2.7 screens down.
   *
   * Ordering the flex children fixes it without touching the markup or the
   * desktop layout: you get the name and face, then what he is, then the
   * where and the what-he-is-listening-to.
   */
  .hero {
    display: flex;
    flex-direction: column;
    padding-top: 5rem;
    padding-bottom: 2rem;
    min-height: auto;
  }

  .hero__corner--tl { order: 1; }
  .hero__stage { order: 2; }
  .hero__corner--bl { order: 3; }
  .hero__corner--tr { order: 4; }
  .hero__marquee { order: 5; }

  /* All corners become normal-flow blocks, stacked top to bottom */
  .hero__corner {
    position: static;
    padding: 0 1.5rem;
    margin-bottom: 1.5rem;
    text-align: left;
  }
  .hero__corner--tr {
    text-align: left;
  }

  /*
   * Demoted to supporting text. At `text-lg` this block competed with the
   * name for the eye on a 375px screen, which is the wrong way round.
   */
  .hero__corner--tr p {
    font-size: 0.9375rem;
    line-height: 1.45;
  }
  .hero__corner--tr .mt-6 {
    margin-top: 1rem;
  }

  /* Shrink the Spotify card so it doesn't dominate the screen */
  .hero__corner--tr .mt-8 {
    max-width: 220px;
    margin-top: 1.25rem;
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