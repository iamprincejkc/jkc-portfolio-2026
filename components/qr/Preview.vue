<script setup lang="ts">
const props = defineProps<{
  /** Serialised SVG, or empty while there is nothing to encode. */
  svg: string
  moduleCount: number
  ecc: string
  /** True while the code encodes the stand-in rather than the user's content. */
  placeholder?: boolean
}>()
</script>

<template>
  <div class="qr-stage">
    <!-- The code rests on its own pane of glass. -->
    <div v-if="props.svg" class="glass qr-slab">
      <!-- The renderer's own output, injected as markup.
           Nothing here comes from the network or from another user: the string
           is built by `sceneToSvg` from typed state, and every colour and text
           value it interpolates is XML-escaped on the way in. -->
      <div
        class="qr-slab__inner"
        role="img"
        :aria-label="
          props.placeholder
            ? 'Placeholder QR code, showing the current style'
            : 'Live preview of your QR code'
        "
        v-html="props.svg"
      />
    </div>

    <div v-else class="glass qr-slab qr-slab--empty">
      <div>
        <p class="font-display" style="font-size: 24px">Nothing to encode yet</p>
        <p class="qr-hint">
          A link, a network, an event or a contact. The code appears as you type.
        </p>
      </div>
    </div>

    <p v-if="props.svg" class="qr-meta">
      <span v-if="props.placeholder" class="qr-meta__badge">Placeholder</span>
      <span v-else>{{ props.moduleCount }} &times; {{ props.moduleCount }} modules</span>
      <span aria-hidden="true">&middot;</span>
      <span>error correction {{ props.ecc }}</span>
    </p>
  </div>
</template>
