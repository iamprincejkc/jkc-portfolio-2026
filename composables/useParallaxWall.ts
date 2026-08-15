import type { Photo } from './useGallery'

/**
 * The infinite four-way parallax wall.
 *
 * Four sparse bands of photos, each travelling in its own direction. Depth
 * comes from three things working together: bands further back are drawn
 * smaller, they move slower, and every sprite carries its own speed variation
 * so nothing travels in lockstep.
 *
 * Left alone the wall drifts slowly. Scrolling accelerates it and the input
 * bleeds off back to that drift; a horizontal drag steers it and can reverse
 * it. Nothing moves at a shared rate - each band has its own speed and each
 * sprite its own variation on top, which is what reads as depth.
 *
 * Kept out of the component so the Three.js import stays dynamic: it is around
 * 700KB, and only this route should pay for it.
 */

type Direction = 'rightToLeft' | 'leftToRight' | 'topToBottom' | 'bottomToTop'

type Band = { speed: number; opacity: number; direction: Direction }

const BANDS: Band[] = [
  { speed: 80, opacity: 0.97, direction: 'rightToLeft' },
  { speed: 40, opacity: 0.9, direction: 'leftToRight' },
  { speed: 60, opacity: 0.94, direction: 'topToBottom' },
  { speed: 70, opacity: 0.92, direction: 'bottomToTop' },
]

/** Depth: bands further back are drawn smaller. */
const DEPTH_SCALE = [1.0, 0.8, 0.65, 0.5]

const MAX_SPEED = 5

/** How quickly scroll input bleeds off toward the idle drift. */
const FRICTION = 0.94

/**
 * The wall never fully stops - it drifts. Every band and every sprite carries
 * its own multiplier on top of this, so the drift is a parallax rather than a
 * uniform slide.
 */
const IDLE_SPEED = 0.55

/**
 * Fraction of the viewport the sprites should cover in total.
 *
 * How crowded the wall feels is a matter of area, not width. Sizing by width
 * alone gave 181% coverage on a 1440x900 laptop and 64% on a 2560x1440
 * desktop - the same tile against a much smaller area. Solving for area keeps
 * it consistent on any screen.
 */
const TARGET_COVERAGE = 0.62

/** Sum of the squared depth scales, since coverage is an area. */
const DEPTH_AREA = DEPTH_SCALE.reduce((total, scale) => total + scale * scale, 0)

/**
 * Sprite size and count derived from the viewport.
 *
 * The count is tiered - a phone showing 60 sprites is busy however small they
 * are - and the size is then solved so total coverage lands on target.
 */
function tuning(width: number, height: number) {
  const perBand = width < 640 ? 8 : width < 1024 ? 11 : 15
  const area = Math.max(width * height, 1)

  const ideal = Math.sqrt((TARGET_COVERAGE * area) / (perBand * DEPTH_AREA))
  // Clamped so a very small or very large viewport still gets a sane tile.
  const tile = Math.round(Math.max(90, Math.min(320, ideal)))

  return { tile, perBand, pixelRatio: width < 640 ? 1.5 : 2 }
}

