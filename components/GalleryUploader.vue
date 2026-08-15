<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

/**
 * Direct-to-Cloudinary uploader.
 *
 * The browser asks the server for a signed ticket, then POSTs the bytes
 * straight to Cloudinary. Nothing large crosses our own server, which matters
 * on Netlify: a Function request body is capped at 6MB, well under a decent
 * photo. The API secret never leaves the server.
 *
 * XHR rather than fetch, because upload progress still has no widely supported
 * fetch equivalent.
 */

const emit = defineEmits<{ uploaded: [] }>()

/*
 * HEIC is the default on iPhone, and browsers frequently report it with an
 * empty `file.type` - Chrome and Firefox cannot decode it, so they will not
 * name it either. Matching on MIME alone rejects exactly the photos most
 * likely to be uploaded, so extension is the fallback.
 *
 * Cloudinary transcodes HEIC on ingest and `f_auto` serves JPEG/WebP, so the
 * gallery never has to display a format browsers cannot render.
 */
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm']

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'heic', 'heif']
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v']

/*
 * Cloudinary's own limits, not arbitrary choices. The free tier rejects images
 * over 10MB and video over 100MB, and it does so *after* the whole file has
 * uploaded - so checking here saves a long wait ending in a confusing error.
 *
 * Oversized photos are downscaled before this check rather than rejected: see
 * prepareImageForUpload. The cap is the backstop for what cannot be
 * downscaled, which in practice means HEIC on Chrome and Firefox.
 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

const CONCURRENCY = 3

type Kind = 'image' | 'video'

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

/** Decide the resource type, falling back to extension when MIME is missing. */
function kindOf(file: File): Kind | null {
  const type = file.type.toLowerCase()
  if (VIDEO_MIME.includes(type)) return 'video'
  if (IMAGE_MIME.includes(type)) return 'image'

  const ext = extensionOf(file.name)
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (IMAGE_EXT.includes(ext)) return 'image'
  return null
}

/** Browsers cannot paint a local HEIC preview, so do not try. */
function canPreview(file: File): boolean {
  const ext = extensionOf(file.name)
  return !['heic', 'heif'].includes(ext) && !file.type.includes('heic') && !file.type.includes('heif')
}

type Status = 'queued' | 'uploading' | 'done' | 'error'

type Item = {
  id: string
  file: File
  kind: Kind
  /** Empty when the browser cannot render a local preview (HEIC). */
  previewUrl: string
  title: string
  client: string
  year: string
  alt: string
  tags: string
  progress: number
  status: Status
  error?: string
  /** e.g. "resized 15.0 MB to 1.4 MB". */
  note?: string
}

const input = ref<HTMLInputElement | null>(null)
const items = ref<Item[]>([])
const dragging = ref(false)
const running = ref(false)
const summary = ref<string | null>(null)

const pending = computed(() => items.value.filter((item) => item.status !== 'done').length)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function addFiles(files: FileList | File[]) {
  const year = new Date().getFullYear().toString()
  const accepted: Item[] = []
  const rejected: string[] = []

  for (const file of Array.from(files)) {
    const kind = kindOf(file)
    if (!kind) {
      rejected.push(`${file.name} (unsupported type)`)
      continue
    }

    /*
     * Video is checked now because nothing can shrink it here. Photos are
     * checked after downscaling instead - rejecting a 15MB original that
     * would have become 1.5MB would be wrong.
     */
    if (kind === 'video' && file.size > MAX_VIDEO_BYTES) {
      rejected.push(`${file.name} (over ${formatBytes(MAX_VIDEO_BYTES)})`)
      continue
    }

    accepted.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      kind,
      previewUrl: canPreview(file) ? URL.createObjectURL(file) : '',
      title: titleFromFilename(file.name),
      client: '',
      year,
      alt: '',
      tags: '',
      progress: 0,
      status: 'queued',
    })
  }

  if (accepted.length) items.value = [...items.value, ...accepted]
  summary.value = rejected.length ? `Skipped: ${rejected.join(', ')}` : null
}

function remove(id: string) {
  const target = items.value.find((item) => item.id === id)
  // HEIC items have no object URL to revoke.
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  items.value = items.value.filter((item) => item.id !== id)
}

