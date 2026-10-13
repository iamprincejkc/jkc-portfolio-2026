/**
 * The descriptive fields every upload carries, validated the same way whether
 * the file is headed for Cloudinary or the R2 vault.
 */

const TAG_PATTERN = /^[a-z0-9 _-]+$/i

export type UploadMeta = {
  title: string
  client: string
  year: string
  alt: string
  color: string
  tags: string[]
}

export function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function readUploadMeta(body: Record<string, unknown> | undefined): UploadMeta {
  const year = text(body?.year, 4)
  if (year && !/^\d{4}$/.test(year)) {
    throw createError({ statusCode: 400, statusMessage: 'Year must be four digits.' })
  }

  const color = text(body?.color, 7)
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw createError({ statusCode: 400, statusMessage: 'Colour must be #rrggbb.' })
  }

  const tags = Array.isArray(body?.tags)
    ? body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : []

  for (const tag of tags) {
    if (tag.length > 40 || !TAG_PATTERN.test(tag)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid category "${tag}". Letters, numbers, spaces, - and _ only.`,
      })
    }
  }

  return {
    title: text(body?.title, 120),
    client: text(body?.client, 120),
    year,
    alt: text(body?.alt, 300),
    color,
    tags,
  }
}
