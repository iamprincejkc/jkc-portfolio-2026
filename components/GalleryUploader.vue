<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

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
 *
 * The layout is built around not scrolling. Queued files are a thumbnail grid
 * rather than a stack of tall forms, the fields that are the same across a
 * batch are entered once at the top, and the action bar is pinned so it is
 * reachable without travelling past the queue to find it.
 */

const emit = defineEmits<{ uploaded: [] }>()

/*
 * HEIC is the default on iPhone, and browsers frequently report it with an
 * empty `file.type` - Chrome and Firefox cannot decode it, so they will not
 * name it either. Matching on MIME alone rejects exactly the photos most
 * likely to be uploaded, so extension is the fallback.
 */
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic', 'image/heif']
const VIDEO_MIME = ['video/mp4', 'video/quicktime', 'video/webm']
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'heic', 'heif']
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v']

/*
 * Cloudinary's own limits. It rejects oversized files only after the whole
 * upload has finished, so checking here saves a long wait ending in a
 * confusing error. Photos are downscaled before this check rather than
 * rejected; the cap is the backstop for what cannot be downscaled.
 */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

const CONCURRENCY = 3

type Kind = 'image' | 'video'
type Status = 'queued' | 'uploading' | 'done' | 'error'

type Item = {
  id: string
  file: File
  kind: Kind
  /** Empty when the browser cannot render a local preview (HEIC). */
  previewUrl: string
  title: string
  alt: string
  progress: number
  status: Status
  error?: string
  note?: string
}

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

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
  return !['heic', 'heif'].includes(ext) && !/hei[cf]/.test(file.type)
}

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

const input = ref<HTMLInputElement | null>(null)
const items = ref<Item[]>([])
const dragging = ref(false)
const running = ref(false)
const summary = ref<string | null>(null)
const expanded = ref<string | null>(null)

/*
 * Client, year and categories are almost always the same across one batch, so
 * they are entered once here instead of on every card. Editing one rewrites
 * every queued item - which is the point, and is stated in the UI.
 */
const batch = ref({ client: '', year: new Date().getFullYear().toString(), tags: '' })

const pending = computed(() => items.value.filter((i) => i.status !== 'done'))
const failed = computed(() => items.value.filter((i) => i.status === 'error'))
const done = computed(() => items.value.filter((i) => i.status === 'done'))

const totalBytes = computed(() =>
  pending.value.reduce((total, item) => total + item.file.size, 0),
)

function addFiles(files: FileList | File[]) {
  const accepted: Item[] = []
  const rejected: string[] = []

  for (const file of Array.from(files)) {
    const kind = kindOf(file)
    if (!kind) {
      rejected.push(`${file.name} (unsupported type)`)
      continue
    }
    // Video is checked now because nothing here can shrink it. Photos are
    // checked after downscaling instead.
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
      alt: '',
      progress: 0,
      status: 'queued',
    })
  }

  if (accepted.length) items.value = [...items.value, ...accepted]
  summary.value = rejected.length ? `Skipped: ${rejected.join(', ')}` : null
}

function remove(id: string) {
  const target = items.value.find((item) => item.id === id)
  if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
  items.value = items.value.filter((item) => item.id !== id)
  if (expanded.value === id) expanded.value = null
}

