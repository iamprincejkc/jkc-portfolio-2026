import { defineConfig } from 'vitest/config'

/**
 * Unit tests for the pure logic on both sides of the app.
 *
 * `server/` covers what guards the site: session tokens, the PIN rate limiter,
 * Cloudinary upload signing, and the webhook signature.
 *
 * `utils/qr/` covers the QR generator's engine: payload encoding, SVG path
 * parsing, shape geometry, and the scene the exporters draw from.
 *
 * `utils/n8n/` covers the workflow library's: node-type naming, the catalog
 * derivation, search and its facet counts, the diagram's layout, the
 * escape-first markdown renderer, and the colour palette.
 *
 * Every module under test is a pure function that takes its inputs as
 * arguments, so none of them need a Nuxt runtime, `useRuntimeConfig`, or a
 * DOM.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'utils/**/*.test.ts'],
  },
})
