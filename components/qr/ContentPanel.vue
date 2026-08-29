<script setup lang="ts">
import { computed } from 'vue'
import type { ContentMode, QrContent, WifiSecurity } from '~/utils/qr/payload'
import type { ErrorCorrection } from '~/utils/qr/matrix'
import { effectiveEcc, type QrStyle } from '~/utils/qr/render'

/*
 * `qrStyle` rather than `style`: Vue always routes `class` and `style` to
 * fallthrough attributes, so a prop by that name never receives its value.
 */
const props = defineProps<{ modelValue: QrContent; qrStyle: QrStyle }>()
const emit = defineEmits<{
  'update:modelValue': [value: QrContent]
  'update:qrStyle': [value: QrStyle]
}>()

const content = computed(() => props.modelValue)

/** Every edit replaces the object, so the page's watcher sees one change. */
function patch(part: Partial<QrContent>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

function setMode(mode: string) {
  patch({ mode: mode as ContentMode })
}

function setUrl(text: string) {
  patch({ url: { text } })
}

function setWifi(part: Partial<QrContent['wifi']>) {
  patch({ wifi: { ...props.modelValue.wifi, ...part } })
}

function setEvent(part: Partial<QrContent['event']>) {
  patch({ event: { ...props.modelValue.event, ...part } })
}

function setContact(part: Partial<QrContent['contact']>) {
  patch({ contact: { ...props.modelValue.contact, ...part } })
}

const MODES = [
  { value: 'url', label: 'URL / Text' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'event', label: 'Event' },
  { value: 'contact', label: 'Contact' },
] as const

/**
 * Error correction, the one setting that is neither content nor decoration.
 * It lives here because it is a property of the data: how much of the code can
 * be scuffed, torn or covered and still read.
 */
/*
 * A segmented control rather than a `<select>`. Three short, mutually
 * exclusive options is exactly what this control is for, and the page already
 * speaks in segmented pills - two lone native dropdowns were the only controls
 * whose appearance the browser, not this design, decided.
 */
const SECURITY = [
  { value: 'WPA', label: 'WPA' },
  { value: 'WEP', label: 'WEP' },
  { value: 'nopass', label: 'Open' },
] as const

const ECC = [
  { value: 'L', label: 'L' },
  { value: 'M', label: 'M' },
  { value: 'Q', label: 'Q' },
  { value: 'H', label: 'H' },
] as const

const ECC_BLURB: Record<ErrorCorrection, string> = {
  L: 'Recovers 7% damage. Smallest code, for clean digital use.',
  M: 'Recovers 15%. The usual choice.',
  Q: 'Recovers 25%. Good for print and for codes carrying a logo.',
  H: 'Recovers 30%. Largest code, survives the most abuse.',
}

/** A logo raises the floor, so show what is actually in effect. */
const applied = computed(() => effectiveEcc(props.qrStyle))

function setEcc(value: string) {
  emit('update:qrStyle', { ...props.qrStyle, ecc: value as ErrorCorrection })
}
</script>

<template>
  <div class="qr-stack">
    <QrSegmented
      label="What the code points at"
      :model-value="content.mode"
      :options="MODES"
      @update:model-value="setMode"
    />

    <template v-if="content.mode === 'url'">
      <QrField
        label="Link or text"
        hint="A bare domain gets https:// added. Anything else is encoded exactly as typed."
        for="qr-url"
      >
        <textarea
          id="qr-url"
          class="qr-textarea"
          rows="3"
          spellcheck="false"
          placeholder="iamjkc.space"
          :value="content.url.text"
          @input="setUrl(($event.target as HTMLTextAreaElement).value)"
        />
      </QrField>
    </template>

    <template v-else-if="content.mode === 'wifi'">
      <QrField label="Network name" for="qr-ssid">
        <input
          id="qr-ssid"
          class="qr-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :value="content.wifi.ssid"
          @input="setWifi({ ssid: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <QrField
        v-if="content.wifi.security !== 'nopass'"
        label="Password"
        hint="Stays in this browser. It is encoded into the code you download and is never sent anywhere, nor put in the shareable link."
        for="qr-wifi-pass"
      >
        <input
          id="qr-wifi-pass"
          class="qr-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :value="content.wifi.password"
          @input="setWifi({ password: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <QrSegmented
        label="Security"
        :model-value="content.wifi.security"
        :options="SECURITY"
        @update:model-value="setWifi({ security: $event as WifiSecurity })"
      />

      <label class="qr-check">
        <input
          type="checkbox"
          :checked="content.wifi.hidden"
          @change="setWifi({ hidden: ($event.target as HTMLInputElement).checked })"
        />
        Hidden network
      </label>
    </template>

    <template v-else-if="content.mode === 'event'">
      <QrField label="Title" for="qr-event-title">
        <input
          id="qr-event-title"
          class="qr-input"
          type="text"
          :value="content.event.title"
          @input="setEvent({ title: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <QrField label="Location" for="qr-event-loc">
        <input
          id="qr-event-loc"
          class="qr-input"
          type="text"
          :value="content.event.location"
          @input="setEvent({ location: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <div class="qr-grid-2">
        <QrField label="Starts" for="qr-event-start">
          <input
            id="qr-event-start"
            class="qr-input"
            type="datetime-local"
            :value="content.event.start"
            @input="setEvent({ start: ($event.target as HTMLInputElement).value })"
          />
        </QrField>
        <QrField label="Ends" for="qr-event-end">
          <input
            id="qr-event-end"
            class="qr-input"
            type="datetime-local"
            :value="content.event.end"
            @input="setEvent({ end: ($event.target as HTMLInputElement).value })"
          />
        </QrField>
      </div>

      <QrField
        label="Notes"
        hint="Times are encoded without a timezone, so the event lands at the same wall-clock time wherever it is scanned."
        for="qr-event-desc"
      >
        <textarea
          id="qr-event-desc"
          class="qr-textarea"
          rows="3"
          :value="content.event.description"
          @input="setEvent({ description: ($event.target as HTMLTextAreaElement).value })"
        />
      </QrField>
    </template>

    <template v-else>
      <div class="qr-grid-2">
        <QrField label="First name" for="qr-c-first">
          <input
            id="qr-c-first"
            class="qr-input"
            type="text"
            autocomplete="given-name"
            :value="content.contact.firstName"
            @input="setContact({ firstName: ($event.target as HTMLInputElement).value })"
          />
        </QrField>
        <QrField label="Last name" for="qr-c-last">
          <input
            id="qr-c-last"
            class="qr-input"
            type="text"
            autocomplete="family-name"
            :value="content.contact.lastName"
            @input="setContact({ lastName: ($event.target as HTMLInputElement).value })"
          />
        </QrField>
      </div>

      <div class="qr-grid-2">
        <QrField label="Organisation" for="qr-c-org">
          <input
            id="qr-c-org"
            class="qr-input"
            type="text"
            autocomplete="organization"
            :value="content.contact.organization"
            @input="setContact({ organization: ($event.target as HTMLInputElement).value })"
          />
        </QrField>
        <QrField label="Job title" for="qr-c-job">
          <input
            id="qr-c-job"
            class="qr-input"
            type="text"
            autocomplete="organization-title"
            :value="content.contact.jobTitle"
            @input="setContact({ jobTitle: ($event.target as HTMLInputElement).value })"
          />
        </QrField>
      </div>

      <QrField label="Phone" for="qr-c-phone">
        <input
          id="qr-c-phone"
          class="qr-input"
          type="tel"
          autocomplete="tel"
          :value="content.contact.phone"
          @input="setContact({ phone: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <QrField label="Email" for="qr-c-email">
        <input
          id="qr-c-email"
          class="qr-input"
          type="email"
          autocomplete="email"
          spellcheck="false"
          :value="content.contact.email"
          @input="setContact({ email: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <QrField label="Website" for="qr-c-web">
        <input
          id="qr-c-web"
          class="qr-input"
          type="text"
          autocomplete="url"
          spellcheck="false"
          :value="content.contact.website"
          @input="setContact({ website: ($event.target as HTMLInputElement).value })"
        />
      </QrField>

      <QrField
        label="Address"
        hint="Encoded as a vCard, which iOS and Android both offer to save straight into contacts."
        for="qr-c-addr"
      >
        <textarea
          id="qr-c-addr"
          class="qr-textarea"
          rows="2"
          :value="content.contact.address"
          @input="setContact({ address: ($event.target as HTMLTextAreaElement).value })"
        />
      </QrField>
    </template>

    <hr class="qr-rule" />

    <div>
      <QrSegmented
        label="Error correction"
        :model-value="props.qrStyle.ecc"
        :options="ECC"
        @update:model-value="setEcc"
      />
      <p class="qr-hint">{{ ECC_BLURB[props.qrStyle.ecc] }}</p>
      <p v-if="applied !== props.qrStyle.ecc" class="qr-notice qr-notice--info" style="margin-top: 0.5rem">
        <QrIcon name="info" />
        <span>Raised to {{ applied }} while a logo is covering part of the code.</span>
      </p>
    </div>
  </div>
</template>
