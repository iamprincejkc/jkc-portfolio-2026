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
const previewRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const hovering = ref(false)
const isDesktop = ref(false) // gated on mount
const reducedMotion = ref(false)

/*
 * The list used to be pinned with a ScrollTrigger running for
 * `projects.length * window.innerHeight` - six full viewport heights of
 * scrolling locked on one section before the page would move on. It looked
 * impressive once and was tedious every time after.
 *
 * It is now a plain index: every project readable at once, no scroll cost, and
 * a preview image that tracks the cursor so the work is still visible without
 * clicking through. A carousel was the other option but it hides five of six
 * projects behind interaction, which is worse for a portfolio.
 */
let moveX: ((v: number) => void) | null = null
let moveY: ((v: number) => void) | null = null
let rafId = 0

function onMove(event: MouseEvent) {
  if (!previewRef.value) return

  // The preview trails the cursor slightly, which reads as physical rather
  // than glued on. quickTo is GSAP's allocation-free setter for this.
  if (moveX && moveY) {
    moveX(event.clientX)
    moveY(event.clientY)
    return
  }

  // No GSAP: position directly, throttled to one write per frame.
  if (rafId) return
  const { clientX, clientY } = event
  rafId = requestAnimationFrame(() => {
    rafId = 0
    if (previewRef.value) {
      previewRef.value.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`
    }
  })
}

function enter(index: number) {
  activeIndex.value = index
  hovering.value = true
}

function leave() {
  hovering.value = false
}

onMounted(() => {
  /*
   * Both layouts are server-rendered and swapped by CSS (`hidden lg:block` /
   * `lg:hidden`), so neither flashes on hydration and the list still works
   * without JavaScript. This flag only decides whether to spend anything
   * wiring up the cursor tracking.
   */
  isDesktop.value = window.matchMedia('(min-width: 1024px)').matches
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!isDesktop.value || !previewRef.value) return

  const { $gsap } = useNuxtApp() as any
  if (!$gsap || reducedMotion.value) return

  moveX = $gsap.quickTo(previewRef.value, 'x', { duration: 0.5, ease: 'expo.out' })
  moveY = $gsap.quickTo(previewRef.value, 'y', { duration: 0.5, ease: 'expo.out' })
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  moveX = null
  moveY = null
})
</script>

<template>
  <section ref="sectionRef" id="work" class="relative bg-bg">
    <!-- ============================================================
         DESKTOP: index list with a cursor-tracked preview.
         No pinning - the section is one screen and scrolls like everything else.
         ============================================================ -->
    <div class="hidden lg:block container-edge py-28">
      <div class="flex items-end justify-between">
        <div>
          <p class="eyebrow mb-3">Selected work ({{ projects.length }})</p>
          <h2 class="font-display headline-lg">Things I&apos;ve worked on</h2>
        </div>
        <a
          href="#contact"
          class="inline-flex items-center gap-2 text-sm border border-border-muted rounded-full px-5 py-2 hover:bg-primary hover:text-text-inverse transition-colors duration-normal"
        >
          Start a project <span aria-hidden>→</span>
        </a>
      </div>

      <ul
        class="mt-16 border-t border-border-muted"
        @mousemove="onMove"
        @mouseleave="leave"
      >
        <li v-for="(p, i) in projects" :key="p.slug">
          <component
            :is="isLinked(p) ? 'a' : 'div'"
            v-bind="
              isLinked(p)
                ? { href: p.url, target: '_blank', rel: 'noopener noreferrer' }
                : {}
            "
            class="work-row project-row"
            :class="{
              'is-dimmed': hovering && activeIndex !== i,
              'cursor-default': !isLinked(p),
            }"
            @mouseenter="enter(i)"
            @focus="enter(i)"
            @blur="leave"
          >
            <span class="work-row__index eyebrow">{{ String(i + 1).padStart(2, '0') }}</span>

            <span class="font-display text-3xl xl:text-4xl">
              {{ p.name }}
              <span v-if="isLinked(p)" class="project-row__arrow">↗</span>
              <span
                v-else
                class="ml-2 align-middle text-xs tracking-widest uppercase opacity-60"
              >
                Internal
              </span>
            </span>

            <span class="text-sm self-center text-text-muted">{{ p.category }}</span>
            <span class="text-sm self-center tabular-nums text-text-muted">
              {{ p.role }} · {{ p.year }}
            </span>
          </component>
        </li>
      </ul>

      <!--
        Every preview is mounted and swapped by opacity, so hovering never waits
        on a network request. Decorative: the list text already names each one.
      -->
      <div
        ref="previewRef"
        class="work-preview"
        :class="{ 'is-visible': hovering, 'is-static': reducedMotion }"
        aria-hidden="true"
      >
        <img
          v-for="(p, i) in projects"
          :key="p.slug"
          :src="p.image"
          alt=""
          loading="lazy"
          decoding="async"
          :class="{ 'is-active': activeIndex === i }"
        />
      </div>
    </div>

    <!-- ============================================================
         MOBILE: simple stacked layout, no pinning, no scrub
         ============================================================ -->
    <div class="lg:hidden container-edge py-20">
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

<style scoped>
/*
 * The shared .project-row is a 3-column grid; this row adds a leading index,
 * so the template is restated here rather than fighting it with overrides.
 */
/* Doubled selector: .project-row is global and equally specific, and source
   order between global CSS and scoped component CSS is not guaranteed. */
.work-row.project-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 2.5rem;
  align-items: baseline;
  padding: 1.75rem 0;
  transition:
    padding-left 0.5s var(--ease-out-expo),
    opacity 0.4s var(--ease-out-expo),
    color 0.3s var(--ease-out-expo);
}

/* The shared row assumes everything is a link. These two are not. */
.work-row.cursor-default {
  cursor: default;
}

.work-row__index {
  align-self: center;
  color: var(--color-muted);
  transition: color 0.3s var(--ease-out-expo);
}

.work-row:hover .work-row__index {
  color: var(--color-accent);
}

/*
 * Dim the rows that are not hovered rather than highlighting the one that is.
 * Focus lands on the row being read instead of asking the eye to find it.
 */
.work-row.is-dimmed {
  opacity: 0.35;
}

/* ---- Cursor-tracked preview ---- */
.work-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 20;
  width: clamp(260px, 22vw, 380px);
  aspect-ratio: 4 / 3;
  /* GSAP writes x/y; this keeps the image centred on the cursor. */
  margin: -0.5px 0 0 -0.5px;
  translate: -50% -50%;
  pointer-events: none;
  opacity: 0;
  scale: 0.92;
  transition:
    opacity 0.4s var(--ease-out-expo),
    scale 0.5s var(--ease-out-expo);
  will-change: transform;
}

.work-preview.is-visible {
  opacity: 1;
  scale: 1;
}

.work-preview img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.35s var(--ease-out-expo);
}

.work-preview img.is-active {
  opacity: 1;
}

/*
 * Reduced motion: the preview stops chasing the pointer and parks in the
 * lower-right corner, so the information is still there without the movement.
 */
.work-preview.is-static {
  top: auto;
  left: auto;
  right: 3rem;
  bottom: 3rem;
  translate: none;
  transition: opacity 0.2s linear;
  scale: 1;
}

@media (prefers-reduced-motion: reduce) {
  .work-row {
    transition: opacity 0.2s linear;
  }
  .work-row:hover {
    padding-left: 0;
  }
}
</style>
