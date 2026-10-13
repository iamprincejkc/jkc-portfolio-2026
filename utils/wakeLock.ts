/**
 * Keep the screen on until the returned function is called.
 *
 * iOS suspends a page within seconds of auto-lock, which stops an upload dead.
 * A screen wake lock prevents the auto-lock (Safari 16.4+). It cannot prevent
 * the lock button or a switch to another app, and the browser drops it
 * whenever the page is hidden - so it is taken again each time the page comes
 * back into view.
 *
 * Must be called from a user gesture, before any `await`, or Safari refuses.
 * Unsupported or refused (low power mode, for one) is silently a no-op.
 */
export function holdScreenAwake(): () => void {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return () => undefined

  let sentinel: WakeLockSentinel | null = null
  let released = false

  async function acquire() {
    if (released || sentinel || document.visibilityState !== 'visible') return
    try {
      const lock = await navigator.wakeLock.request('screen')
      // Released while the request was pending.
      if (released) {
        lock.release().catch(() => undefined)
        return
      }
      sentinel = lock
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null
      })
    } catch {
      /* refused - the upload still runs, the screen just may lock */
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') acquire()
  }

  document.addEventListener('visibilitychange', onVisibility)
  acquire()

  return () => {
    released = true
    document.removeEventListener('visibilitychange', onVisibility)
    sentinel?.release().catch(() => undefined)
    sentinel = null
  }
}
