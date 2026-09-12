<script setup lang="ts">
/**
 * Chrome for the standalone tools.
 *
 * Not a bar. A pane of glass floating over the page, inset from every edge,
 * the same way the rest of this tool's chrome behaves - a header welded to the
 * top of the viewport would be the one element that does not float.
 *
 * The default layout's header could not be reused: it is a set of anchors into
 * the homepage, which point at nothing from anywhere else, and its
 * `mix-blend-mode: difference` inverts against whatever sits behind it, which
 * over a coloured field means it inverts against something different every few
 * seconds.
 */
const route = useRoute()

// The page names itself through `definePageMeta`; a layout cannot take props
// when it is selected by meta rather than mounted by hand.
const title = computed(() => String(route.meta.toolTitle ?? 'Tools'))

/**
 * Tools do not all sit on the same colour.
 *
 * The default chrome is white glass, which needs a dark page behind it; the
 * n8n library is a light one and would render the back button as white on
 * near-white. Rather than teach this layout about every tool, it stamps the
 * page's chosen theme onto the wrapper and lets that tool's own stylesheet
 * replace the material.
 */
const theme = computed(() => (route.meta.toolTheme ? `tool-chrome--${route.meta.toolTheme}` : ''))
</script>

<template>
  <div :class="theme">
    <a href="#tool-main" class="tool-skip">Skip to content</a>

    <header class="tool-header">
      <NuxtLink to="/" class="tool-header__back" title="Back to the portfolio">
        <span class="tool-header__brand">JKC</span>
        <span class="tool-header__sep" aria-hidden="true">/</span>
        <span class="tool-header__title">{{ title }}</span>
      </NuxtLink>
    </header>

    <main id="tool-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/*
 * Everything a tool theme is allowed to replace is wrapped in `:where()`.
 *
 * These are defaults, and they have to behave like defaults. Scoped styles
 * are injected into the document after the stylesheets in `nuxt.config`, so
 * a rule here and a rule in a tool's own CSS file at equal specificity is a
 * tie that this file wins on source order alone - which is how `/n8n` ended
 * up drawing a white back button on a white page while its stylesheet
 * carried a perfectly correct override that never applied.
 *
 * `:where()` contributes nothing to specificity, so what survives is only
 * the `[data-v-…]` attribute Vue appends: one class-worth. Any tool rule of
 * the form `.tool-chrome--x .tool-header__back` is worth two and wins,
 * without anyone having to know about the load order. The structural rules
 * below - the ones no theme should be touching - are left alone on purpose.
 */
.tool-header {
  position: fixed;
  z-index: 50;
  display: flex;
  align-items: center;
}

:where(.tool-header) {
  top: 0.875rem;
  left: 1.25rem;
}

@media (min-width: 1120px) {
  :where(.tool-header) { top: 1.25rem; left: 1.75rem; }
}

:where(.tool-header__back) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-block-size: 40px;
  padding-inline: 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.06));
  backdrop-filter: blur(26px) saturate(190%) brightness(1.08);
  -webkit-backdrop-filter: blur(26px) saturate(190%) brightness(1.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.26),
    0 12px 32px -12px rgba(0, 0, 0, 0.65);
  font-size: 14px;
  letter-spacing: -0.01em;
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

:where(.tool-header__back:hover) { transform: translateY(-1px); }
:where(.tool-header__back:active) { transform: scale(0.97); }

:where(.tool-header__brand) { font-weight: 600; color: #fff; }
:where(.tool-header__sep) { color: rgba(255, 255, 255, 0.35); }
:where(.tool-header__title) { color: rgba(255, 255, 255, 0.62); }
:where(.tool-header__back:hover .tool-header__title) { color: #fff; }
.tool-header__title { transition: color 240ms cubic-bezier(0.32, 0.72, 0, 1); }

.tool-skip {
  position: absolute;
  left: -9999px;
}

/*
 * Split in two on purpose. Bringing the skip link back on screen is
 * structural - it must outrank `.tool-skip`'s own `left: -9999px`, so it
 * cannot go inside `:where()` or the link would stay parked off-screen and
 * the page would lose its only keyboard shortcut past the hero. Only the
 * colours are a theme's business.
 */
.tool-skip:focus {
  left: 1rem;
  top: 1rem;
  z-index: 60;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

/*
 * `:where(.tool-skip):focus`, not `:where(.tool-skip:focus)`, and the
 * difference is not cosmetic.
 *
 * Vue appends its scope attribute to the *last compound selector*, so
 * `:where(.tool-skip:focus)` compiles to `:where(.tool-skip[data-v-…]:focus)`
 * with the attribute swallowed inside `:where()` - total specificity zero.
 * That is fine for properties nothing else sets, but `color` on an anchor is
 * already claimed by Tailwind's preflight `a { color: inherit }` at (0,0,1),
 * which beat it and painted the skip link #fafafa on #fafafa.
 *
 * Moving `:focus` outside gives `:where(.tool-skip):focus[data-v-…]` - two
 * classes' worth, which clears preflight and still loses to a theme's
 * `.tool-chrome--x .tool-skip:focus` at three.
 */
:where(.tool-skip):focus {
  background: #fafafa;
  color: #0a0a0a;
}
</style>
