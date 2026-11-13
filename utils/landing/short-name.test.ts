import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The owner's rule (2026-11-13): the site and its emails say "Jan Kevin",
 * never the full name. This walks everything a visitor or an email recipient
 * can see and fails on the surname.
 */
const root = resolve(__dirname, '../..')
const SCANNED = ['app.vue', 'nuxt.config.ts', 'components', 'pages', 'layouts', 'utils/landing', 'server/utils/contact-email.ts', 'server/api', 'public/site.webmanifest']

function files(path: string): string[] {
  const s = statSync(path, { throwIfNoEntry: false })
  if (!s) return []
  if (s.isFile()) return [path]
  return readdirSync(path).flatMap((name) => files(join(path, name)))
}

describe('short name', () => {
  it('never shows the surname anywhere a visitor or recipient can see it', () => {
    const hits = SCANNED.flatMap((p) => files(join(root, p)))
      .filter((f) => /\.(vue|ts|webmanifest)$/.test(f) && !f.endsWith('short-name.test.ts'))
      .filter((f) => /cadampog/i.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f))
    expect(hits).toEqual([])
  })
})
