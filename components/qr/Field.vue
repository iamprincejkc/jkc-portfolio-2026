<script setup lang="ts">
/** A label bound to its control, plus optional helper text under it. */
const props = defineProps<{ label: string; hint?: string; for?: string }>()
</script>

<template>
  <div>
    <label class="qr-label" :for="props.for">{{ props.label }}</label>
    <slot />
    <p v-if="props.hint" class="qr-hint">{{ props.hint }}</p>
  </div>
</template>
