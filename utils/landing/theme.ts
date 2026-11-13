/**
 * Light and dark for the landing page. The colours themselves are CSS tokens
 * in layouts/landing.vue; this file only knows the visitor's pick.
 */
export type Theme = 'light' | 'dark'

/** localStorage key. Absent means "follow the phone". */
export const THEME_KEY = 'jkc-theme'

/** The browser-chrome colour for each theme; matches --lp-bg. */
export const THEME_COLORS: Record<Theme, string> = { light: '#f6f4ef', dark: '#0d0c0a' }

/**
 * Runs inline in <head>, before the body paints: applies a stored pick so the
 * page never flashes the other theme. Storage can throw (private mode,
 * blocked site data), in which case the phone's setting simply wins.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export function readStoredTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' ? t : null
  } catch {
    return null
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Not persisted; it still applies for this visit.
  }
}

/** The theme on screen right now: the pick if there is one, else the phone's. */
export function effectiveTheme(stored: Theme | null, prefersDark: boolean): Theme {
  return stored ?? (prefersDark ? 'dark' : 'light')
}
