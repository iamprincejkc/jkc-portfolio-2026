/**
 * Downscale a photo in the browser only when Cloudinary would refuse it.
 *
 * Photos are uploaded as originals - the file that left the camera is the one
 * that is kept, and Cloudinary still resizes on delivery, so the gallery loses
 * nothing by storing the full thing.
 *
 * The exception is Cloudinary's free-tier cap of 10MB, which a mirrorless
 * camera or a phone's RAW mode clears easily. It rejects *after* the whole
 * file has been uploaded, so an oversized photo is downscaled here instead of
 * costing a long wait and then failing.
 *
 * HEIC cannot be decoded by canvas in Chrome or Firefox, so those files are
 * passed through untouched and rely on the size check instead. They are
 * typically 2-4MB, well inside the limit.
 */

/** The widest source the gallery ever serves, so the most a downscale keeps. */
const MAX_EDGE = 2560

/** Cloudinary's free-tier image cap. Anything within it goes up untouched. */
const KEEP_ORIGINAL_UP_TO_BYTES = 10 * 1024 * 1024

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

  if (file.size <= KEEP_ORIGINAL_UP_TO_BYTES) return original

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
