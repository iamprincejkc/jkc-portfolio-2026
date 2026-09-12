/**
 * Light or dark, for a standalone tool page.
 *
 * The portfolio itself is one colour and has no theme. The tools are separate
 * surfaces with their own palettes, and each one that offers a choice needs
 * the same three awkward things to be right, which is why this is a factory
 * rather than two copies:
 *
 *   1. The theme lives on the html element, not on the page's own root. That
 *      is where `color-scheme` has to be to reach the document's scrollbar,
 *      and the tool layout's floating back button is a sibling of the page
 *      rather than a child of it.
 *
 *   2. It is always an explicit `light` or `dark`, never absent and never
 *      "system". Resolving the system preference into a real value at the
 *      first opportunity means the stylesheet needs one dark block instead of
 *      two - one for the media query and one for the override.
 *
 *   3. It is applied before the first paint, by an inline script in the page
 *      head. A theme applied after hydration is a white flash on every load
 *      for anyone who chose dark. Nothing here runs during setup: these
 *      routes are prerendered, so a theme read at setup time would be baked
 *      into the HTML on disk and would then be wrong for half the people who
 *      load it.
 *
 * Each tool passes its own attribute and storage key, so two tools can hold
 * different preferences and neither can read the other's.
 */
import type { Ref } from 'vue'

export type ToolTheme = 'light' | 'dark'

export interface ToolThemeApi {
  /**
   * The script to inline into the page head with `tagPosition: 'head'`.
   *
   * Deliberately tiny and deliberately defensive: a browser with storage
   * blocked throws on `localStorage`, and the page still has to render.
   */
  BOOT_SCRIPT: string
  /** Reads back what the boot script decided, and toggles it. */
  useTheme: () => { theme: Ref<ToolTheme>; toggle: () => void }
}

export function createToolTheme(attribute: string, storageKey: string): ToolThemeApi {
  const attr = JSON.stringify(attribute)
  const key = JSON.stringify(storageKey)

  const BOOT_SCRIPT =
    `(function(){try{var t=localStorage.getItem(${key});` +
    `if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}` +
    `document.documentElement.setAttribute(${attr},t)}` +
    `catch(e){document.documentElement.setAttribute(${attr},"light")}})()`

  function read(): ToolTheme {
    return document.documentElement.getAttribute(attribute) === 'dark' ? 'dark' : 'light'
  }

  function apply(theme: ToolTheme) {
    document.documentElement.setAttribute(attribute, theme)
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // Storage blocked. The theme still applies for this page view, which is
      // the part that matters; only remembering it is lost.
    }
  }

  function useTheme() {
    const theme = ref<ToolTheme>('light')

    onMounted(() => {
      // Read, never write: the inline script has already decided, and writing
      // here would overrule a preference it just resolved correctly.
      theme.value = read()
    })

    /*
     * The attribute is on the html element, which outlives the route.
     * Leaving it behind would put `color-scheme: light` on the portfolio's
     * own near-black pages after a client-side navigation away, and their
     * scrollbars would go pale.
     */
    onBeforeUnmount(() => document.documentElement.removeAttribute(attribute))

    function toggle() {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
      apply(theme.value)
    }

    return { theme, toggle }
  }

  return { BOOT_SCRIPT, useTheme }
}
