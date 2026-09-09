<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '~/utils/n8n/markdown'
import type { WorkflowNote } from '~/utils/n8n/types'

/**
 * The author's own documentation, as they pinned it to the canvas.
 *
 * Ordered top-down and then left-to-right by canvas position rather than by
 * file order, because that is the order they wrote it to be read in - a note
 * introducing the workflow sits above the one explaining its third step, and
 * the JSON preserves neither.
 *
 * The markup comes from `renderMarkdown`, which escapes the whole note before
 * it emits a single tag. That is what makes `v-html` acceptable here: there is
 * no path by which a note's text becomes markup.
 */
const props = defineProps<{ notes: WorkflowNote[] }>()

const ordered = computed(() =>
  [...props.notes]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((note, index) => ({ key: `${note.x},${note.y},${index}`, html: renderMarkdown(note.content) })),
)
</script>

<template>
  <div class="n8-scroll">
    <div v-if="ordered.length" class="n8-notes">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <article v-for="note in ordered" :key="note.key" class="n8-sticky" v-html="note.html" />
    </div>

    <div v-else class="n8-note">
      <p class="n8-note__title">No notes on this one</p>
      <p>Its author did not pin any sticky notes to the canvas. The diagram and the steps are all there is.</p>
    </div>
  </div>
</template>
