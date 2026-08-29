/**
 * The QR matrix, plus the classification the renderer needs to style it.
 *
 * `qrcode-generator` handles the parts nobody should hand-write - mode
 * selection, Reed-Solomon, mask evaluation - and hands back a grid of booleans
 * with no notion of which modules are structural. Everything below that line
 * is about telling the three finder patterns apart from the data, because the
 * eyes are styled independently and must not be drawn twice.
 */
import qrcode from 'qrcode-generator'

/** Reed-Solomon level. `H` recovers 30% and is what a logo needs. */
export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H'

export interface QrMatrix {
  /** Module count per side, excluding the quiet zone. */
  size: number
  /** `true` where a module is dark. Indexed `[row][col]`. */
  cells: boolean[][]
  /** `true` where a module belongs to one of the three finder patterns. */
  reserved: boolean[][]
  /** Top-left corner of each 7x7 finder pattern, in module coordinates. */
  eyes: { col: number; row: number }[]
}

/**
 * Finder patterns are always 7x7 and always in the same three corners. The
 * one-module separator around them is blank in the matrix already, so only the
 * 7x7 core needs reserving.
 */
const EYE_SIZE = 7

export function buildMatrix(payload: string, ecc: ErrorCorrection): QrMatrix {
  // Version 0 asks the library to pick the smallest version that fits.
  const qr = qrcode(0, ecc)
  qr.addData(payload)
  qr.make()

  const size = qr.getModuleCount()
  const cells: boolean[][] = []
  for (let row = 0; row < size; row++) {
    const line: boolean[] = []
    for (let col = 0; col < size; col++) line.push(qr.isDark(row, col))
    cells.push(line)
  }

  const eyes = [
    { col: 0, row: 0 },
    { col: size - EYE_SIZE, row: 0 },
    { col: 0, row: size - EYE_SIZE },
  ]

  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  )
  for (const eye of eyes) {
    for (let dy = 0; dy < EYE_SIZE; dy++) {
      for (let dx = 0; dx < EYE_SIZE; dx++) {
        reserved[eye.row + dy]![eye.col + dx] = true
      }
    }
  }

  return { size, cells, reserved, eyes }
}

/**
 * Blanks a centred square of modules so a logo has clean space to sit in.
 *
 * Punching the hole is strictly better than painting the logo over live
 * modules: the decoder's error correction then has to recover data it can
 * still partially see, which is exactly the case it handles worst. Clearing
 * them turns the region into a uniform erasure, and at level H a hole under
 * ~20% of the symbol area stays comfortably inside the recovery budget.
 *
 * Finder patterns are never cleared - a scanner that cannot find the eyes
 * never gets as far as error correction.
 *
 * @param ratio Side length of the hole as a fraction of the symbol.
 */
export function punchLogoHole(matrix: QrMatrix, ratio: number): QrMatrix {
  if (ratio <= 0) return matrix

  const { size } = matrix
  // Round up to an odd module count so the hole is symmetric about the centre.
  let hole = Math.ceil(size * ratio)
  if ((size - hole) % 2 !== 0) hole += 1
  hole = Math.min(hole, size - 2 * EYE_SIZE)
  if (hole <= 0) return matrix

  const start = Math.floor((size - hole) / 2)
  const cells = matrix.cells.map((line) => line.slice())

  for (let row = start; row < start + hole; row++) {
    for (let col = start; col < start + hole; col++) {
      if (matrix.reserved[row]![col]) continue
      cells[row]![col] = false
    }
  }

  return { ...matrix, cells }
}