export type WallHandle = {
  destroy: () => void
  setPaused: (paused: boolean) => void
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

export async function createParallaxWall(
  container: HTMLElement,
  photos: Photo[],
  textureUrl: (photo: Photo) => string,
): Promise<WallHandle> {
  const THREE = await import('three')

  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, tuning(container.clientWidth, container.clientHeight).pixelRatio),
  )
  container.appendChild(renderer.domElement)

  let camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000)

  /* Deal from a shuffled deck: random picks put the same photo on screen
     several times at once when the library is small. */
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
    band: number
    speed: number
    width: number
    height: number
    seed: number
    baseX: number
    baseY: number
    /** Total run length of this band, used to wrap round. */
    span: number
  }

  const sprites: Sprite[] = []
  const geometry = new THREE.PlaneGeometry(1, 1)
  let builtFor = 0

  const viewport = () => ({ w: container.clientWidth, h: container.clientHeight })

  function build() {
    const { w, h } = viewport()
    const { tile, perBand } = tuning(w, h)
    builtFor = w

    BANDS.forEach((band, bandIndex) => {
      const depth = DEPTH_SCALE[bandIndex]
      const horizontal = band.direction === 'rightToLeft' || band.direction === 'leftToRight'

      for (let i = 0; i < perBand; i += 1) {
        const photo = nextPhoto()
        const ratio = photo.width / photo.height || 1

        // Slight per-sprite size jitter stops the band reading as a filmstrip.
        const jitter = rand(0.85, 1.15)
        const size = tile * depth * jitter
        const sw = ratio > 1 ? size : size * ratio
        const sh = ratio > 1 ? size / ratio : size

        // Spaced along the axis of travel, scattered across the other one.
        const spacing = (horizontal ? sw : sh) * 1.6
        const span = spacing * perBand

        const x = horizontal ? i * spacing : rand(sw / 2, Math.max(sw, w - sw / 2))
        const y = horizontal ? rand(sh / 2, Math.max(sh, h - sh / 2)) : i * spacing

        const material = new THREE.MeshBasicMaterial({
          map: textureFor(photo),
          transparent: true,
          opacity: band.opacity,
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.scale.set(sw, sh, 1)
        // Nearer bands draw on top.
        mesh.position.set(x, y, -bandIndex * 10)
        scene.add(mesh)

        sprites.push({
          mesh,
          material,
          band: bandIndex,
          // Per-sprite variation is what stops a band moving as one slab.
          speed: band.speed * rand(0.7, 1.3),
          width: sw,
          height: sh,
          seed: rand(0, 1000),
          baseX: x,
          baseY: y,
          span,
        })
      }
    })
  }

  function resize() {
    const { w, h } = viewport()
    renderer.setSize(w, h, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tuning(w, h).pixelRatio))
    camera = new THREE.OrthographicCamera(0, w, h, 0, -1000, 1000)
    camera.position.z = 100

    /*
     * Sprite sizes and positions were computed for the old viewport. A small
     * change does not matter, but a rotation or a jump across a breakpoint
     * leaves them scattered off-screen or absurdly large, so rebuild.
     */
    if (builtFor && Math.abs(w - builtFor) > builtFor * 0.25) rebuild()
  }

  function teardownSprites() {
    for (const sprite of sprites) {
      scene.remove(sprite.mesh)
      sprite.material.dispose()
    }
    sprites.length = 0
  }

  function rebuild() {
    teardownSprites()
    build()
  }

  /** Wrap a sprite to the far end of its band once it has fully left. */
  function wrap(sprite: Sprite) {
    const { w, h } = viewport()
    const direction = BANDS[sprite.band].direction
    const p = sprite.mesh.position

    if (direction === 'rightToLeft' && p.x < -sprite.width) {
      p.x += sprite.span
      sprite.baseX += sprite.span
    } else if (direction === 'leftToRight' && p.x > w + sprite.width) {
      p.x -= sprite.span
      sprite.baseX -= sprite.span
    } else if (direction === 'topToBottom' && p.y > h + sprite.height) {
      p.y -= sprite.span
      sprite.baseY -= sprite.span
    } else if (direction === 'bottomToTop' && p.y < -sprite.height) {
      p.y += sprite.span
      sprite.baseY += sprite.span
    }
  }

  // --- input -------------------------------------------------------------

  let speed = 0
  let dragging = false
  let lastX = 0

  const clamp = (v: number) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v))

  const onPointerDown = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX
    container.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return
    const delta = e.clientX - lastX
    lastX = e.clientX
    speed = clamp(speed - delta * 0.05)
  }
  const onPointerUp = () => {
    dragging = false
  }
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    // Push in the direction of the wheel, accelerating on repeat scrolls.
    const direction = Math.sign(e.deltaY) || 1
    speed = clamp(direction * (Math.abs(speed) + 0.6))
  }
  const onDoubleClick = () => {
    // Re-deal the photos and re-scatter, without rebuilding the GL objects.
    const { w, h } = viewport()
    for (const sprite of sprites) {
      const horizontal =
        BANDS[sprite.band].direction === 'rightToLeft' ||
        BANDS[sprite.band].direction === 'leftToRight'
      sprite.material.map = textureFor(nextPhoto())
      sprite.material.needsUpdate = true
      if (horizontal) {
        sprite.baseY = rand(sprite.height / 2, Math.max(sprite.height, h - sprite.height / 2))
      } else {
        sprite.baseX = rand(sprite.width / 2, Math.max(sprite.width, w - sprite.width / 2))
      }
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
      /*
       * Ease back toward the idle drift rather than to zero. Scroll input
       * still accelerates well past it and bleeds off, but the wall is never
       * motionless - and because every band and sprite scales this by its own
       * factor, the drift itself is a parallax rather than a uniform slide.
       */
      if (!dragging) speed += (IDLE_SPEED - speed) * (1 - FRICTION)

      for (const sprite of sprites) {
        const direction = BANDS[sprite.band].direction
        const distance = sprite.speed * speed * dt
        const p = sprite.mesh.position

        if (direction === 'rightToLeft') {
          sprite.baseX -= distance
        } else if (direction === 'leftToRight') {
          sprite.baseX += distance
        } else if (direction === 'topToBottom') {
          sprite.baseY += distance
        } else {
          sprite.baseY -= distance
        }

        /*
         * A slow sway and pulse, independent of scrolling. This is what keeps
         * the wall alive when it is at rest - without it, a stopped wall is a
         * static collage.
         */
        const sway = Math.sin(now * 0.001 + sprite.seed) * 3
        const pulse = 1 + Math.sin(now * 0.001 + sprite.seed) * 0.015

        p.x = sprite.baseX + (direction === 'topToBottom' || direction === 'bottomToTop' ? sway : 0)
        p.y = sprite.baseY + (direction === 'rightToLeft' || direction === 'leftToRight' ? sway : 0)
        sprite.mesh.scale.set(sprite.width * pulse, sprite.height * pulse, 1)

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
       * None of this is optional. Browsers cap live WebGL contexts and kill
       * the oldest silently, so leaking one per visit breaks the route after
       * a handful of navigations.
       */
      teardownSprites()

      for (const texture of textureCache.values()) texture.dispose()
      textureCache.clear()

      geometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
