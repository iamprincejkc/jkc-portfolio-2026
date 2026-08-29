/**
 * Scene -> single-page vector PDF, written by hand.
 *
 * A QR code is the one graphic where "just embed a big PNG" is the wrong
 * answer: it is printed at every size from a business card to a poster, and
 * the modules have to stay hard-edged at all of them. So the paths go in as
 * paths, gradients go in as PDF shadings, and the file stays a few tens of
 * kilobytes.
 *
 * The alternative was a PDF library. jsPDF plus its SVG plugin is roughly
 * 400 kB of JavaScript shipped to every visitor of a portfolio site, to write
 * a document that uses maybe fifteen PDF operators. This file is those fifteen
 * operators.
 */
import type { Fill, QrScene } from './render'
import { parseHex } from './render'
import type { Shape } from './shapes'

/** PostScript points per inch, and the physical size we lay the code out at. */
const PT_PER_INCH = 72
const DEFAULT_INCHES = 4

function num(value: number): string {
  return String(Number(value.toFixed(4)))
}

function rgb(hex: string): string {
  const [r, g, b] = parseHex(hex)
  return `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`
}

/** Emits a shape as PDF path construction operators. */
function pathOps(shapes: readonly Shape[]): string {
  const out: string[] = []
  for (const shape of shapes) {
    for (const cmd of shape) {
      switch (cmd.c) {
        case 'M':
          out.push(`${num(cmd.x)} ${num(cmd.y)} m`)
          break
        case 'L':
          out.push(`${num(cmd.x)} ${num(cmd.y)} l`)
          break
        case 'C':
          out.push(
            `${num(cmd.x1)} ${num(cmd.y1)} ${num(cmd.x2)} ${num(cmd.y2)} ${num(cmd.x)} ${num(cmd.y)} c`,
          )
          break
        case 'Z':
          out.push('h')
          break
      }
    }
  }
  return out.join('\n')
}

/** A two-stop exponential interpolation function, shared by both shading types. */
function stopFunction(from: string, to: string): string {
  const [r0, g0, b0] = parseHex(from)
  const [r1, g1, b1] = parseHex(to)
  return `<< /FunctionType 2 /Domain [0 1] /C0 [${num(r0 / 255)} ${num(g0 / 255)} ${num(b0 / 255)}] /C1 [${num(r1 / 255)} ${num(g1 / 255)} ${num(b1 / 255)}] /N 1 >>`
}

function shadingDict(fill: Extract<Fill, { kind: 'linear' | 'radial' }>): string {
  if (fill.kind === 'linear') {
    return `<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${num(fill.x1)} ${num(fill.y1)} ${num(fill.x2)} ${num(fill.y2)}] /Function ${stopFunction(fill.from, fill.to)} /Extend [true true] >>`
  }
  return `<< /ShadingType 3 /ColorSpace /DeviceRGB /Coords [${num(fill.cx)} ${num(fill.cy)} 0 ${num(fill.cx)} ${num(fill.cy)} ${num(fill.r)}] /Function ${stopFunction(fill.from, fill.to)} /Extend [true true] >>`
}

export interface PdfImage {
  /** Raw RGB triples, row-major, top row first. */
  rgb: Uint8Array
  width: number
  height: number
}

export interface PdfOptions {
  /** Page side in inches. */
  inches?: number
  /**
   * Decoded pixels for an uploaded raster logo. Brand logos are vector and do
   * not need this; if the scene has an image and this is absent, the logo is
   * simply left out rather than shipping a broken file.
   */
  image?: PdfImage
}