function clearAll() {
  for (const item of items.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  items.value = []
  summary.value = null
  expanded.value = null
}

function clearFinished() {
  for (const item of done.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  items.value = items.value.filter((item) => item.status !== 'done')
}

// Object URLs are a genuine leak across a long admin session.
onBeforeUnmount(() => {
  for (const item of items.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
})

// Clearing the queue should not strand the batch fields in a half-used state.
watch(items, (list) => {
  if (!list.length) expanded.value = null
})

async function uploadOne(item: Item): Promise<boolean> {
  item.status = 'uploading'
  item.progress = 0
  item.error = undefined

  const tags = batch.value.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)

  /*
   * Downscale before uploading. The gallery never serves wider than 2560px, so
   * a larger original is bytes nobody sees - and Cloudinary would reject it
   * anyway, only after the whole upload had finished.
   */
  let upload = item.file
  if (item.kind === 'image') {
    const prepared = await prepareImageForUpload(item.file)
    upload = prepared.file
    if (prepared.changed) {
      item.note = `${formatBytes(prepared.originalBytes)} → ${formatBytes(upload.size)}`
    }
  }

  if (item.kind === 'image' && upload.size > MAX_IMAGE_BYTES) {
    item.status = 'error'
    item.error = `Still ${formatBytes(upload.size)} after resizing; the limit is ${formatBytes(MAX_IMAGE_BYTES)}.`
    return false
  }

  const color = item.kind === 'image' && item.previewUrl ? await dominantColor(item.file) : ''

  let ticket: { apiKey: string; signature: string; uploadUrl: string; params: Record<string, string> }
  try {
    ticket = await $fetch('/api/gallery/admin/sign-upload', {
      method: 'POST',
      body: {
        title: item.title,
        client: batch.value.client,
        year: batch.value.year,
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
  const queue = items.value.filter((i) => i.status === 'queued' || i.status === 'error')
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
    <!--
      The dropzone is generous while the queue is empty and becomes a slim
      strip once there are files, so the queue itself does not start below the
      fold.
    -->
    <div
      class="rounded-sm border border-dashed transition-colors duration-fast"
      :class="[
        dragging ? 'border-accent bg-white/5' : 'border-border-muted',
        items.length ? 'px-4 py-4' : 'px-6 py-[clamp(2.5rem,7vw,4.5rem)]',
      ]"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="
        dragging = false;
        addFiles($event.dataTransfer!.files)
      "
    >
      <div v-if="!items.length" class="text-center">
        <p class="font-display text-2xl">Drop photos or video here</p>
        <p class="mt-3 text-xs text-text-muted">
          JPEG, PNG, HEIC, WebP, AVIF, GIF to {{ formatBytes(MAX_IMAGE_BYTES) }} ·
          MP4, MOV, WebM to {{ formatBytes(MAX_VIDEO_BYTES) }}
        </p>
        <button
          type="button"
          class="eyebrow mt-7 border border-accent px-6 py-3 !text-accent transition-colors duration-normal hover:bg-accent hover:!text-text-inverse"
          @click="input?.click()"
        >
          Choose files
        </button>
      </div>

      <div v-else class="flex items-center justify-between gap-4">
        <p class="text-xs text-text-muted">Drop more here, or</p>
        <button
          type="button"
          class="eyebrow border border-border-muted px-4 py-2 transition-colors duration-fast hover:border-accent hover:!text-accent"
          @click="input?.click()"
        >
          Add files
        </button>
      </div>

      <input
        ref="input"
        type="file"
        :accept="[...IMAGE_MIME, ...VIDEO_MIME, ...IMAGE_EXT.map((e) => `.${e}`), ...VIDEO_EXT.map((e) => `.${e}`)].join(',')"
        multiple
        class="sr-only"
        @change="
          addFiles(($event.target as HTMLInputElement).files!);
          ($event.target as HTMLInputElement).value = ''
        "
      />
    </div>

    <div aria-live="polite" class="min-h-5 pt-3">
      <p v-if="summary" class="text-xs text-text-muted">{{ summary }}</p>
    </div>

    <template v-if="items.length">
      <!--
        Client, year and categories are nearly always shared across a batch.
        Asking for them once removes three fields from every card.
      -->
      <div class="mt-4 grid gap-4 border-y border-border-muted py-5 sm:grid-cols-3">
        <label class="block">
          <span class="eyebrow">Client — all files</span>
          <input
            v-model="batch.client"
            type="text"
            class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent"
          />
        </label>
        <label class="block">
          <span class="eyebrow">Year — all files</span>
          <input
            v-model="batch.year"
            type="text"
            inputmode="numeric"
            class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent"
          />
        </label>
        <label class="block">
          <span class="eyebrow">Categories — all files</span>
          <input
            v-model="batch.tags"
            type="text"
            placeholder="comma separated"
            class="mt-2 w-full border-b border-border-muted bg-transparent pb-2 text-sm outline-none transition-colors duration-fast focus:border-accent placeholder:text-text-muted/40"
          />
        </label>
      </div>

      <!-- Thumbnail grid rather than a stack of tall forms. -->
      <ul class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <li v-for="item in items" :key="item.id" class="group">
          <div class="relative aspect-square overflow-hidden rounded-sm bg-white/5">
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
              class="flex h-full w-full flex-col items-center justify-center gap-1 text-center"
            >
              <span class="eyebrow !text-accent">{{ extensionOf(item.file.name) || 'file' }}</span>
              <span class="text-[10px] leading-tight text-text-muted">no preview</span>
            </div>

            <!-- Status sits on the thumbnail so a row needs no extra height. -->
            <div
              v-if="item.status === 'done'"
              class="absolute inset-0 flex items-center justify-center bg-bg/70"
            >
              <span class="eyebrow !text-accent">Uploaded</span>
            </div>
            <div
              v-else-if="item.status === 'error'"
              class="absolute inset-0 flex items-center justify-center bg-bg/80 p-2 text-center"
            >
              <span class="text-[10px] leading-snug text-text-muted">{{ item.error }}</span>
            </div>
            <div
              v-else-if="item.status === 'uploading'"
              class="absolute inset-x-0 bottom-0 h-1 bg-white/20"
            >
              <div
                class="h-full bg-accent transition-[width] duration-fast"
                :style="{ width: `${item.progress}%` }"
              />
            </div>

            <button
              v-if="item.status !== 'uploading' && item.status !== 'done'"
              type="button"
              class="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-bg/70 text-sm opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus:opacity-100"
              :aria-label="`Remove ${item.file.name}`"
              @click="remove(item.id)"
            >
              ×
            </button>
          </div>

          <!-- Title is the one field that genuinely differs per photo. -->
          <input
            v-model="item.title"
            type="text"
            :disabled="item.status === 'done'"
            :aria-label="`Title for ${item.file.name}`"
            class="mt-2 w-full border-b border-border-muted bg-transparent pb-1.5 text-xs outline-none transition-colors duration-fast focus:border-accent disabled:opacity-50"
          />

          <div class="mt-1.5 flex items-center justify-between gap-2">
            <span class="truncate text-[10px] text-text-muted">
              {{ item.note || formatBytes(item.file.size) }}
            </span>
            <button
              type="button"
              class="shrink-0 text-[10px] uppercase tracking-widest text-text-muted transition-colors duration-fast hover:text-accent"
              :aria-expanded="expanded === item.id"
              @click="expanded = expanded === item.id ? null : item.id"
            >
              {{ expanded === item.id ? 'Less' : 'Alt' }}
            </button>
          </div>

          <label v-if="expanded === item.id" class="mt-2 block">
            <span class="eyebrow">Alt text</span>
            <input
              v-model="item.alt"
              type="text"
              :placeholder="item.title"
              class="mt-1 w-full border-b border-border-muted bg-transparent pb-1.5 text-xs outline-none transition-colors duration-fast focus:border-accent placeholder:text-text-muted/40"
            />
          </label>
        </li>
      </ul>

      <!--
        Pinned so it is reachable without scrolling past the queue to find it -
        the single biggest cost of the previous layout.
      -->
      <div
        class="sticky bottom-0 z-30 -mx-6 mt-6 border-t border-border-muted bg-bg/90 px-6 py-4 backdrop-blur-xl lg:-mx-12 lg:px-12"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <p class="eyebrow">
            {{ pending.length }} ready<template v-if="totalBytes"> · {{ formatBytes(totalBytes) }}</template>
            <template v-if="done.length"> · {{ done.length }} done</template>
            <template v-if="failed.length"> · {{ failed.length }} failed</template>
          </p>

          <div class="flex items-center gap-4">
            <button
              v-if="done.length"
              type="button"
              class="eyebrow text-text-muted transition-colors duration-fast hover:text-primary"
              @click="clearFinished"
            >
              Clear done
            </button>
            <button
              type="button"
              :disabled="running"
              class="eyebrow text-text-muted transition-colors duration-fast hover:text-primary disabled:opacity-40"
              @click="clearAll"
            >
              Clear all
            </button>
            <button
              type="button"
              :disabled="running || !pending.length"
              class="eyebrow border border-accent bg-accent px-7 py-3.5 !text-text-inverse transition-all duration-normal hover:bg-transparent hover:!text-accent disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-transparent disabled:!text-text-muted"
              @click="uploadAll"
            >
              {{ running ? 'Uploading' : failed.length ? 'Retry & upload' : `Upload ${pending.length}` }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
