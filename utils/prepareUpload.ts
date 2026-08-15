/**
 * Downscale oversized photos in the browser before they are uploaded.
 *
 * Cloudinary's free tier rejects images over 10MB, and a modern phone or
 * mirrorless camera clears that easily. Worse, the rejection arrives *after*
 * the whole file has been uploaded, so a 15MB photo costs a long wait and then
 * fails.
 *
 * Downscaling is not just a workaround for that limit. The gallery never
 * serves an image wider than 2560px, so anything above that is bytes nobody
 * will ever see - paid for on upload, on storage, and on every transformation.
 *
 * HEIC cannot be decoded by canvas in Chrome or Firefox, so those files are
 * passed through untouched and rely on the size check instead. They are
 * typically 2-4MB, well inside the limit.
 */

/** The widest source the gallery ever serves. */
const MAX_EDGE = 2560

/** Below this, re-encoding usually costs more quality than it saves bytes. */
const SKIP_BELOW_BYTES = 2 * 1024 * 1024

const QUALITY = 0.85

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Does this browser actually encode WebP from a canvas? Safari 13 does not. */
function supportsWebpEncode(canvas: HTMLCanvasElement): boolean {
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}

export type PrepareResult = {
  file: File
  /** True when the returned file differs from the original. */
  changed: boolean
  originalBytes: number
}

export async function prepareImageForUpload(file: File): Promise<PrepareResult> {
  const original = { file, changed: false, originalBytes: file.size }

  if (file.size <= SKIP_BELOW_BYTES) return original

  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, MAX_EDGE / longest)

    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return original
    }

    // Better resampling than the default when scaling down a long way.
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    /*
     * WebP where available: it keeps alpha, which JPEG would flatten to black
     * on a transparent PNG, and it is markedly smaller at the same quality.
     */
    const useWebp = supportsWebpEncode(canvas)
    const type = useWebp ? 'image/webp' : 'image/jpeg'
    const blob = await canvasToBlob(canvas, type, QUALITY)

    // If re-encoding did not actually help, keep the original - re-encoding an
    // already-optimised JPEG can easily make it larger.
    if (!blob || blob.size >= file.size) return original

    const extension = useWebp ? 'webp' : 'jpg'
    const name = file.name.replace(/\.[^.]+$/, '') + `.${extension}`

    return {
      file: new File([blob], name, { type, lastModified: file.lastModified }),
      changed: true,
      originalBytes: file.size,
    }
  } catch {
    // Undecodable (HEIC in most browsers) or out of memory. Upload as-is and
    // let the size check produce a clear message.
    return original
  }
}
