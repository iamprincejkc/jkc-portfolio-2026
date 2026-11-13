<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { trackLanding } from '~/composables/useLandingAnalytics'

/** A hairline and a little more opacity once the page has moved. */
const scrolled = ref(false)
const onScroll = () => {
  scrolled.value = window.scrollY > 8
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const links = [
  { href: '#services', label: 'Services' },
  { href: '#work', label: 'Work' },
  { href: '#how', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
]
</script>

<template>
  <header class="lp-header" :class="{ 'is-scrolled': scrolled }">
    <div class="lp-wrap lp-header__row">
      <a href="#top" class="lp-brand">
        <!-- The "J." favicon mark, drawn from the same geometry as public/icon.svg. -->
        <svg class="lp-brand__mark" viewBox="0 0 76 76" width="36" height="36" aria-hidden="true">
          <rect width="76" height="76" rx="12" fill="#333" />
          <path fill="#fff" d="M34 19h9v33a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V38h9v11h16Z" />
          <rect x="57" y="45" width="11" height="11" fill="#fff" />
        </svg>
        <span class="lp-brand__name">Jan Kevin Cadampog</span>
      </a>

      <nav class="lp-header__nav" aria-label="Sections">
        <a v-for="l in links" :key="l.href" :href="l.href">{{ l.label }}</a>
        <a href="/me/">About me</a>
      </nav>

      <div class="lp-header__actions">
        <LandingThemeToggle />
        <a href="#contact" class="lp-btn lp-btn--primary lp-btn--sm" @click="trackLanding({ event: 'cta_click', cta: 'header_get_in_touch' })">
          Get in touch
        </a>
      </div>
    </div>
  </header>
</template>

<style scoped>
.lp-header {
  position: sticky;
  top: 0;
  z-index: 40;
  height: var(--lp-header-h);
  background: color-mix(in srgb, var(--lp-bg) 82%, transparent);
  -webkit-backdrop-filter: saturate(1.4) blur(14px);
  backdrop-filter: saturate(1.4) blur(14px);
  border-bottom: 1px solid transparent;
  transition:
    border-color 0.25s ease,
    background-color 0.25s ease;
}
.lp-header.is-scrolled {
  border-bottom-color: var(--lp-line);
  background: color-mix(in srgb, var(--lp-bg) 92%, transparent);
}

.lp-header__row {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 24px;
}

.lp-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin-right: auto;
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.lp-brand__mark {
  flex: none;
  display: block;
}

.lp-header__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Too narrow for the name next to the switch and the button: keep it for
   screen readers, which use it as the link's name. */
@media (max-width: 519px) {
  .lp-brand__name {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

.lp-header__nav {
  display: none;
  align-items: center;
  gap: 28px;
  font-size: 15px;
  font-weight: 500;
  color: var(--lp-muted);
}
.lp-header__nav a {
  transition: color 0.2s ease;
}
.lp-header__nav a:hover {
  color: var(--lp-ink);
}
@media (min-width: 900px) {
  .lp-header__nav {
    display: flex;
  }
}
</style>

<!--
  Unscoped on purpose: it keys off an attribute of <html>. In a scoped block
  Vue compiles `:global(html...) .lp-brand__mark` to the bare `html...`
  selector and would outline the whole page instead of the logo.
-->
<style>
/* On a dark page the #333 tile needs a hairline to hold its edge. */
html.lp-root[data-theme='dark'] .lp-brand__mark {
  outline: 1px solid var(--lp-line-strong);
  outline-offset: -1px;
  border-radius: 6px;
}
@media (prefers-color-scheme: dark) {
  html.lp-root:not([data-theme='light']) .lp-brand__mark {
    outline: 1px solid var(--lp-line-strong);
    outline-offset: -1px;
    border-radius: 6px;
  }
}
</style>
