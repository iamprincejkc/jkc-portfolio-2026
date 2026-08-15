/**
 * How many frames sit in a row: the viewer's choice, not a breakpoint guess.
 *
 * Applies from 1024px up. Below that the feed is one or two columns because
 * there is not room for more, and a density control there would only make
 * tiles too small to read.
 */

export type Density = 's' | 'm' | 'l'

export const DENSITIES: { value: Density; label: string; perRow: number }[] = [
  { value: 'l', label: 'Large', perRow: 2 },
  { value: 'm', label: 'Medium', perRow: 3 },
  { value: 's', label: 'Small', perRow: 4 },
]

const STORAGE_KEY = 'gallery-density'
const DEFAULT: Density = 'm'

export function useGalleryDensity() {
  // useState so the value survives client-side navigation between the feed and
  // a detail page without re-reading storage.
  const density = useState<Density>('gallery-density', () => DEFAULT)

  onMounted(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 's' || stored === 'm' || stored === 'l') density.value = stored
    } catch {
      // Private browsing with storage disabled. The default is fine.
    }
  })

  function setDensity(value: Density) {
    density.value = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Not remembering the choice is better than breaking the page over it.
    }
  }

  return { density, setDensity, options: DENSITIES }
}
