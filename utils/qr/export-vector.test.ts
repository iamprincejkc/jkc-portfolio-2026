import { describe, expect, it } from 'vitest'
import { inflateSync } from 'node:zlib'
import { buildScene, defaultStyle, type QrStyle } from './render'
import { sceneToPdf } from './export-pdf'
import { sceneToEps } from './export-eps'
import { sceneToSvg } from './export-svg'

const PAYLOAD = 'https://iamjkc.space'

function style(over: Partial<QrStyle> = {}): QrStyle {
  return { ...defaultStyle(), ...over }
}

async function pdfText(over: Partial<QrStyle> = {}): Promise<{ raw: string; content: string }> {
  const blob = await sceneToPdf(buildScene(PAYLOAD, style(over)))
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const raw = Buffer.from(bytes).toString('latin1')

  // Pull the page content stream back out and inflate it, so the assertions
  // are about the operators rather than about the compression.
  const start = raw.indexOf('stream\n', raw.indexOf('/Contents')) + 'stream\n'.length
  const end = raw.indexOf('\nendstream', start)
  const body = bytes.subarray(start, end)
  const content = raw.includes('/FlateDecode')
    ? inflateSync(Buffer.from(body)).toString('latin1')
    : Buffer.from(body).toString('latin1')

  return { raw, content }
}

