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
</script>

<template>
  <div>
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
.tool-header {
  position: fixed;
  top: 0.875rem;
  left: 1.25rem;
  z-index: 50;
  display: flex;
  align-items: center;
}

@media (min-width: 1120px) {
  .tool-header { top: 1.25rem; left: 1.75rem; }
}

.tool-header__back {
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

.tool-header__back:hover { transform: translateY(-1px); }
.tool-header__back:active { transform: scale(0.97); }

.tool-header__brand { font-weight: 600; color: #fff; }
.tool-header__sep { color: rgba(255, 255, 255, 0.35); }
.tool-header__title { color: rgba(255, 255, 255, 0.62); }
.tool-header__back:hover .tool-header__title { color: #fff; }
.tool-header__title { transition: color 240ms cubic-bezier(0.32, 0.72, 0, 1); }

.tool-skip {
  position: absolute;
  left: -9999px;
}

.tool-skip:focus {
  left: 1rem;
  top: 1rem;
  z-index: 60;
  background: #fafafa;
  color: #0a0a0a;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
</style>
