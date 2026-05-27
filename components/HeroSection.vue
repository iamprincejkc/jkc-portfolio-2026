<script setup lang="ts">
import { onMounted, ref } from 'vue'

const heroRef = ref<HTMLElement | null>(null)

onMounted(() => {
  const { $gsap } = useNuxtApp() as any
  if (!$gsap || !heroRef.value) return
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
</script>

<template>
  <section
    ref="heroRef"
    class="relative min-h-[100dvh] flex flex-col justify-between overflow-hidden pt-32 pb-12"
  >
    <!-- Top: name + meta -->
    <div class="container-edge grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      <div class="md:col-span-7 relative z-10" data-hero-reveal>
        <p class="eyebrow mb-4">Portfolio · 2026</p>
        <h1 class="font-display headline-xl">
          Jan&nbsp;Kevin<br />
          <span class="italic text-accent">Cadampog</span>
        </h1>
      </div>

      <div
        class="md:col-span-5 flex flex-col gap-3 md:items-end relative z-10"
        data-hero-reveal
      >
        <p class="text-text-muted text-sm">Located in</p>
        <p class="text-lg">Cebu City, Philippines</p>

        <p class="text-text-muted text-sm mt-6">Currently</p>
        <p class="text-lg">
          Software Engineer<br />
          <span class="text-text-muted">@ OSL International</span>
        </p>

        <!-- Spotify Now Playing -->
        <div class="mt-8 max-w-[260px] md:items-end flex flex-col md:text-right">
          <p class="text-text-muted text-sm mb-2">Currently listening</p>
          <a
            href="https://open.spotify.com/user/31jcy336e6umoa65pg75siec4cdq"
            target="_blank"
            rel="noopener"
            class="inline-block hover:opacity-80 transition-opacity duration-fast"
          >
            <img
              src="https://spotify-github-profile.kittinanx.com/api/view.svg?uid=31jcy336e6umoa65pg75siec4cdq&cover_image=true&theme=default&show_offline=true&background_color=1A1D23&interchange=true&bar_color=02f7db&bar_color_cover=true"
              alt="Now playing on Spotify"
              class="w-full h-auto rounded-xs"
              loading="lazy"
            />
          </a>
        </div>
      </div>
    </div>

    <!-- Middle: rotating titles -->
    <div class="container-edge mt-12 mb-8 relative z-10" data-hero-reveal>
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-2xl md:text-xl">
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

    <!-- Bottom: marquee -->
    <div class="relative z-10" data-hero-reveal>
      <MarqueeRow text="Building enterprise systems and digital products" />
    </div>

    <!-- Decorative portrait — masked at bottom so any hard photo edge fades to BG -->
    <div
      class="hero-portrait pointer-events-none select-none"
      data-hero-reveal
      aria-hidden="true"
    >
      <NuxtImg
        src="/images/main.webp"
        alt=""
        class="hero-portrait__img"
        loading="eager"
      />
    </div>
  </section>
</template>

<style scoped>
.hero-portrait {
  position: absolute;
  right: 0;
  bottom: 5rem;
  width: clamp(280px, 38vw, 460px);
  z-index: 0;
  /* Soft feather on every side so the photo dissolves into the page bg
     instead of showing a hard rectangular crop. */
  -webkit-mask-image: radial-gradient(
    ellipse 75% 80% at 50% 45%,
    black 55%,
    transparent 92%
  );
  mask-image: radial-gradient(
    ellipse 75% 80% at 50% 45%,
    black 55%,
    transparent 92%
  );
}
.hero-portrait__img {
  display: block;
  width: 100%;
  height: auto;
  opacity: 0.95;
}

/* On mobile the portrait fights with the Spotify card and meta column,
   so hide it entirely — the page is text-driven on small screens anyway. */
@media (max-width: 767px) {
  .hero-portrait {
    display: none;
  }
}
</style>
