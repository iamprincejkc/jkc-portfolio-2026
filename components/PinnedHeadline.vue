<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

interface Props {
  text: string
  eyebrow?: string
  /** Where the section reads on to, if it does. Renders the link when set. */
  to?: string
  /** Label for that link. */
  cta?: string
}
const props = withDefaults(defineProps<Props>(), { eyebrow: '', to: '', cta: 'Read more' })

const sectionRef = ref<HTMLElement | null>(null)
const wordsRef = ref<HTMLElement[]>([])
let st: any = null

// Split on whitespace, preserving order.
const words = computed(() => props.text.split(/\s+/))

onMounted(() => {
  const { $gsap, $ScrollTrigger } = useNuxtApp() as any
  if (!$gsap || !$ScrollTrigger || !sectionRef.value) return

  $gsap.set(wordsRef.value, { opacity: 0.12 })

  st = $gsap.to(wordsRef.value, {
    opacity: 1,
    ease: 'none',
    stagger: 0.05,
    scrollTrigger: {
      trigger: sectionRef.value,
      start: 'top 75%',
      end: 'bottom 40%',
      scrub: 1,
    },
  })
})

onBeforeUnmount(() => {
  if (st?.scrollTrigger) st.scrollTrigger.kill()
})
</script>

<template>
  <!--
    Shorter than it was. This section used to run py-32/py-48 - most of a
    screen of air around three lines of text - which on a page being trimmed
    is the cheapest height to give back without losing anything.
  -->
  <section ref="sectionRef" id="about" class="py-20 md:py-28">
    <div class="container-edge max-w-5xl">
      <p v-if="eyebrow" class="eyebrow mb-8">{{ eyebrow }}</p>
      <!--
        Each word is its own element so GSAP can stagger their opacity. The
        separator is a real space rather than a margin: with margin alone the
        rendered text looks spaced but `textContent` reads
        "Idesignandbuild...", which is what a screen reader announces and what
        lands on the clipboard when someone copies the paragraph.
      -->
      <h2 class="font-display headline-lg leading-[1.1]">
        <template v-for="(w, i) in words" :key="i">
          <span
            :ref="(el) => { if (el) wordsRef[i] = el as HTMLElement }"
            class="reveal-word"
          >{{ w }}</span>{{ ' ' }}
        </template>
      </h2>

      <NuxtLink v-if="props.to" :to="props.to" class="pinned-cta">
        {{ props.cta }}
        <span aria-hidden="true">&rarr;</span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.pinned-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 2.5rem;
  font-size: 14px;
  color: var(--color-muted);
  transition:
    color 240ms var(--ease-out-expo),
    gap 240ms var(--ease-out-expo);
}

.pinned-cta:hover {
  color: var(--color-accent);
  gap: 0.85rem;
}
</style>
