import { defineConfig } from 'vitest/config'

/**
 * Unit tests for the server-side logic that guards the site: session tokens,
 * the PIN rate limiter, Cloudinary upload signing, and the webhook signature.
 *
 * These are deliberately plain Node tests with no Nuxt runtime. Every module
 * under test is a pure function that takes its inputs as arguments, so none of
 * them need `useRuntimeConfig` or a request context.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
  },
})
