<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

interface Project {
  slug: string
  name: string
  category: string
  year: string
  image: string
  url: string
  role: string
}

// JKC's real projects. `role` is honest about whether built/maintained/managed.
const projects: Project[] = [
  {
    slug: 'ibc-auto',
    name: 'IBC Auto',
    category: 'Web Platform · Auto Marketplace',
    year: '2024',
    image: '/images/project-ibc.webp',
    url: 'https://ibcauto.com/search',
    role: 'Built · Maintained',
  },
  {
    slug: 'gis',
    name: 'Global Inspection Specialists',
    category: 'Web Platform · Compliance',
    year: '2024',
    image: '/images/project-gis.webp',
    url: 'https://globalinspectionspecialist.com/',
    role: 'Built · Maintained',
  },
  {
    slug: 'jet-logistics',
    name: 'Jet Logistics',
    category: 'Corporate Site · Logistics',
    year: '2024',
    image: '/images/project-jet.webp',
    url: 'https://www.jetlogistics.co.jp/',
    role: 'Maintained',
  },
  {
    slug: 'jet-d2d',
    name: 'Jet D2D Services',
    category: 'Plugin Platform · Demo',
    year: '2024',
    image: '/images/project-jet.webp',
    url: 'https://logged.jetlogistics.co.jp/en/services',
    role: 'Built',
  },
  {
    slug: 'hope-lifemark',
    name: 'HOPE LifeMark-HX',
    category: 'Enterprise EMR · Healthcare',
    year: '2023',
    image: '/images/project-hope.webp',
    url: '#',
    role: 'Contributed · Supported',
  },
  {
    slug: 'rd-pawnshop',
    name: 'RD Pawnshop System',
    category: 'Internal Tools · .NET MVC',
    year: '2022',
    image: '/images/project-rdgcash.webp',
    url: '#',
    role: 'Built · Maintained',
  },
]

/**
 * Some work has no public URL - internal tooling, or a client product behind a
 * login. Those entries render as plain elements rather than links: an anchor
 * with href="#" and target="_blank" promises a destination, opens a blank tab,
 * and delivers nothing.
 */
function isLinked(project: Project): boolean {
  return Boolean(project.url) && project.url !== '#'
}

const sectionRef = ref<HTMLElement | null>(null)
const pinRef = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])
const activeIndex = ref(0)
const isDesktop = ref(true) // gated on mount
let st: any = null

onMounted(() => {
  // Mobile fallback: skip the pinned scroll-scale effect, render simple cards.
  // 1024px matches Tailwind's `lg:` breakpoint.
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
  if (!isDesktop.value) return

  const { $gsap, $ScrollTrigger } = useNuxtApp() as any
  if (!$gsap || !$ScrollTrigger || !sectionRef.value || !pinRef.value) return

  $gsap.set(itemRefs.value, { opacity: 0, scale: 0.55, transformOrigin: 'center' })
  $gsap.set(itemRefs.value[0], { opacity: 1, scale: 1 })

  const tl = $gsap.timeline({
    scrollTrigger: {
      trigger: sectionRef.value,
      start: 'top top',
      end: () => `+=${projects.length * window.innerHeight}`,
      pin: pinRef.value,
      pinSpacing: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self: any) => {
        const idx = Math.min(
          projects.length - 1,
          Math.floor(self.progress * projects.length)
        )
        if (idx !== activeIndex.value) activeIndex.value = idx
      },
    },
  })

  projects.forEach((_, i) => {
    if (i === projects.length - 1) return
    const current = itemRefs.value[i]
    const next = itemRefs.value[i + 1]
    tl.to(current, { opacity: 0, scale: 1.25, ease: 'none' }, i)
      .fromTo(
        next,
        { opacity: 0, scale: 0.55 },
        { opacity: 1, scale: 1, ease: 'none' },
        i
      )
  })

  st = tl.scrollTrigger
  window.addEventListener('load', () => $ScrollTrigger.refresh())
})

onBeforeUnmount(() => {
  if (st) st.kill()
})
</script>

