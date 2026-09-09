<script setup lang="ts">
import { computed } from 'vue'

/**
 * The importable workflow, pretty-printed.
 *
 * Rendered as one `<pre>` rather than a syntax-highlighted tree: the point of
 * this tab is that what you see is exactly what n8n receives when you paste
 * it, and a highlighter is a chance for that to stop being true.
 *
 * Large workflows run to tens of thousands of lines. `<pre>` is a single text
 * node, so the browser handles that without help - it is a DOM node per line
 * that would not.
 */
const props = defineProps<{ workflow: unknown }>()

const text = computed(() => JSON.stringify(props.workflow, null, 2))
</script>

<template>
  <div class="n8-scroll">
    <pre class="n8-code">{{ text }}</pre>
  </div>
</template>
