import type { InstancedMesh, PlaneGeometry } from 'three'
import {
  createTiles,
  formProgress,
  poseAt,
  stageFor,
  cameraDistance,
  STAGE_FOV,
  type Stage,
  type Tile,
} from '../utils/monthsary/choreography'
import { traceHeart } from '../utils/monthsary/heart'
import { monthsaryLayout, needsRelayout, type MonthsaryLayout } from '../utils/monthsary/layout'
import { fitWords, inkArea, pitchFor, sampleGrid, type Point } from '../utils/monthsary/text-targets'

/**
 * The /monthsary photo tiles: the wall, the tornado and the words.
 *
 * Every tile is one instance of a single quad, and every photo is one square
 * of a single texture atlas, so a thousand tiles are one draw call. Where each
 * tile is comes from utils/monthsary/choreography.ts as a pure function of
 * time; this file only turns poses into matrices and owns the GL objects.
 *
 * Kept out of the page so the Three.js import stays dynamic, as on
 * /gallery/wall: it is around 700KB and only this route should pay for it.
 */

export type ScenePhoto = { src: string; color: string }

export type MonthsaryScene = {
  /** Settles once every photo has loaded or failed, or after a timeout. */
  ready: Promise<void>
  /** `show` is seconds since the tap (null before it); `wall` is seconds since mount. */
  render: (show: number | null, wall: number) => void
  destroy: () => void
}

/**
 * Distinct photos in the atlas. 64 squares of 256px is a 2048px texture,
 * 16MB on the GPU - comfortable on a phone. A bigger gallery is sampled
 * fresh on every visit by the page, so the words still draw on all of it.
 */
export const MAX_PHOTOS = 64

const CELL = 256

/** General Sans is the site's own face; 600 is the heaviest weight it loads. */
const FONT_FAMILY = '"General Sans", system-ui, sans-serif'
const FONT_WEIGHT = 600

/**
 * A stroke thickens the glyphs slightly. Only slightly: at 0.1 em the holes in
 * "a", "o" and "s" filled in on a phone and "Monthsary" became a smear.
 */
const STROKE = 0.045

/** The white frame round each photo, as a fraction of the tile's edge. */
const BORDER = 0.05

const READY_TIMEOUT_MS = 8000

/** Used when the gallery has nothing to give: blush squares with a heart in each. */
const FALLBACK_COLORS = ['#ff8fb1', '#ffb3c7', '#f06292', '#ffc76b', '#c9a7ff', '#ff5d8f', '#ffd1dc', '#e57399']

/** The sky behind the funnel; far tiles fade toward it. Matches `.ms` in the page. */
const FOG = [0.09, 0.035, 0.08] as const

const vertexShader = /* glsl */ `
  attribute vec2 aCell;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec2 vUv;
  varying vec2 vCell;
  varying float vFog;

  void main() {
    vUv = uv;
    vCell = aCell;
    vec4 view = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vFog = smoothstep(uFogNear, uFogFar, -view.z);
    gl_Position = projectionMatrix * view;
  }
`

/*
 * A white frame round each photo, so tiles read as prints while they tumble,
 * and rounded corners cut with `discard` rather than alpha: overlapping tiles
 * in the funnel then depth-sort for free instead of needing a sort per frame.
 */
const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform float uBorder;
  uniform float uLift;
  uniform vec3 uFog;
  varying vec2 vUv;
  varying vec2 vCell;
  varying float vFog;

  void main() {
    vec2 p = abs(vUv - 0.5);
    float corner = 0.07;
    vec2 q = p - (0.5 - corner);
    if (length(max(q, 0.0)) > corner) discard;

    vec2 inner = clamp((vUv - uBorder) / (1.0 - 2.0 * uBorder), 0.004, 0.996);
    vec3 photo = texture2D(uAtlas, (vCell + inner) / uGrid).rgb;

    float edge = max(p.x, p.y);
    float frame = smoothstep(0.5 - uBorder - 0.012, 0.5 - uBorder + 0.004, edge);
    vec3 color = mix(photo, vec3(1.0, 0.972, 0.976), frame);

    // Once settled, the words lift toward blush so dark photos still read against the night.
    color = mix(color, vec3(1.0, 0.82, 0.88), uLift * 0.4) + uLift * 0.12;
    color = mix(color, uFog, vFog * 0.75);
    gl_FragColor = vec4(color, 1.0);
  }
