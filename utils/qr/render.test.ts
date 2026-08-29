import { describe, expect, it } from 'vitest'
import { buildMatrix, punchLogoHole } from './matrix'
import {
  buildScene,
  contrastRatio,
  defaultStyle,
  effectiveEcc,
  readableBrandColor,
  scanRisk,
  type QrStyle,
} from './render'
import { sceneToSvg } from './export-svg'
import { randomizeStyle } from './randomize'
import { queryToState, stateToQuery } from './share'
import { emptyContent } from './payload'
import { BODY_SHAPES, EYE_FRAMES, EYE_PUPILS } from './shapes'

const PAYLOAD = 'https://iamjkc.space'

function style(over: Partial<QrStyle> = {}): QrStyle {
  return { ...defaultStyle(), ...over }
}

describe('buildMatrix', () => {
  it('reserves exactly the three finder patterns', () => {
    const m = buildMatrix(PAYLOAD, 'M')
    const reserved = m.reserved.flat().filter(Boolean).length
    expect(reserved).toBe(3 * 7 * 7)
    expect(m.eyes).toEqual([
      { col: 0, row: 0 },
      { col: m.size - 7, row: 0 },
      { col: 0, row: m.size - 7 },
    ])
  })

  it('picks a larger version for a larger payload', () => {
    const small = buildMatrix('hi', 'M').size
    const large = buildMatrix('x'.repeat(400), 'M').size
    expect(large).toBeGreaterThan(small)
  })

  it('grows the symbol as error correction goes up', () => {
    const payload = 'x'.repeat(120)
    expect(buildMatrix(payload, 'H').size).toBeGreaterThanOrEqual(buildMatrix(payload, 'L').size)
  })
})

describe('punchLogoHole', () => {
  it('clears a centred square and leaves the finder patterns alone', () => {
    const base = buildMatrix(PAYLOAD, 'H')
    const punched = punchLogoHole(base, 0.2)

    const centre = Math.floor(base.size / 2)
    expect(punched.cells[centre]![centre]).toBe(false)

    for (const eye of base.eyes) {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          expect(punched.cells[eye.row + dy]![eye.col + dx]).toBe(
            base.cells[eye.row + dy]![eye.col + dx],
          )
        }
      }
    }
  })

  it('is symmetric about the centre', () => {
    const base = buildMatrix(PAYLOAD, 'H')
    const punched = punchLogoHole(base, 0.2)
    const cleared: number[] = []
    for (let row = 0; row < base.size; row++) {
      for (let col = 0; col < base.size; col++) {
        if (base.cells[row]![col] && !punched.cells[row]![col]) cleared.push(row)
      }
    }
    const first = Math.min(...cleared)
    const last = Math.max(...cleared)
    expect(base.size - 1 - last).toBe(first)
  })

  it('does nothing at a zero ratio', () => {
    const base = buildMatrix(PAYLOAD, 'H')
    expect(punchLogoHole(base, 0)).toBe(base)
  })
})

describe('effectiveEcc', () => {
  it('leaves the chosen level alone with no logo', () => {
    expect(effectiveEcc(style({ ecc: 'L' }))).toBe('L')
  })

  it('raises the floor to Q once a logo covers part of the symbol', () => {
    expect(effectiveEcc(style({ ecc: 'L', logoId: 'github' }))).toBe('Q')
    expect(effectiveEcc(style({ ecc: 'M', logoDataUrl: 'data:image/png;base64,x' }))).toBe('Q')
  })

  it('never lowers a level the user raised themselves', () => {
    expect(effectiveEcc(style({ ecc: 'H', logoId: 'github' }))).toBe('H')
  })
})

