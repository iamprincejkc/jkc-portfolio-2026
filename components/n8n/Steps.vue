<script setup lang="ts">
import { KIND_COLOURS, KIND_LABELS } from '~/utils/n8n/palette'
import type { WorkflowDetail } from '~/utils/n8n/types'

/**
 * Every node as a list.
 *
 * This is the diagram's text equivalent - the same nodes, the same colours,
 * in the order the file stores them - which is what makes the diagram
 * legitimately labelled as an image. It is also the faster way to answer "does
 * this one use Postgres" on a workflow with sixty nodes in it, so it earns its
 * tab twice.
 */
const props = defineProps<{ detail: WorkflowDetail }>()
</script>

<template>
  <div class="n8-scroll">
    <ol class="n8-nodelist">
      <li
        v-for="(node, index) in props.detail.nodes"
        :key="`${node.name}-${index}`"
        class="n8-nodelist__item"
        :style="{ '--n8-node': KIND_COLOURS[node.kind] }"
      >
        <span class="n8-nodelist__swatch" :title="KIND_LABELS[node.kind]" />
        <span>{{ node.name }}</span>
        <span v-if="node.disabled" class="n8-tag">disabled</span>
        <code class="n8-nodelist__type">{{ node.label }}</code>
      </li>
    </ol>
  </div>
</template>
