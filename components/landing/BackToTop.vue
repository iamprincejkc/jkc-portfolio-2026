<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * A round button in the corner once the visitor is well down the page, back
 * to the top in one tap. Smooth unless they asked for reduced motion.
 */
const shown = ref(false)
let raf = 0

function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    shown.value = window.scrollY > window.innerHeight * 1.2
  })
}

function toTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  // Move focus with the view, so keyboard users are not left at the bottom.
  document.querySelector<HTMLElement>('.lp-brand')?.focus({ preventScroll: true })
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <button
    type="button"
    class="lp-top"
    :class="{ 'is-shown': shown }"
    :tabindex="shown ? 0 : -1"
    :aria-hidden="!shown"
    aria-label="Back to top"
    title="Back to top"
    @click="toTop"
  >
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  </button>
</template>

<style scoped>
.lp-top {
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 45;
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--lp-btn-bg);
  color: var(--lp-btn-fg);
  box-shadow: var(--lp-shadow);
  opacity: 0;
  visibility: hidden;
  transform: translateY(12px);
  transition:
    opacity 0.25s ease,
    transform 0.25s ease,
    visibility 0s linear 0.25s,
    background-color 0.2s ease;
}
.lp-top.is-shown {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition:
    opacity 0.25s ease,
    transform 0.25s ease,
    visibility 0s,
    background-color 0.2s ease;
}
.lp-top:hover {
  background: var(--lp-btn-hover);
}
@media (min-width: 768px) {
  .lp-top {
    right: 28px;
    bottom: 28px;
  }
}
</style>