describe('buildScene', () => {
  it('sizes the canvas to the symbol plus two quiet zones', () => {
    const scene = buildScene(PAYLOAD, style({ margin: 4 }))
    expect(scene.size).toBe(scene.moduleCount + 8)
  })

  it('always emits body, frames and pupils in that order', () => {
    const scene = buildScene(PAYLOAD, style())
    expect(scene.paths.map((p) => p.id)).toEqual(['body', 'eye-frames', 'eye-pupils'])
  })

  it('draws three eye frames and three pupils', () => {
    const scene = buildScene(PAYLOAD, style())
    expect(scene.paths.find((p) => p.id === 'eye-frames')!.shapes).toHaveLength(3)
    expect(scene.paths.find((p) => p.id === 'eye-pupils')!.shapes).toHaveLength(3)
  })

  it('shares the body fill with the eyes unless they are given their own', () => {
    const shared = buildScene(PAYLOAD, style({ gradient: 'linear' }))
    expect(shared.paths[1]!.fill).toBe(shared.paths[0]!.fill)

    const split = buildScene(PAYLOAD, style({ separateEyeColors: true, eyeFrameColor: '#ff0000' }))
    expect(split.paths[1]!.fill).toEqual({ kind: 'solid', color: '#ff0000' })
  })

  it('spans the whole symbol with a linear gradient, whatever the angle', () => {
    for (const gradientAngle of [0, 45, 90, 180, 315]) {
      const scene = buildScene(PAYLOAD, style({ gradient: 'linear', gradientAngle }))
      const fill = scene.paths[0]!.fill
      if (fill.kind !== 'linear') throw new Error('expected a linear fill')
      const mid = 4 + scene.moduleCount / 2
      // The ramp is centred on the symbol and long enough to cover it.
      expect((fill.x1 + fill.x2) / 2).toBeCloseTo(mid)
      expect((fill.y1 + fill.y2) / 2).toBeCloseTo(mid)
      expect(Math.hypot(fill.x2 - fill.x1, fill.y2 - fill.y1)).toBeGreaterThanOrEqual(
        scene.moduleCount - 0.001,
      )
    }
  })

  it('adds a plate and a vector mark for a brand logo', () => {
    const scene = buildScene(PAYLOAD, style({ logoId: 'github' }))
    expect(scene.paths.map((p) => p.id)).toContain('logo-plate')
    expect(scene.paths.map((p) => p.id)).toContain('logo')
    expect(scene.image).toBeUndefined()
  })

  it('uses a raster image for an uploaded logo, and still plates it', () => {
    const scene = buildScene(PAYLOAD, style({ logoDataUrl: 'data:image/png;base64,AAA' }))
    expect(scene.paths.map((p) => p.id)).toContain('logo-plate')
    expect(scene.paths.map((p) => p.id)).not.toContain('logo')
    expect(scene.image?.href).toBe('data:image/png;base64,AAA')
  })

  it('repaints the code in the brand colour when asked', () => {
    const scene = buildScene(PAYLOAD, style({ logoId: 'spotify', matchLogoColor: true }))
    expect(scene.paths[0]!.fill).toEqual({ kind: 'solid', color: '#1ED760' })
  })

  it('is deterministic for a given seed', () => {
    const s = style({ rotation: 'random', rotationStrength: 1, jitter: 0.4, seed: 42 })
    expect(sceneToSvg(buildScene(PAYLOAD, s))).toBe(sceneToSvg(buildScene(PAYLOAD, s)))
  })

  it('changes when the seed changes', () => {
    const a = style({ rotation: 'random', rotationStrength: 1, seed: 1 })
    const b = { ...a, seed: 2 }
    expect(sceneToSvg(buildScene(PAYLOAD, a))).not.toBe(sceneToSvg(buildScene(PAYLOAD, b)))
  })

  it('merges runs when joining, producing far fewer shapes than modules', () => {
    const loose = buildScene(PAYLOAD, style({ join: 'none' })).paths[0]!.shapes.length
    const joined = buildScene(PAYLOAD, style({ join: 'horizontal' })).paths[0]!.shapes.length
    expect(joined).toBeLessThan(loose)
    expect(joined).toBeGreaterThan(0)
  })

  it('renders every shape in the library without throwing', () => {
    for (const body of BODY_SHAPES) {
      for (const frame of EYE_FRAMES) {
        expect(() =>
          buildScene(PAYLOAD, style({ bodyShape: body.id, eyeFrameShape: frame.id })),
        ).not.toThrow()
      }
    }
    for (const pupil of EYE_PUPILS) {
      expect(() => buildScene(PAYLOAD, style({ eyePupilShape: pupil.id }))).not.toThrow()
    }
  })
})

