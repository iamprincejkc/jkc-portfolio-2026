/**
 * Average colour of an image, computed in the browser at upload time.
 *
 * Storing it on the Cloudinary asset means every tile can paint a correctly
 * coloured placeholder with no extra network request at view time - no base64
 * LQIP inflating the HTML, no second round trip for a blur thumbnail.
 *
 * Downscaling to a single pixel makes the GPU do the averaging.
 */
export async function dominantColor(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 1,
      resizeHeight: 1,
      resizeQuality: 'high',
    })

    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return ''

    context.drawImage(bitmap, 0, 0)
    bitmap.close()

    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  } catch {
    // A missing placeholder colour is cosmetic - never fail an upload over it.
    return ''
  }
}
