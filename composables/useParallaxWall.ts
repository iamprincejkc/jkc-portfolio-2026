import type { Photo } from './useGallery'

/**
 * The infinite four-way parallax wall.
 *
 * Four depth layers of images scroll in different directions at different
 * speeds. Sprites are recycled as they leave the viewport, so the wall is
 * endless without holding more than a screenful plus a margin.
 *
 * Kept out of the component so the Three.js import stays dynamic - it is
 * roughly half a megabyte, and only this one route should pay for it.
 *
 * Differences from the reference pen this is based on, all because that pen is
 * a standalone page and this is a route inside an SPA:
 *
 *  - Everything is disposed on teardown. Textures, geometries, materials and
 *    the WebGL context all leak otherwise, and navigating in and out of the
 *    route a few times will exhaust the GPU.
 *  - Animation stops when the tab is hidden and when the user prefers reduced
 *    motion. A continuous full-screen scroll is a textbook vestibular trigger.
 *  - Sprites are dealt from a shuffled deck rather than picked at random, so a
 *    small library does not show the same photo three times at once.
 */

type Direction = 'rightToLeft' | 'leftToRight' | 'topToBottom' | 'bottomToTop'

type LayerConfig = {
  speed: number
  opacity: number
  direction: Direction
  /** Nearer layers are drawn larger and move faster - that is the parallax. */
  scale: number
}

const LAYERS: LayerConfig[] = [
  { speed: 80, opacity: 0.97, direction: 'rightToLeft', scale: 1.15 },
  { speed: 40, opacity: 0.9, direction: 'leftToRight', scale: 0.85 },
  { speed: 60, opacity: 0.94, direction: 'topToBottom', scale: 1.0 },
  { speed: 70, opacity: 0.92, direction: 'bottomToTop', scale: 0.95 },
]

const TILE = 260
const GUTTER = 40

export type WallHandle = {
  destroy: () => void
  setPaused: (paused: boolean) => void
}

