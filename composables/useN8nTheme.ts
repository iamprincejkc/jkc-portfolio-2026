/**
 * Light or dark, for the workflow library.
 *
 * The theme lives in one place - a `data-n8-theme` attribute on the html
 * element - and it is always an explicit `light` or `dark`, never absent and
 * never "system". Resolving the system preference into a real value at the
 * first opportunity means the stylesheet needs one dark block instead of two
 * (one for the media query, one for the override), and it lets the same
 * attribute drive `color-scheme`, which is what stops the browser drawing a
 * dark scrollbar down the side of a light page.
 *
 * It is set on the html element rather than the page's own root because that
 * is where `color-scheme` has to be to reach the document's scrollbar - and
 * because the tool layout's floating back button is a sibling of the page,
 * not a child of it.
 *
 * Nothing here runs during setup. This route is prerendered, so any theme
 * read at setup time would be baked into the HTML on disk and would then be
 * wrong for half the people who load it. `applyTheme` runs from the inline
 * script in the page head before first paint, and this composable only ever
 * reads back what that already decided.
 */
const ATTRIBUTE = 'data-n8-theme'
const STORAGE_KEY = 'n8n-theme'

export type N8nTheme = 'light' | 'dark'

/**
 * The script that runs before the page paints.
 *
 * Inlined into the head rather than done in `onMounted`, because a theme
 * applied after hydration is a white flash on every load for anyone who
 * chose dark. Deliberately tiny and deliberately defensive: a browser with
 * storage blocked throws on `localStorage`, and the page still has to render.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute(${JSON.stringify(
  ATTRIBUTE,
)},t)}catch(e){document.documentElement.setAttribute(${JSON.stringify(ATTRIBUTE)},"light")}})()`

function read(): N8nTheme {
  const current = document.documentElement.getAttribute(ATTRIBUTE)
  return current === 'dark' ? 'dark' : 'light'
}

function apply(theme: N8nTheme) {
  document.documentElement.setAttribute(ATTRIBUTE, theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked. The theme still applies for this page view, which is
    // the part that matters; only remembering it is lost.
  }
}

/**
 * The toggle's behaviour, and the cleanup that keeps the theme scoped to this
 * page.
 *
 * The attribute is on the html element, which outlives the route: leaving it
 * behind would put `color-scheme: light` on the portfolio's own near-black
 * pages after a client-side navigation away, and their scrollbars would go
 * pale. So it is removed when the page unmounts, and the inline script puts
 * it back on the way in.
 */
export function useN8nTheme() {
  const theme = ref<N8nTheme>('light')

  onMounted(() => {
    // Read, never write: the inline script has already decided, and writing
    // here would overrule a preference it just resolved correctly.
    theme.value = read()
  })

  onBeforeUnmount(() => document.documentElement.removeAttribute(ATTRIBUTE))

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply(theme.value)
  }

  return { theme, toggle }
}
