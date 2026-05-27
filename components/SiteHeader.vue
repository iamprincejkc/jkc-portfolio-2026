<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

const isHidden = ref(false)
const isOpen = ref(false)
let lastScroll = 0
let raf = 0

function onScroll() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    if (isOpen.value) return
    const y = window.scrollY
    if (y > lastScroll && y > 200) isHidden.value = true
    else isHidden.value = false
    lastScroll = y
  })
}

// Lock body scroll when menu open
watch(isOpen, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})

function close() {
  isOpen.value = false
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <header
    class="site-header"
    :class="{ 'is-hidden': isHidden, 'is-open': isOpen }"
  >
    <!-- Brand -->
    <div class="site-header__brand">
      <NuxtLink to="/" @click="close" class="font-medium tracking-tight">JKC</NuxtLink>
      <span class="text-text-muted text-xs hidden md:inline ml-3">© 2026</span>
    </div>

    <!-- Desktop inline nav -->
    <nav class="site-header__nav-desktop">
      <a href="#work">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>

    <!-- Desktop socials -->
    <div class="site-header__social-desktop">
      <a href="https://ph.linkedin.com/in/iamprincejkc" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://github.com/iamprincejkc" target="_blank" rel="noopener">GitHub</a>
      <a href="https://dev.to/iamprincejkc" target="_blank" rel="noopener">Dev.to</a>
    </div>

    <!-- Mobile hamburger button -->
    <button
      class="site-header__menu-btn"
      :class="{ 'is-active': isOpen }"
      :aria-expanded="isOpen"
      aria-label="Toggle menu"
      @click="isOpen = !isOpen"
    >
      <span></span>
      <span></span>
    </button>
  </header>

  <!-- Mobile fullscreen overlay menu -->
  <Transition name="menu">
    <div v-if="isOpen" class="menu-overlay">
      <div class="menu-overlay__inner">
        <p class="eyebrow">Navigation</p>
        <hr class="border-border-muted my-6" />

        <nav class="menu-overlay__nav">
          <a href="#" @click="close">Home</a>
          <a href="#work" @click="close">Work</a>
          <a href="#about" @click="close">About</a>
          <a href="#contact" @click="close">Contact</a>
        </nav>

        <div class="menu-overlay__footer">
          <p class="eyebrow">Socials</p>
          <div class="menu-overlay__socials">
            <a href="https://ph.linkedin.com/in/iamprincejkc" target="_blank" rel="noopener">LinkedIn</a>
            <a href="https://github.com/iamprincejkc" target="_blank" rel="noopener">GitHub</a>
            <a href="https://dev.to/iamprincejkc" target="_blank" rel="noopener">Dev.to</a>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.site-header {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 50;
  padding: 1.25rem 1.5rem;
  display: grid;
  /* Mobile: brand | flex space | button */
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1rem;
  mix-blend-mode: difference;
  color: #fff;
  transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.site-header.is-hidden {
  transform: translateY(-100%);
}
.site-header.is-open {
  mix-blend-mode: normal;
  color: #fafafa;
}

.site-header__brand {
  display: flex;
  align-items: center;
}

.site-header__nav-desktop,
.site-header__social-desktop {
  display: none;
  gap: 1.5rem;
  font-size: 14px;
  align-items: center;
}
.site-header__nav-desktop { justify-content: center; }
.site-header__social-desktop { justify-content: flex-end; }

@media (min-width: 768px) {
  /* Desktop: brand | nav | socials | menu-btn */
  .site-header {
    grid-template-columns: auto 1fr auto auto;
    gap: 2rem;
  }
  .site-header__nav-desktop,
  .site-header__social-desktop {
    display: flex;
  }
}

.site-header a {
  position: relative;
  padding: 0.25rem 0;
}
.site-header a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 1px;
  width: 100%;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.site-header a:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

/* --- Hamburger button (visible at ALL screen sizes now) --- */
.site-header__menu-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 9999px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  gap: 5px;
  cursor: pointer;
  justify-self: end;
  transition: background 0.3s, transform 0.3s;
}
.site-header__menu-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}
.site-header__menu-btn span {
  display: block;
  width: 18px;
  height: 1.5px;
  background: currentColor;
  transform-origin: center;
  transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
}
/* When active, both spans collapse to the dead-center of the button */
.site-header__menu-btn.is-active span:nth-child(1) {
  transform: translateY(3.25px) rotate(45deg);
}
.site-header__menu-btn.is-active span:nth-child(2) {
  transform: translateY(-3.25px) rotate(-45deg);
}

/* --- Fullscreen overlay menu --- */
.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 49;
  background: #0a0a0a;
  color: #fafafa;
  display: flex;
  align-items: center;
  padding: 1.5rem;
}
.menu-overlay__inner {
  width: 100%;
  max-width: 480px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
}
.menu-overlay__nav {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: clamp(36px, 8vw, 56px);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.menu-overlay__nav a {
  display: inline-block;
  position: relative;
  width: max-content;
  padding: 0.25rem 0;
}
.menu-overlay__nav a::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 1px;
  width: 100%;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.menu-overlay__nav a:hover::after {
  transform: scaleX(1);
}

.menu-overlay__footer {
  margin-top: 3rem;
}
.menu-overlay__socials {
  display: flex;
  gap: 1.25rem;
  margin-top: 0.75rem;
  font-size: 16px;
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.4s cubic-bezier(0.19, 1, 0.22, 1),
              transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-2%);
}
</style>