`

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function createMonthsaryScene(container: HTMLElement, photos: ScenePhoto[]): Promise<MonthsaryScene> {
  const THREE = await import('three')

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(STAGE_FOV, 1, 1, 10_000)

  // --- atlas --------------------------------------------------------------

  const sources = photos.slice(0, MAX_PHOTOS)
  const cellCount = sources.length || FALLBACK_COLORS.length
  const cols = Math.ceil(Math.sqrt(cellCount))
  const atlas = document.createElement('canvas')
  atlas.width = atlas.height = cols * CELL
  const paint = atlas.getContext('2d')!

  const cellOrigin = (i: number) => ({ x: (i % cols) * CELL, y: Math.floor(i / cols) * CELL })

  // Every cell starts as its photo's dominant colour, so a slow network shows
  // a wall of colour that fills in, never a wall of black.
  for (let i = 0; i < cellCount; i += 1) {
    const { x, y } = cellOrigin(i)
    paint.fillStyle = sources[i]?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]
    paint.fillRect(x, y, CELL, CELL)
    if (!sources.length) {
      const shade = paint.createLinearGradient(x, y, x + CELL, y + CELL)
      shade.addColorStop(0, 'rgba(255,255,255,0.28)')
      shade.addColorStop(1, 'rgba(120,0,60,0.18)')
      paint.fillStyle = shade
      paint.fillRect(x, y, CELL, CELL)
      paint.fillStyle = 'rgba(255,255,255,0.9)'
      paint.beginPath()
      traceHeart(paint, x + CELL / 2, y + CELL / 2, CELL * 0.46)
      paint.fill()
    }
  }

  const texture = new THREE.CanvasTexture(atlas)
  // Sampled and written as-is: the shader does no colour management, so the
  // photos come out exactly as Cloudinary sent them.
  texture.colorSpace = THREE.NoColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())

  let atlasDirty = false
  let lastUpload = 0

  const loads = sources.map(
    (photo, i) =>
      new Promise<void>((resolve) => {
        const image = new Image()
        // Cloudinary answers with CORS headers; without this the atlas would be
        // tainted and WebGL would refuse to upload it.
        image.crossOrigin = 'anonymous'
        image.decoding = 'async'
        image.onload = () => {
          const side = Math.min(image.naturalWidth, image.naturalHeight)
          const { x, y } = cellOrigin(i)
          paint.drawImage(
            image,
            (image.naturalWidth - side) / 2,
            (image.naturalHeight - side) / 2,
            side,
            side,
            x,
            y,
            CELL,
            CELL,
          )
          atlasDirty = true
          resolve()
        }
        image.onerror = () => resolve()
        image.src = photo.src
      }),
  )
  const ready = Promise.race([Promise.all(loads).then(() => undefined), sleep(READY_TIMEOUT_MS)])

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      uAtlas: { value: texture },
      uGrid: { value: new THREE.Vector2(cols, cols) },
      uBorder: { value: BORDER },
      uLift: { value: 0 },
      uFog: { value: new THREE.Vector3(...FOG) },
      uFogNear: { value: 1 },
      uFogFar: { value: 2 },
    },
  })

  // --- the words ----------------------------------------------------------

  /*
   * The face has to be loaded before the words are traced, or the tiles land
   * in the shape of the fallback font. Bounded, because a font that never
   * arrives must not hold the page hostage.
   */
  await Promise.race([document.fonts?.load(`${FONT_WEIGHT} 100px ${FONT_FAMILY}`), sleep(2500)]).catch(() => undefined)

  /*
   * A soft pink copy of the letters, lit behind the tiles. Mosaic letters have
   * gaps and dark photos in them; the glow fills both, which is most of what
   * keeps the words readable on a phone.
   *
   * Blurred with a canvas shadow rather than `ctx.filter`, which Safari does
   * not support - and the phone this is for is an iPhone. The letters are drawn
   * far off the canvas and only their shadow is offset back onto it.
   */
  function traceGlow(mask: HTMLCanvasElement, fontSize: number): { canvas: HTMLCanvasElement; pad: number } {
    const scale = 0.5
    const pad = fontSize * 0.45
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil((mask.width + pad * 2) * scale)
    canvas.height = Math.ceil((mask.height + pad * 2) * scale)
    const pen = canvas.getContext('2d')!
    const away = canvas.width + 100
    pen.shadowColor = 'rgba(255, 105, 160, 1)'
    pen.shadowOffsetX = away
    for (const blur of [fontSize * 0.28, fontSize * 0.1]) {
      pen.shadowBlur = blur * scale
      pen.drawImage(mask, pad * scale - away, pad * scale, mask.width * scale, mask.height * scale)
    }
    return { canvas, pad }
  }

  function traceWords(layout: MonthsaryLayout): { targets: Point[]; pitch: number; glow: ReturnType<typeof traceGlow> } {
    const { text } = layout
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(text.width))
    canvas.height = Math.max(1, Math.ceil(text.height))
    const pen = canvas.getContext('2d', { willReadFrequently: true })!

    const measuredAt = 100
    pen.font = `${FONT_WEIGHT} ${measuredAt}px ${FONT_FAMILY}`
    const metrics = layout.lines.map((line) => {
      const m = pen.measureText(line)
      return { width: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent }
    })

    // Fitted into a slightly smaller box, so the stroke cannot push ink past the edge.
    const inset = { x: canvas.width * 0.025, y: canvas.height * 0.04 }
    const fitted = fitWords(
      metrics,
      measuredAt,
      { width: canvas.width - inset.x * 2, height: canvas.height - inset.y * 2 },
      { heart: true },
    )

    pen.font = `${FONT_WEIGHT} ${fitted.fontSize}px ${FONT_FAMILY}`
    pen.fillStyle = pen.strokeStyle = '#fff'
    pen.lineJoin = 'round'
    pen.lineWidth = fitted.fontSize * STROKE
    pen.textBaseline = 'alphabetic'
    layout.lines.forEach((line, i) => {
      const { x, baseline } = fitted.lines[i]
      pen.strokeText(line, inset.x + x, inset.y + baseline)
      pen.fillText(line, inset.x + x, inset.y + baseline)
    })
    if (fitted.heart) {
      pen.beginPath()
      traceHeart(pen, inset.x + fitted.heart.x, inset.y + fitted.heart.y, fitted.heart.width)
      pen.fill()
      pen.stroke()
    }

    const image = pen.getImageData(0, 0, canvas.width, canvas.height)
    const mask = { data: image.data, width: image.width, height: image.height, stride: 4 }
    const pitch = pitchFor(inkArea(mask), layout.tiles)
    const targets = sampleGrid(mask, pitch).map((point) => ({ x: point.x + text.x, y: point.y + text.y }))
    return { targets, pitch, glow: traceGlow(canvas, fitted.fontSize) }
  }

  // --- tiles --------------------------------------------------------------

  let layout = monthsaryLayout(container.clientWidth, container.clientHeight)
  let stage: Stage = stageFor(layout.width, layout.height, layout.heroes, 1)
  let tiles: Tile[] = []
  let geometry: PlaneGeometry | null = null
  let mesh: InstancedMesh | null = null

  const glowMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  })
  const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial)
  glowMesh.frustumCulled = false
  scene.add(glowMesh)

  function build() {
    const width = container.clientWidth
    const height = container.clientHeight
    layout = monthsaryLayout(width, height)
    const { targets, pitch, glow } = traceWords(layout)
    stage = stageFor(width, height, layout.heroes, pitch)
    tiles = createTiles({ targets, heroes: layout.heroes, cells: cellCount, random: Math.random })

    // Just behind the tiles, so they hide it where they sit and it shows in every gap.
    glowMaterial.map?.dispose()
    const glowTexture = new THREE.CanvasTexture(glow.canvas)
    glowTexture.colorSpace = THREE.SRGBColorSpace
    glowMaterial.map = glowTexture
    glowMaterial.needsUpdate = true
    const { text } = layout
    glowMesh.position.set(text.x + text.width / 2, height - (text.y + text.height / 2), -4)
    glowMesh.scale.set(text.width + glow.pad * 2, text.height + glow.pad * 2, 1)

    if (mesh) {
      scene.remove(mesh)
      mesh.dispose()
    }
    geometry?.dispose()

    geometry = new THREE.PlaneGeometry(1, 1)
    const cells = new Float32Array(tiles.length * 2)
    tiles.forEach((tile, i) => {
      // The canvas is uploaded flipped, so atlas rows count up from the bottom.
      cells[i * 2] = tile.cell % cols
      cells[i * 2 + 1] = cols - 1 - Math.floor(tile.cell / cols)
    })
    geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))

    mesh = new THREE.InstancedMesh(geometry, material, tiles.length)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // Instances fly everywhere; the unit quad's bounding sphere means nothing.
    mesh.frustumCulled = false
    scene.add(mesh)
  }

  function fitCamera() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)

    // One world unit is one CSS pixel on the z = 0 plane, where the words sit.
    const distance = cameraDistance(height)
    camera.aspect = width / height
    camera.near = distance * 0.05
    camera.far = distance * 4
    camera.position.set(width / 2, height / 2, distance)
    camera.lookAt(width / 2, height / 2, 0)
    camera.updateProjectionMatrix()
    material.uniforms.uFogNear.value = distance * 1.05
    material.uniforms.uFogFar.value = distance * 1.9
  }

  fitCamera()
  build()

  let relayout = 0
  const observer = new ResizeObserver(() => {
    fitCamera()
    if (!needsRelayout(layout, container.clientWidth, container.clientHeight)) {
      stage = { ...stage, width: container.clientWidth, height: container.clientHeight, camera: cameraDistance(container.clientHeight) }
      return
    }
    // A rotation lays the words out again; debounced, since tracing them reads back a canvas.
    window.clearTimeout(relayout)
    relayout = window.setTimeout(build, 150)
  })
  observer.observe(container)

  // --- frame --------------------------------------------------------------

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const scale = new THREE.Vector3()

  function render(show: number | null, wall: number) {
    if (!mesh) return

    // Photos arrive one by one; re-uploading 16MB for each would stutter.
    const now = performance.now()
    if (atlasDirty && now - lastUpload > 250) {
      texture.needsUpdate = true
      atlasDirty = false
      lastUpload = now
    }

    for (let i = 0; i < tiles.length; i += 1) {
      const pose = poseAt(tiles[i], show, wall, stage)
      // Poses are in screen space with y down; WebGL's y points up.
      position.set(pose.x, stage.height - pose.y, pose.z)
      rotation.setFromEuler(euler.set(pose.pitch, pose.yaw, -pose.roll))
      scale.set(pose.size, pose.size, 1)
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
    }
    mesh.instanceMatrix.needsUpdate = true
    const formed = formProgress(show)
    material.uniforms.uLift.value = formed
    // The white frames make tumbling tiles read as prints, but on a five-pixel
    // tile in a letter they are just a grid drawn over the word.
    material.uniforms.uBorder.value = BORDER * (1 - formed * 0.85)
    glowMaterial.opacity = formed * 0.85

    renderer.render(scene, camera)
  }

  return {
    ready,
    render,
    destroy() {
      observer.disconnect()
      window.clearTimeout(relayout)
      if (mesh) {
        scene.remove(mesh)
        mesh.dispose()
      }
      geometry?.dispose()
      material.dispose()
      texture.dispose()
      glowMesh.geometry.dispose()
      glowMaterial.map?.dispose()
      glowMaterial.dispose()
      /*
       * Browsers cap live WebGL contexts and silently kill the oldest, so a
       * context leaked per visit breaks the next WebGL page after a few
       * navigations. Lose it now rather than waiting for garbage collection.
       */
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