<template>
  <section ref="sectionRef" id="work" class="relative bg-bg">
    <!-- ============================================================
         DESKTOP: pinned + scroll-scale effect
         ============================================================ -->
    <div
      v-if="isDesktop"
      ref="pinRef"
      class="relative h-screen overflow-hidden"
    >
      <div class="container-edge pt-28 pb-8 flex items-end justify-between">
        <div>
          <p class="eyebrow mb-3">Selected work ({{ projects.length }})</p>
          <h2 class="font-display headline-lg">Things I&apos;ve worked on</h2>
        </div>
        <a
          href="#contact"
          class="hidden md:inline-flex items-center gap-2 text-sm border border-border-muted rounded-full px-5 py-2 hover:bg-primary hover:text-text-inverse transition-colors duration-normal"
        >
          Start a project <span aria-hidden>→</span>
        </a>
      </div>

      <div class="container-edge grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 mt-4">
        <!-- LEFT: scaling image preview -->
        <div class="lg:col-span-6 order-2 lg:order-1">
          <div class="relative aspect-[4/3] w-full max-w-[640px] mx-auto">
            <div
              v-for="(p, i) in projects"
              :key="p.slug"
              :ref="(el) => { if (el) itemRefs[i] = el as HTMLElement }"
              class="absolute inset-0 will-change-transform"
            >
              <NuxtImg
                :src="p.image"
                :alt="p.name"
                class="w-full h-full object-cover rounded-xs"
                loading="eager"
              />
              <div
                class="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white drop-shadow-lg"
              >
                <span class="font-display text-2xl italic">{{ p.name }}</span>
                <span class="text-xs tracking-widest uppercase">{{ p.year }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: project list -->
        <div class="lg:col-span-6 order-1 lg:order-2 flex items-center">
          <ul class="w-full">
            <li v-for="(p, i) in projects" :key="p.slug">
              <component
                :is="isLinked(p) ? 'a' : 'div'"
                v-bind="
                  isLinked(p)
                    ? { href: p.url, target: '_blank', rel: 'noopener noreferrer' }
                    : {}
                "
                class="project-row block transition-all"
                :class="{
                  'text-accent': activeIndex === i,
                  'text-text-muted opacity-50': activeIndex !== i,
                  'cursor-default': !isLinked(p),
                }"
              >
                <span class="font-display text-xl md:text-2xl">
                  {{ p.name }}
                  <span v-if="isLinked(p)" class="project-row__arrow">↗</span>
                  <span v-else class="ml-2 align-middle text-xs tracking-widest uppercase opacity-60">
                    Internal
                  </span>
                </span>
                <span class="hidden md:inline text-sm self-center">{{ p.category }}</span>
                <span class="text-sm self-center tabular-nums">{{ p.role }} · {{ p.year }}</span>
              </component>
            </li>
          </ul>
        </div>
      </div>

      <!-- Progress indicator -->
      <div class="container-edge absolute bottom-6 left-0 right-0">
        <div class="flex items-center gap-3 text-xs text-text-muted">
          <span class="tabular-nums">{{ String(activeIndex + 1).padStart(2, '0') }}</span>
          <div class="flex-1 h-px bg-border-muted relative overflow-hidden">
            <div
              class="absolute inset-y-0 left-0 bg-accent transition-all duration-300"
              :style="{ width: `${((activeIndex + 1) / projects.length) * 100}%` }"
            ></div>
          </div>
          <span class="tabular-nums">{{ String(projects.length).padStart(2, '0') }}</span>
        </div>
      </div>
    </div>

    <!-- ============================================================
         MOBILE: simple stacked layout, no pinning, no scrub
         ============================================================ -->
    <div v-else class="container-edge py-20">
      <div class="mb-10">
        <p class="eyebrow mb-3">Selected work ({{ projects.length }})</p>
        <h2 class="font-display text-4xl leading-tight">Things I&apos;ve worked on</h2>
      </div>

      <ul class="space-y-12">
        <li v-for="p in projects" :key="p.slug">
          <component
            :is="isLinked(p) ? 'a' : 'div'"
            v-bind="
              isLinked(p) ? { href: p.url, target: '_blank', rel: 'noopener noreferrer' } : {}
            "
            class="block group"
          >
            <div class="overflow-hidden rounded-xs mb-4">
              <NuxtImg
                :src="p.image"
                :alt="p.name"
                class="w-full h-auto group-hover:scale-[1.02] transition-transform duration-slow"
                loading="lazy"
                sizes="100vw sm:640px"
              />
            </div>
            <div class="flex items-end justify-between gap-4">
              <div>
                <h3 class="font-display text-2xl italic">
                  {{ p.name }}
                  <span v-if="isLinked(p)" class="text-accent">↗</span>
                </h3>
                <p class="text-sm text-text-muted mt-1">
                  {{ p.category }}<template v-if="!isLinked(p)"> · Internal</template>
                </p>
              </div>
              <p class="text-xs text-text-muted tabular-nums whitespace-nowrap">
                {{ p.role }}<br />{{ p.year }}
              </p>
            </div>
          </component>
        </li>
      </ul>
    </div>
  </section>
</template>
