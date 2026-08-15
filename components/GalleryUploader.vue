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

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
const MAX_BYTES = 25 * 1024 * 1024
const CONCURRENCY = 3

type Status = 'queued' | 'uploading' | 'done' | 'error'

type Item = {
  id: string
  file: File
  previewUrl: string
  title: string
  client: string
  year: string
  alt: string
  tags: string
  progress: number
  status: Status
  error?: string
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
    if (!ACCEPTED.includes(file.type)) {
      rejected.push(`${file.name} (unsupported type)`)
      continue
    }
    if (file.size > MAX_BYTES) {
      rejected.push(`${file.name} (over ${formatBytes(MAX_BYTES)})`)
      continue
    }
    accepted.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
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
  if (target) URL.revokeObjectURL(target.previewUrl)
  items.value = items.value.filter((item) => item.id !== id)
}

function clearAll() {
  for (const item of items.value) URL.revokeObjectURL(item.previewUrl)
  items.value = []
  summary.value = null
}

// Object URLs are a genuine leak across a long admin session.
onBeforeUnmount(() => {
  for (const item of items.value) URL.revokeObjectURL(item.previewUrl)
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

  const color = await dominantColor(item.file)

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
      },
    })
  } catch (caught: any) {
    item.status = 'error'
    item.error = caught?.data?.statusMessage || 'Could not sign upload.'
    return false
  }

  const form = new FormData()
  form.append('file', item.file)
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
        JPEG, PNG, WebP, AVIF or GIF · up to {{ formatBytes(MAX_BYTES) }} each
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
        :accept="ACCEPTED.join(',')"
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
            <img :src="item.previewUrl" alt="" class="h-full w-full object-cover" />
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