describe('sceneToSvg', () => {
  it('produces one root element with a viewBox in module units', () => {
    const scene = buildScene(PAYLOAD, style())
    const svg = sceneToSvg(scene)
    expect(svg.startsWith('<svg ')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain(`viewBox="0 0 ${scene.size} ${scene.size}"`)
    expect(svg.match(/<svg /g)).toHaveLength(1)
  })

  it('defines a gradient only when one is in use', () => {
    expect(sceneToSvg(buildScene(PAYLOAD, style()))).not.toContain('<defs>')
    expect(sceneToSvg(buildScene(PAYLOAD, style({ gradient: 'radial' })))).toContain(
      '<radialGradient',
    )
  })

  it('paints the outline under the fill so modules keep their size', () => {
    const svg = sceneToSvg(buildScene(PAYLOAD, style({ bodyOutline: true })))
    expect(svg).toContain('paint-order="stroke"')
  })

  it('escapes anything that would break the markup', () => {
    const svg = sceneToSvg(buildScene(PAYLOAD, style({ background: '"><script>' })))
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('carries the pixel size onto the root element when one is given', () => {
    expect(sceneToSvg(buildScene(PAYLOAD, style()), { pixelSize: 512 })).toContain(
      'width="512" height="512"',
    )
  })
})

describe('contrast and scan risk', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })

  it('is quiet for a plain, high-contrast code', () => {
    expect(scanRisk(style())).toBeNull()
  })

  it('rejects a code that has almost no separation from its background', () => {
    expect(scanRisk(style({ foreground: '#888888', background: '#909090' }))?.level).toBe('bad')
  })

  it('warns about an inverted code', () => {
    const risk = scanRisk(style({ foreground: '#ffffff', background: '#0a0a0a' }))
    expect(risk?.level).toBe('warn')
  })

  it('warns about an oversized logo', () => {
    expect(scanRisk(style({ logoId: 'github', logoSize: 0.3 }))?.level).toBe('warn')
  })

  it('judges a gradient by its lightest stop', () => {
    const risk = scanRisk(
      style({ gradient: 'linear', gradientStart: '#000000', gradientEnd: '#f0f0f0' }),
    )
    expect(risk?.level).toBe('bad')
  })
})

describe('readableBrandColor', () => {
  it('keeps a brand colour that reads against the plate', () => {
    expect(readableBrandColor('#1ED760', '#ffffff')).toBe('#1ED760')
  })

  it('swaps out a black mark on a near-black plate', () => {
    expect(readableBrandColor('#000000', '#0a0a0a')).toBe('#ffffff')
  })
})

describe('randomizeStyle', () => {
  const locked = (...facets: Parameters<typeof randomizeStyle>[1]['locked'] extends ReadonlySet<infer T> ? T[] : never) =>
    new Set(facets)

  it('always moves the seed', () => {
    const before = style({ seed: 7 })
    expect(randomizeStyle(before, { locked: new Set() }).seed).not.toBe(7)
  })

  it('leaves a locked facet exactly as it was', () => {
    const before = style({ bodyShape: 'heart', cornerRadius: 0.3 })
    for (let i = 0; i < 30; i++) {
      const after = randomizeStyle(before, { locked: locked('shape') })
      expect(after.bodyShape).toBe('heart')
      expect(after.cornerRadius).toBe(0.3)
    }
  })

  it('locks colours independently of the gradient', () => {
    const before = style({ foreground: '#123456', background: '#fedcba' })
    for (let i = 0; i < 30; i++) {
      const after = randomizeStyle(before, { locked: locked('colors') })
      expect(after.foreground).toBe('#123456')
      expect(after.background).toBe('#fedcba')
    }
  })

  it('only ever produces a scannable palette', () => {
    let current = style()
    for (let i = 0; i < 300; i++) {
      current = randomizeStyle(current, { locked: new Set() })
      expect(scanRisk(current)?.level).not.toBe('bad')
    }
  })

  it('only ever names a shape that exists', () => {
    let current = style()
    const bodies = new Set(BODY_SHAPES.map((s) => s.id))
    const frames = new Set(EYE_FRAMES.map((s) => s.id))
    const pupils = new Set(EYE_PUPILS.map((s) => s.id))
    for (let i = 0; i < 300; i++) {
      current = randomizeStyle(current, { locked: new Set() })
      expect(bodies.has(current.bodyShape)).toBe(true)
      expect(frames.has(current.eyeFrameShape)).toBe(true)
      expect(pupils.has(current.eyePupilShape)).toBe(true)
    }
  })
})

