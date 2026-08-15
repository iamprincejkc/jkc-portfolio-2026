import type { Scope } from '../server/utils/auth'

/**
 * The viewer's current scope.
 *
 * Used only to decide whether to *render* admin controls. It is not a security
 * boundary - the server re-checks the scope on every admin route and endpoint,
 * so hiding a button never stands alone.
 */
export function useGallerySession() {
  return useFetch<{ scope: Scope | null }>('/api/gallery/session', {
    key: 'gallery-session',
    default: () => ({ scope: null }),
  })
}
