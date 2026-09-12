<script setup lang="ts">
import { computed } from 'vue'
import type { PublicApiIconName } from './Icon.vue'
import type { ApiEntry } from '~/utils/public-api/types'

/**
 * The three facts that decide whether an API is usable from where you are
 * standing: what it wants from you, whether the browser will let you call it,
 * and whether the connection is encrypted.
 *
 * Shared by the card, the row and the detail panel rather than written three
 * times, because these are the page's vocabulary - if "Unknown CORS" reads as
 * a warning in one place and as neutral in another, the reader has to learn
 * it twice.
 *
 * Tone is the encoding, and it is deliberately not a traffic light. `good` is
 * the accent, `warn` is muted, `bad` is muted with a rule through it. Nothing
 * here is an error - an API that needs a key is not broken, it is just not
 * something you can call in the next thirty seconds.
 */
const props = withDefaults(defineProps<{ entry: ApiEntry; compact?: boolean }>(), { compact: false })

interface Badge {
  key: string
  icon: PublicApiIconName
  label: string
  /** Read out to assistive tech, where the icon and the tone say nothing. */
  title: string
  tone: 'good' | 'warn' | 'bad'
}

const badges = computed<Badge[]>(() => {
  const entry = props.entry

  const auth: Badge =
    entry.auth === 'None'
      ? { key: 'auth', icon: 'open', label: 'No key', title: 'No credentials needed', tone: 'good' }
      : entry.auth === 'Other'
        ? {
            key: 'auth',
            icon: 'key',
            label: props.compact ? 'Header' : (entry.authLabel ?? 'Header'),
            title: `Authenticates with ${entry.authLabel ?? 'a custom header'}`,
            tone: 'warn',
          }
        : {
            key: 'auth',
            icon: 'key',
            label: entry.auth,
            title: `Needs ${entry.auth === 'OAuth' ? 'an OAuth flow' : 'an API key'}`,
            tone: 'warn',
          }

  const cors: Badge =
    entry.cors === 'Yes'
      ? { key: 'cors', icon: 'globe', label: 'CORS', title: 'CORS confirmed - callable from a page', tone: 'good' }
      : entry.cors === 'No'
        ? { key: 'cors', icon: 'globe', label: 'No CORS', title: 'CORS refused - needs a server or proxy', tone: 'bad' }
        : { key: 'cors', icon: 'globe', label: 'CORS?', title: 'CORS unverified upstream', tone: 'warn' }

  const https: Badge = entry.https
    ? { key: 'https', icon: 'lock', label: 'HTTPS', title: 'Served over HTTPS', tone: 'good' }
    : { key: 'https', icon: 'lock', label: 'HTTP', title: 'No HTTPS - do not send anything private', tone: 'bad' }

  return [auth, cors, https]
})
</script>

<template>
  <ul class="pa-badges" :class="{ 'pa-badges--compact': props.compact }">
    <li v-for="badge in badges" :key="badge.key" class="pa-badge" :data-tone="badge.tone" :title="badge.title">
      <PublicApiIcon :name="badge.icon" :size="props.compact ? 12 : 13" />
      <span>{{ badge.label }}</span>
      <span class="pa-sr">. {{ badge.title }}</span>
    </li>
  </ul>
</template>