function clearAll() {
  for (const item of items.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  items.value = []
  summary.value = null
}

// Object URLs are a genuine leak across a long admin session.
onBeforeUnmount(() => {
  for (const item of items.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
})

async function uploadOne(item: Item): Promise<boolean> {
  item.status = 'uploading'
  item.progress = 0
  item.error = undefined

  const tags = item.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)

  /*
   * Downscale before uploading. The gallery never serves wider than 2560px,
   * so a larger original is bytes nobody sees - and Cloudinary would reject it
   * anyway, only after the whole upload had finished.
   */
  let upload = item.file
  if (item.kind === 'image') {
    const prepared = await prepareImageForUpload(item.file)
    upload = prepared.file
    if (prepared.changed) {
      item.note = `resized ${formatBytes(prepared.originalBytes)} to ${formatBytes(upload.size)}`
    }
  }

  if (item.kind === 'image' && upload.size > MAX_IMAGE_BYTES) {
    item.status = 'error'
    item.error = `Still ${formatBytes(upload.size)} after resizing; Cloudinary's limit is ${formatBytes(MAX_IMAGE_BYTES)}. Convert it to JPEG first.`
    return false
  }

  // Only still images the browser can decode yield a colour. Video and HEIC
  // fall back to the neutral placeholder, which dominantColor already returns.
  const color = item.kind === 'image' && item.previewUrl ? await dominantColor(item.file) : ''

  let ticket: {
    apiKey: string
    signature: string
    uploadUrl: string
    params: Record<string, string>
  }

  try {
    ticket = await $fetch('/api/gallery/admin/sign-upload', {
      method: 'POST',
      body: {
        title: item.title,
        client: item.client,
        year: item.year,
        alt: item.alt || item.title,
        color,
        tags,
        kind: item.kind,
      },
    })
  } catch (caught: any) {
    item.status = 'error'
    item.error = caught?.data?.statusMessage || 'Could not sign upload.'
    return false
  }

  const form = new FormData()
  form.append('file', upload)
  form.append('api_key', ticket.apiKey)
  form.append('signature', ticket.signature)
  // Send back exactly what the server signed - any extra signed parameter
  // would invalidate the signature.
  for (const [key, value] of Object.entries(ticket.params)) form.append(key, value)

  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest()
    request.open('POST', ticket.uploadUrl, true)

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      item.progress = Math.round((event.loaded / event.total) * 100)
    })

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        item.status = 'done'
        item.progress = 100
        resolve(true)
        return
      }
      let message = `Upload failed (${request.status}).`
      try {
        const parsed = JSON.parse(request.responseText)
        if (parsed?.error?.message) message = parsed.error.message
      } catch {
        /* keep the generic message */
      }
      item.status = 'error'
      item.error = message
      resolve(false)
    })

    request.addEventListener('error', () => {
      item.status = 'error'
      item.error = 'Network error during upload.'
      resolve(false)
    })

    request.send(form)
  })
}