describe('sceneToPdf', () => {
  it('writes a well-formed single-page document', async () => {
    const { raw } = await pdfText()
    expect(raw.startsWith('%PDF-1.7')).toBe(true)
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(raw).toContain('/Type /Catalog')
    expect(raw).toContain('/Count 1')
  })

  it('points every xref entry at a real object header', async () => {
    const blob = await sceneToPdf(buildScene(PAYLOAD, style()))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const raw = Buffer.from(bytes).toString('latin1')

    const xrefAt = Number(raw.slice(raw.lastIndexOf('startxref')).match(/startxref\s+(\d+)/)![1])
    expect(raw.slice(xrefAt, xrefAt + 4)).toBe('xref')

    const entries = [...raw.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    )
    expect(entries.length).toBeGreaterThanOrEqual(4)
    entries.forEach((offset, index) => {
      expect(raw.slice(offset, offset + 8)).toContain(`${index + 1} 0 obj`)
    })
  })

  it('lays the page out at four inches square', async () => {
    const { raw } = await pdfText()
    expect(raw).toContain('/MediaBox [0 0 288 288]')
  })

  it('draws the code as paths, not as an image', async () => {
    const { content, raw } = await pdfText()
    expect(content).toMatch(/\bm\b/)
    expect(content).toMatch(/\bc\b/)
    expect(content).toMatch(/\bf\b/)
    expect(raw).not.toContain('/Subtype /Image')
  })

  it('flips the Y axis exactly once, at the top of the content stream', async () => {
    const { content } = await pdfText()
    const flips = content.match(/^\S+ 0 0 -\S+ 0 \S+ cm$/gm) ?? []
    expect(flips).toHaveLength(1)
  })

  it('registers a shading and clips to it for a linear gradient', async () => {
    const { raw, content } = await pdfText({ gradient: 'linear' })
    expect(raw).toContain('/Shading <<')
    expect(raw).toContain('/ShadingType 2')
    expect(content).toContain('W n')
    expect(content).toContain('/Sh0 sh')
  })

  it('uses a radial shading for a radial gradient', async () => {
    const { raw } = await pdfText({ gradient: 'radial' })
    expect(raw).toContain('/ShadingType 3')
  })

  it('strokes before it fills, so an outline grows outward', async () => {
    const { content } = await pdfText({ bodyOutline: true })
    expect(content.indexOf('\nS\n')).toBeGreaterThan(-1)
    expect(content.indexOf('\nS\n')).toBeLessThan(content.lastIndexOf('\nf\n'))
  })

  it('keeps a brand logo as vector, with no image object at all', async () => {
    const { raw } = await pdfText({ logoId: 'github' })
    expect(raw).not.toContain('/XObject')
  })

  it('embeds an image object only when there is an uploaded logo to embed', async () => {
    const scene = buildScene(PAYLOAD, style({ logoDataUrl: 'data:image/png;base64,AAAA' }))
    const blob = await sceneToPdf(scene, {
      image: { rgb: new Uint8Array(4 * 4 * 3), width: 4, height: 4 },
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const raw = Buffer.from(bytes).toString('latin1')
    expect(raw).toContain('/Subtype /Image')
    expect(raw).toContain('/Width 4')
    expect(raw).toContain('/XObject << /Im0 5 0 R >>')

    const start = raw.indexOf('stream\n', raw.indexOf('/Contents')) + 'stream\n'.length
    const content = inflateSync(
      Buffer.from(bytes.subarray(start, raw.indexOf('\nendstream', start))),
    ).toString('latin1')
    expect(content).toContain('/Im0 Do')
  })

  it('omits the logo rather than writing a broken reference when pixels are missing', async () => {
    const scene = buildScene(PAYLOAD, style({ logoDataUrl: 'data:image/png;base64,AAAA' }))
    const blob = await sceneToPdf(scene)
    const raw = Buffer.from(new Uint8Array(await blob.arrayBuffer())).toString('latin1')
    expect(raw).not.toContain('/Im0 Do')
    expect(raw).not.toContain('/XObject')
  })

  it('declares a Length that matches the bytes actually written', async () => {
    const blob = await sceneToPdf(buildScene(PAYLOAD, style()))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const raw = Buffer.from(bytes).toString('latin1')
    const declared = Number(raw.match(/\/Length (\d+)/)![1])
    const start = raw.indexOf('stream\n') + 'stream\n'.length
    const end = raw.indexOf('\nendstream', start)
    expect(end - start).toBe(declared)
  })
})

describe('sceneToEps', () => {
  async function eps(over: Partial<QrStyle> = {}): Promise<string> {
    return sceneToEps(buildScene(PAYLOAD, style(over))).text()
  }

  it('carries the EPSF header and a matching bounding box', async () => {
    const text = await eps()
    expect(text.startsWith('%!PS-Adobe-3.0 EPSF-3.0')).toBe(true)
    expect(text).toContain('%%BoundingBox: 0 0 288 288')
    expect(text).toContain('%%HiResBoundingBox: 0 0 288 288')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('balances every gsave with a grestore', async () => {
    const text = await eps({ bodyOutline: true, gradient: 'linear', separateEyeColors: true })
    expect((text.match(/^gsave$/gm) ?? []).length).toBe((text.match(/^grestore$/gm) ?? []).length)
  })

  it('balances save and restore around the whole document', async () => {
    const text = await eps()
    expect(text).toContain('/qrsave save def')
    expect(text).toContain('qrsave restore')
  })

  it('draws with path operators', async () => {
    const text = await eps()
    expect(text).toContain('moveto')
    expect(text).toContain('curveto')
    expect(text).toContain('closepath')
    expect(text).toContain('fill')
  })

  it('declares LanguageLevel 3 when it needs shfill, and uses it', async () => {
    const text = await eps({ gradient: 'linear' })
    expect(text).toContain('%%LanguageLevel: 3')
    expect(text).toContain('/ShadingType 2')
    expect(text).toContain('shfill')
    expect(text).toContain('clip')
  })

  it('emits hex image data with a scanline buffer for an uploaded logo', async () => {
    const scene = buildScene(PAYLOAD, style({ logoDataUrl: 'data:image/png;base64,AAAA' }))
    const text = await sceneToEps(scene, {
      image: { rgb: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 1, 2, 3]), width: 2, height: 2 },
    }).text()
    expect(text).toContain('/qrpix 6 string def')
    expect(text).toContain('false 3 colorimage')
    expect(text).toContain('ff0000')
  })

  it('never writes an unclosed hex line longer than the DSC limit', async () => {
    const scene = buildScene(PAYLOAD, style({ logoDataUrl: 'data:image/png;base64,AAAA' }))
    const text = await sceneToEps(scene, {
      image: { rgb: new Uint8Array(64 * 64 * 3), width: 64, height: 64 },
    }).text()
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(255)
  })
})

/**
 * The three vector formats are three encodings of one command list. If they
 * ever disagree on a coordinate, the preview stops predicting the download,
 * which is the whole premise of building a scene instead of three renderers.
 */
describe('the vector formats agree', () => {
  /** Pulls every coordinate out of a format, in document order. */
  function numbers(text: string, pattern: RegExp): number[] {
    return [...text.matchAll(pattern)].flatMap((m) =>
      m[1]!.trim().split(/\s+/).map(Number),
    )
  }

  it('draws the same geometry in SVG, PDF and EPS', async () => {
    const scene = buildScene(PAYLOAD, style({ bodyShape: 'heart', eyeFrameShape: 'drop' }))

    const fromSvg = [...sceneToSvg(scene).matchAll(/ d="([^"]+)"/g)]
      .map((m) => m[1]!)
      .join('')
      .split(/(?=[MLCZ])/)
      .filter((token) => token && token[0] !== 'Z')
      .flatMap((token) => token.slice(1).trim().split(/\s+/).map(Number))
    expect(fromSvg.length).toBeGreaterThan(100)

    const { content } = await pdfText({ bodyShape: 'heart', eyeFrameShape: 'drop' })
    const fromPdf = numbers(content, /^((?:-?[\d.]+ )+)[mlc]$/gm)

    const eps = await sceneToEps(scene).text()
    const fromEps = numbers(eps, /^((?:-?[\d.]+ )+)(?:moveto|lineto|curveto)$/gm)

    expect(fromPdf).toHaveLength(fromSvg.length)
    expect(fromEps).toHaveLength(fromSvg.length)

    for (let i = 0; i < fromSvg.length; i++) {
      // The formats round to different precisions, so compare within a
      // thousandth of a module rather than exactly.
      expect(fromPdf[i], `pdf coordinate ${i}`).toBeCloseTo(fromSvg[i]!, 3)
      expect(fromEps[i], `eps coordinate ${i}`).toBeCloseTo(fromSvg[i]!, 3)
    }
  })
})