export async function createParallaxWall(
  container: HTMLElement,
  photos: Photo[],
  textureUrl: (photo: Photo) => string,
): Promise<WallHandle> {
  const THREE = await import('three')

  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  let camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000)

  /*
   * Deal from a shuffled deck and reshuffle when it runs out. Picking at
   * random instead means a library of six photos shows visible duplicates
   * side by side almost immediately.
   */
  let deck: Photo[] = []
  function nextPhoto(): Photo {
    if (!deck.length) {
      deck = [...photos]
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }
    }
    return deck.pop()!
  }

  const loader = new THREE.TextureLoader()
  loader.setCrossOrigin('anonymous')

  const textureCache = new Map<string, THREE.Texture>()
  function textureFor(photo: Photo): THREE.Texture {
    const url = textureUrl(photo)
    const cached = textureCache.get(url)
    if (cached) return cached
    const texture = loader.load(url)
    texture.colorSpace = THREE.SRGBColorSpace
    textureCache.set(url, texture)
    return texture
  }

  type Sprite = {
    mesh: THREE.Mesh
    material: THREE.MeshBasicMaterial
    layer: number
  }

  const sprites: Sprite[] = []
  const geometry = new THREE.PlaneGeometry(1, 1)

  function viewport() {
    return { w: container.clientWidth, h: container.clientHeight }
  }

  function addSprite(layerIndex: number, x: number, y: number) {
    const config = LAYERS[layerIndex]
    const photo = nextPhoto()

    const material = new THREE.MeshBasicMaterial({
      map: textureFor(photo),
      transparent: true,
      opacity: config.opacity,
    })

    // Keep the photo's real proportions; a wall of identical squares reads as
    // wallpaper rather than as photographs.
    const ratio = photo.width / photo.height || 1
    const size = TILE * config.scale
    const w = ratio >= 1 ? size : size * ratio
    const h = ratio >= 1 ? size / ratio : size

    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(w, h, 1)
    mesh.position.set(x, y, layerIndex)

    scene.add(mesh)
    sprites.push({ mesh, material, layer: layerIndex })
  }

  /** Fill each layer with a grid large enough to cover the viewport plus a margin. */
  function build() {
    const { w, h } = viewport()

    LAYERS.forEach((config, layerIndex) => {
      const step = TILE * config.scale + GUTTER
      const cols = Math.ceil(w / step) + 2
      const rows = Math.ceil(h / step) + 2

      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          // Stagger alternate columns so the layers do not read as a grid.
          const offset = c % 2 ? step / 2 : 0
          addSprite(layerIndex, c * step - step, r * step - step + offset)
        }
      }
    })
  }

  function resize() {
    const { w, h } = viewport()
    renderer.setSize(w, h, false)
    camera = new THREE.OrthographicCamera(0, w, h, 0, -1000, 1000)
    camera.position.z = 10
  }

  /** Wrap a sprite round to the opposite edge once it has fully left. */
  function wrap(sprite: Sprite) {
    const { w, h } = viewport()
    const config = LAYERS[sprite.layer]
    const step = TILE * config.scale + GUTTER
    const p = sprite.mesh.position

    if (config.direction === 'rightToLeft' && p.x < -step) p.x += Math.ceil((w + step * 2) / step) * step
    if (config.direction === 'leftToRight' && p.x > w + step) p.x -= Math.ceil((w + step * 2) / step) * step
    if (config.direction === 'topToBottom' && p.y > h + step) p.y -= Math.ceil((h + step * 2) / step) * step
    if (config.direction === 'bottomToTop' && p.y < -step) p.y += Math.ceil((h + step * 2) / step) * step
  }

  // --- interaction -------------------------------------------------------

  let speedFactor = 1
  let dragging = false
  let lastX = 0

  const onPointerDown = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return
    const delta = e.clientX - lastX
    lastX = e.clientX
    // A horizontal drag scrubs speed and can reverse direction, as in the
    // reference. Clamped so it cannot be flung into nausea.
    speedFactor = Math.max(-3, Math.min(3, speedFactor + delta * 0.01))
  }
  const onPointerUp = () => {
    dragging = false
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    speedFactor = Math.max(-3, Math.min(3, speedFactor + e.deltaY * 0.002))
  }
  const onDoubleClick = () => {
    // Reshuffle which layer sits in front, and re-deal the photos.
    for (const sprite of sprites) {
      sprite.mesh.position.z = Math.random() * LAYERS.length
    }
  }

  container.addEventListener('pointerdown', onPointerDown)
  container.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  container.addEventListener('wheel', onWheel, { passive: false })
  container.addEventListener('dblclick', onDoubleClick)
  window.addEventListener('resize', resize)

  // --- loop --------------------------------------------------------------

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let paused = reducedMotion
  let frame = 0
  let last = performance.now()

  function tick(now: number) {
    frame = requestAnimationFrame(tick)

    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    if (!paused && document.visibilityState === 'visible') {
      for (const sprite of sprites) {
        const config = LAYERS[sprite.layer]
        const distance = config.speed * speedFactor * dt
        const p = sprite.mesh.position

        if (config.direction === 'rightToLeft') p.x -= distance
        if (config.direction === 'leftToRight') p.x += distance
        if (config.direction === 'topToBottom') p.y += distance
        if (config.direction === 'bottomToTop') p.y -= distance

        wrap(sprite)
      }
    }

    renderer.render(scene, camera)
  }

  resize()
  build()
  frame = requestAnimationFrame(tick)

  return {
    setPaused(value: boolean) {
      // Reduced motion is a preference, not a toggle - never override it.
      paused = reducedMotion || value
    },
    destroy() {
      cancelAnimationFrame(frame)

      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('dblclick', onDoubleClick)
      window.removeEventListener('resize', resize)

      /*
       * Order matters and none of it is optional. Without this, navigating
       * away and back a few times exhausts the GPU - the browser caps live
       * WebGL contexts and silently kills the oldest.
       */
      for (const sprite of sprites) {
        scene.remove(sprite.mesh)
        sprite.material.dispose()
      }
      sprites.length = 0

      for (const texture of textureCache.values()) texture.dispose()
      textureCache.clear()

      geometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
