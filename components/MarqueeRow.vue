<script setup lang="ts">
interface Props {
  text: string
  duration?: string
  reverse?: boolean
  /** Repeat text per track copy to keep the band dense. */
  repeats?: number
}
const props = withDefaults(defineProps<Props>(), {
  duration: '28s',
  reverse: false,
  repeats: 2,
})
</script>

<template>
  <div
    class="marquee"
    :style="{ '--duration': props.duration }"
    :class="{ 'marquee--reverse': reverse }"
  >
    <!-- Two identical tracks for seamless loop -->
    <div class="marquee__track">
      <span
        v-for="i in repeats"
        :key="`a-${i}`"
        class="font-display whitespace-nowrap text-[clamp(48px,9vw,140px)] leading-none"
      >
        {{ text }}
        <span class="inline-block mx-6 align-middle text-accent">✦</span>
      </span>
    </div>
    <div class="marquee__track" aria-hidden="true">
      <span
        v-for="i in repeats"
        :key="`b-${i}`"
        class="font-display whitespace-nowrap text-[clamp(48px,9vw,140px)] leading-none"
      >
        {{ text }}
        <span class="inline-block mx-6 align-middle text-accent">✦</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.marquee--reverse .marquee__track {
  animation-direction: reverse;
}
</style>