/**
 * Deflates with the platform's own compressor when there is one. `FlateDecode`
 * expects a zlib stream, which is exactly what `CompressionStream('deflate')`
 * produces. Without it the content stream goes in raw, which is valid, just
 * larger.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

const encoder = new TextEncoder()

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

export async function sceneToPdf(scene: QrScene, options: PdfOptions = {}): Promise<Blob> {
  const side = (options.inches ?? DEFAULT_INCHES) * PT_PER_INCH
  const scale = side / scene.size

  const content: string[] = []
  const shadings: string[] = []

  content.push('q')
  // PDF space is y-up with the origin bottom-left; the scene is y-down from
  // the top-left. One matrix reconciles them for the whole page.
  content.push(`${num(scale)} 0 0 ${num(-scale)} 0 ${num(side)} cm`)

  content.push(`${rgb(scene.background)} rg`)
  content.push(`0 0 ${num(scene.size)} ${num(scene.size)} re f`)

  for (const path of scene.paths) {
    if (path.shapes.length === 0) continue
    const ops = pathOps(path.shapes)
    if (!ops) continue

    if (path.stroke) {
      // Stroke first, then fill over it, matching the SVG's `paint-order`.
      content.push('q')
      content.push(`${rgb(path.stroke.color)} RG`)
      content.push(`${num(path.stroke.width)} w 1 j`)
      content.push(ops)
      content.push('S')
      content.push('Q')
    }

    if (path.fill.kind === 'solid') {
      content.push(`${rgb(path.fill.color)} rg`)
      content.push(ops)
      content.push('f')
    } else {
      // A shading is painted through a clip rather than set as a fill colour.
      const name = `Sh${shadings.length}`
      shadings.push(`/${name} ${shadingDict(path.fill)}`)
      content.push('q')
      content.push(ops)
      content.push('W n')
      content.push(`/${name} sh`)
      content.push('Q')
    }
  }

  const image = scene.image && options.image ? options.image : null
  if (image) {
    const img = scene.image!
    content.push('q')
    // Images draw into the unit square, so the matrix carries placement. The
    // negative Y flip undoes the page-level flip: image rows run top-down.
    content.push(
      `${num(img.width)} 0 0 ${num(-img.height)} ${num(img.x)} ${num(img.y + img.height)} cm`,
    )
    content.push('/Im0 Do')
    content.push('Q')
  }

  content.push('Q')

  const contentBytes = encoder.encode(content.join('\n'))
  const compressed = await deflate(contentBytes)

  const objects: (string | Uint8Array)[] = []
  const push = (obj: string | Uint8Array): number => {
    objects.push(obj)
    return objects.length
  }

  const contentId = objects.length + 4
  const imageId = image ? contentId + 1 : 0

  const resources = [
    shadings.length ? `/Shading << ${shadings.join(' ')} >>` : '',
    image ? `/XObject << /Im0 ${imageId} 0 R >>` : '',
  ]
    .filter(Boolean)
    .join(' ')

  push('<< /Type /Catalog /Pages 2 0 R >>')
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(side)} ${num(side)}] /Resources << ${resources} >> /Contents ${contentId} 0 R >>`,
  )

  const streamBody = compressed ?? contentBytes
  objects.push(
    concat([
      encoder.encode(
        `<< /Length ${streamBody.length}${compressed ? ' /Filter /FlateDecode' : ''} >>\nstream\n`,
      ),
      streamBody,
      encoder.encode('\nendstream'),
    ]),
  )

  if (image) {
    const pixels = await deflate(image.rgb)
    const body = pixels ?? image.rgb
    objects.push(
      concat([
        encoder.encode(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${body.length}${pixels ? ' /Filter /FlateDecode' : ''} >>\nstream\n`,
        ),
        body,
        encoder.encode('\nendstream'),
      ]),
    )
  }

  // Assemble, tracking byte offsets for the cross-reference table.
  const chunks: Uint8Array[] = []
  let offset = 0
  const write = (bytes: Uint8Array) => {
    chunks.push(bytes)
    offset += bytes.length
  }

  write(encoder.encode('%PDF-1.7\n%âãÏÓ\n'))

  const offsets: number[] = []
  objects.forEach((obj, index) => {
    offsets.push(offset)
    write(encoder.encode(`${index + 1} 0 obj\n`))
    write(typeof obj === 'string' ? encoder.encode(obj) : obj)
    write(encoder.encode('\nendobj\n'))
  })

  const xrefAt = offset
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
  ].join('')
  write(encoder.encode(xref))

  return new Blob([concat(chunks) as BlobPart], { type: 'application/pdf' })
}
