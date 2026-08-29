<script setup lang="ts">
import { ref, useId, watch } from 'vue'

/**
 * A colour well paired with an editable hex field.
 *
 * The text field keeps its own draft while it is being typed into: committing
 * on every keystroke would fight the user at `#ab`, which parses as nothing.
 * Only a complete six-digit value is pushed upward.
 */
const props = defineProps<{ label: string; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const draft = ref(props.modelValue.toUpperCase())
watch(
  () => props.modelValue,
  (value) => {
    draft.value = value.toUpperCase()
  },
)

const COMPLETE = /^#?[0-9a-f]{6}$/i

function commit(raw: string) {
  draft.value = raw
  if (!COMPLETE.test(raw.trim())) return
  const clean = raw.trim().replace('#', '')
  emit('update:modelValue', `#${clean.toLowerCase()}`)
}

/** Restore the last valid value if the user leaves something half-typed. */
function settle() {
  draft.value = props.modelValue.toUpperCase()
}

// Stable across server and client render, unlike a random string.
const id = useId()
</script>

<template>
  <div>
    <label class="qr-label" :for="id">{{ props.label }}</label>
    <div class="qr-swatch">
      <input
        :id="id"
        class="qr-swatch__chip"
        type="color"
        :value="props.modelValue"
        :aria-label="`${props.label} colour picker`"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <input
        class="qr-swatch__hex"
        type="text"
        spellcheck="false"
        autocomplete="off"
        maxlength="7"
        :value="draft"
        :aria-label="`${props.label} hex value`"
        @input="commit(($event.target as HTMLInputElement).value)"
        @blur="settle"
      />
    </div>
  </div>
</template>
