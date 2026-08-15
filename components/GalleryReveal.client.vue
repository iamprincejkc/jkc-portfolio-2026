<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Fallback for the scroll reveal.
 *
 * Where `animation-timeline: view()` is supported the reveal is pure CSS and
 * runs off the main thread. Firefox has no support yet, so this observer flips
 * `data-revealed` instead. Supporting browsers never construct an observer.
 */

let observer: IntersectionObserver | null = null
let mutations: MutationObserver | null = null

onMounted(() => {
  if (CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const el of document.querySelectorAll<HTMLElement>('.g-reveal')) {
      el.dataset.revealed = 'true'
    }
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        ;(entry.target as HTMLElement).dataset.revealed = 'true'
        observer?.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
  )

  const observeAll = () => {
    for (const el of document.querySelectorAll<HTMLElement>('.g-reveal:not([data-revealed])')) {
      observer?.observe(el)
    }
  }

  observeAll()

  // Tiles can arrive after filtering or client-side navigation.
  mutations = new MutationObserver(observeAll)
  mutations.observe(document.body, { childList: true, subtree: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  mutations?.disconnect()
})
</script>

<template><span class="hidden" aria-hidden="true" /></template>