async function uploadAll() {
  const queue = items.value.filter((item) => item.status === 'queued' || item.status === 'error')
  if (!queue.length || running.value) return

  running.value = true
  summary.value = null

  let succeeded = 0
  const cursor = { index: 0 }

  // Small worker pool: enough to saturate a connection, not so many that every
  // individual upload crawls.
  async function worker() {
    while (cursor.index < queue.length) {
      const item = queue[cursor.index]
      cursor.index += 1
      if (await uploadOne(item)) succeeded += 1
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

  running.value = false
  summary.value =
    succeeded === queue.length
      ? `${succeeded} uploaded.`
      : `${succeeded} of ${queue.length} uploaded. Retry the rest below.`

  if (succeeded > 0) {
    await $fetch('/api/gallery/admin/refresh', { method: 'POST' })
    emit('uploaded')
  }
}
</script>

<template>
  <section>
    <div
      class="flex flex-col items-center justify-center border border-dashed px-6 py-[clamp(3rem,8vw,6rem)] text-center transition-colors duration-fast"
      :class="dragging ? 'border-accent bg-white/5' : 'border-border-muted'"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="
        dragging = false;
        addFiles($event.dataTransfer!.files)
      "
    >
      <p class="font-display text-2xl">Drop images here</p>
      <p class="mt-3 text-xs text-text-muted">
        Photos (JPEG, PNG, HEIC, WebP, AVIF, GIF) up to
        {{ formatBytes(MAX_IMAGE_BYTES) }} · video (MP4, MOV, WebM) up to
        {{ formatBytes(MAX_VIDEO_BYTES) }}
      </p>
      <button
        type="button"
        class="eyebrow mt-8 border border-accent px-6 py-3 !text-accent transition-colors duration-normal hover:bg-accent hover:!text-text-inverse"
        @click="input?.click()"
      >
        Choose files
      </button>
      <input
        ref="input"
        type="file"
        :accept="[...IMAGE_MIME, ...VIDEO_MIME, ...IMAGE_EXT.map(e => `.${e}`), ...VIDEO_EXT.map(e => `.${e}`)].join(',')"
        multiple
        class="sr-only"
        @change="
          addFiles(($event.target as HTMLInputElement).files!);
          ($event.target as HTMLInputElement).value = ''
        "
      />
    </div>

    <div class="min-h-6 pt-4" aria-live="polite">
      <p v-if="summary" class="text-xs text-text-muted">{{ summary }}</p>
    </div>

    <template v-if="items.length">
      <ul class="mt-6 border-t border-border-muted">
        <li
          v-for="item in items"
          :key="item.id"
          class="grid gap-5 border-b border-border-muted py-6 sm:grid-cols-[8rem_1fr]"
        >
          <div class="relative aspect-square overflow-hidden bg-white/5">
            <!-- Video previews locally without any upload; HEIC cannot be
                 decoded by Chrome or Firefox, so it gets a label instead of a
                 broken image icon. -->
            <video
              v-if="item.kind === 'video' && item.previewUrl"
              :src="item.previewUrl"
              muted
              playsinline
              preload="metadata"
              class="h-full w-full object-cover"
            />
            <img
              v-else-if="item.previewUrl"
              :src="item.previewUrl"
              alt=""
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center"
            >
              <span class="eyebrow !text-accent">{{ extensionOf(item.file.name) || 'file' }}</span>
              <span class="text-[10px] leading-tight text-text-muted">
                preview unavailable
              </span>
            </div>
            <div
              v-if="item.status === 'uploading' || item.status === 'done'"
              class="absolute inset-x-0 bottom-0 h-1 bg-white/20"
            >
              <div
                class="h-full bg-accent transition-[width] duration-fast"
                :style="{ width: `${item.progress}%` }"
              />
            </div>
          </div>

          <div class="grid gap-3">
            <div class="flex items-start justify-between gap-4">
              <p class="truncate text-xs text-text-muted">
                {{ item.file.name }} · {{ formatBytes(item.file.size) }}
              </p>
              <span v-if="item.status === 'done'" class="eyebrow shrink-0 !text-accent">
                Uploaded
              </span>
              <span
                v-else-if="item.status === 'uploading'"
                class="eyebrow shrink-0 tabular-nums"
              >
                {{ item.progress }}%
              </span>
              <button
                v-else
                type="button"
                class="eyebrow shrink-0 hover:text-primary transition-colors duration-fast"
                @click="remove(item.id)"
              >
                Remove
              </button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="eyebrow">Title</span>
                <input
                  v-model="item.title"
                  type="text"
                  :disabled="item.status === 'done'"
                  class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent disabled:opacity-50"
                />
              </label>
              <label class="block">
                <span class="eyebrow">Client</span>
                <input
                  v-model="item.client"
                  type="text"
                  :disabled="item.status === 'done'"
                  class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent disabled:opacity-50"
                />
              </label>
              <label class="block">
                <span class="eyebrow">Year</span>
                <input
                  v-model="item.year"
                  type="text"
                  inputmode="numeric"
                  :disabled="item.status === 'done'"
                  class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent disabled:opacity-50"
                />
              </label>
              <label class="block">
                <span class="eyebrow">Categories (comma separated)</span>
                <input
                  v-model="item.tags"
                  type="text"
                  :disabled="item.status === 'done'"
                  class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent disabled:opacity-50"
                />
              </label>
              <label class="block sm:col-span-2">
                <span class="eyebrow">Alt text (describes the image for screen readers)</span>
                <input
                  v-model="item.alt"
                  type="text"
                  :disabled="item.status === 'done'"
                  class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent disabled:opacity-50"
                />
              </label>
            </div>

            <p v-if="item.error" class="text-xs text-text-muted">{{ item.error }}</p>
            <!-- Say when a photo was downscaled, rather than silently
                 uploading something different from what was chosen. -->
            <p v-else-if="item.note" class="text-xs text-text-muted">{{ item.note }}</p>
          </div>
        </li>
      </ul>

      <div class="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          :disabled="running || pending === 0"
          class="eyebrow border border-accent bg-accent px-8 py-4 !text-text-inverse transition-all duration-normal hover:bg-transparent hover:!text-accent disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-transparent disabled:!text-text-muted"
          @click="uploadAll"
        >
          {{ running ? 'Uploading' : pending ? `Upload ${pending}` : 'Upload' }}
        </button>
        <button
          type="button"
          :disabled="running"
          class="eyebrow hover:text-primary transition-colors duration-fast disabled:opacity-40"
          @click="clearAll"
        >
          Clear
        </button>
      </div>
    </template>
  </section>
</template>
