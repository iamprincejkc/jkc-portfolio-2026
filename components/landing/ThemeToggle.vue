<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { THEME_COLORS, effectiveTheme, readStoredTheme, storeTheme, type Theme } from '~/utils/landing/theme'

/**
 * One button: shows the theme you would switch to, and switches to it.
 *
 * Until it is pressed the page follows the phone; after, the pick is stored
 * (utils/landing/theme.ts) and the inline boot script applies it on the next
 * visit before first paint. The button renders on the server in a neutral
 * state and settles on mount, so it never disagrees with the page.
 */
const current = ref<Theme | null>(null)

function paintBrowserChrome(theme: Theme) {
  // Both theme-color tags, so the address bar matches whatever is showing.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLORS[theme]
  }
}

onMounted(() => {
  const stored = readStoredTheme()
  current.value = effectiveTheme(stored, window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (stored) paintBrowserChrome(stored)
})

function toggle() {
  const next: Theme = current.value === 'dark' ? 'light' : 'dark'
  current.value = next
  document.documentElement.setAttribute('data-theme', next)
  storeTheme(next)
  paintBrowserChrome(next)
}
</script>

<template>
  <button
    type="button"
    class="lp-theme"
    :aria-label="current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="current === 'dark' ? 'Light mode' : 'Dark mode'"
    @click="toggle"
  >
    <!--
      Sun while dark is showing (press for light), moon otherwise. Both are
      rendered and CSS picks one from the same signals the theme uses, so the
      icon is right from the first paint, before any script runs.
    -->
    <svg class="lp-theme__sun" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </g>
    </svg>
    <svg class="lp-theme__moon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      />
    </svg>
  </button>
</template>

<style scoped>
.lp-theme {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--lp-muted);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}
.lp-theme:hover {
  color: var(--lp-ink);
  background: var(--lp-surface-2);
}
</style>

<!--
  Unscoped on purpose. These rules depend on an attribute of <html>, and in a
  scoped block Vue compiles `:global(html...) .lp-theme__moon` to the bare
  `html...` selector, dropping `.lp-theme__moon`: the "hide the moon" rule
  became `html { display: none }` and blanked the page in dark mode.
-->
<style>
.lp-theme__sun {
  display: none;
}
html.lp-root[data-theme='dark'] .lp-theme__sun {
  display: block;
}
html.lp-root[data-theme='dark'] .lp-theme__moon {
  display: none;
}
@media (prefers-color-scheme: dark) {
  html.lp-root:not([data-theme='light']) .lp-theme__sun {
    display: block;
  }
  html.lp-root:not([data-theme='light']) .lp-theme__moon {
    display: none;
  }
}
</style>
