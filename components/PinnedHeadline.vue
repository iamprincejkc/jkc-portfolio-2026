<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

interface Props {
  text: string
  eyebrow?: string
}
const props = withDefaults(defineProps<Props>(), { eyebrow: '' })

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
  <section ref="sectionRef" id="about" class="py-32 md:py-48">
    <div class="container-edge max-w-5xl">
      <p v-if="eyebrow" class="eyebrow mb-8">{{ eyebrow }}</p>
      <h2 class="font-display headline-lg leading-[1.1]">
        <span
          v-for="(w, i) in words"
          :key="i"
          :ref="(el) => { if (el) wordsRef[i] = el as HTMLElement }"
          class="reveal-word mr-[0.25em]"
        >
          {{ w }}
        </span>
      </h2>
    </div>
  </section>
</template>