describe('share links', () => {
  it('round-trips a customised style', () => {
    const original = style({
      bodyShape: 'heart',
      join: 'both',
      thickness: 0.8,
      rotation: 'spiral',
      jitter: 0.3,
      foreground: '#123456',
      gradient: 'radial',
      gradientEnd: '#abcdef',
      separateEyeColors: true,
      bodyOutline: true,
      logoId: 'github',
      logoSize: 0.22,
    })
    const content = emptyContent()
    content.url.text = 'https://example.com/a?b=c&d=e'

    const restored = queryToState(stateToQuery(original, content))
    expect(restored.style).toEqual({ ...original, logoDataUrl: null })
    expect(restored.content.url.text).toBe('https://example.com/a?b=c&d=e')
  })

  it('leaves defaults out of the query, so a plain link stays short', () => {
    const q = stateToQuery(defaultStyle(), emptyContent())
    expect([...q.keys()]).toEqual(['m'])
  })

  it('never carries a Wi-Fi password', () => {
    const content = emptyContent()
    content.mode = 'wifi'
    content.wifi.ssid = 'Home'
    content.wifi.password = 'hunter2'
    const q = stateToQuery(defaultStyle(), content)
    expect(q.toString()).not.toContain('hunter2')
    expect(q.get('ws')).toBe('Home')
  })

  it('never carries an uploaded logo', () => {
    const q = stateToQuery(style({ logoDataUrl: 'data:image/png;base64,AAAA' }), emptyContent())
    expect(q.toString()).not.toContain('data:image')
  })

  it('falls back to defaults for junk input rather than throwing', () => {
    const q = new URLSearchParams('m=nonsense&fg=zzzzzz&th=99&rt=sideways&ga=abc')
    const { style: restored } = queryToState(q)
    expect(restored.foreground).toBe(defaultStyle().foreground)
    expect(restored.thickness).toBe(1)
    expect(restored.rotation).toBe('none')
    expect(restored.gradientAngle).toBe(defaultStyle().gradientAngle)
  })
})

describe('match logo colour', () => {
  it('repaints a flat code in the brand colour', () => {
    const scene = buildScene(PAYLOAD, style({ logoId: 'spotify', matchLogoColor: true }))
    expect(scene.paths[0]!.fill).toEqual({ kind: 'solid', color: '#1ED760' })
  })

  it('also drives the first gradient stop, rather than being ignored', () => {
    const scene = buildScene(
      PAYLOAD,
      style({
        logoId: 'spotify',
        matchLogoColor: true,
        gradient: 'linear',
        gradientStart: '#000000',
        gradientEnd: '#102e4c',
      }),
    )
    const fill = scene.paths[0]!.fill
    if (fill.kind !== 'linear') throw new Error('expected a linear fill')
    expect(fill.from).toBe('#1ED760')
    expect(fill.to).toBe('#102e4c')
  })

  it('leaves the palette alone when the switch is off', () => {
    const scene = buildScene(PAYLOAD, style({ logoId: 'spotify', foreground: '#123456' }))
    expect(scene.paths[0]!.fill).toEqual({ kind: 'solid', color: '#123456' })
  })
})
