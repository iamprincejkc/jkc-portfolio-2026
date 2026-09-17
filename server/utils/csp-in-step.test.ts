import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The content security policy is written twice - netlify.toml for what the CDN
 * serves, server/middleware/security-headers.ts for what the function serves -
 * and both comments say the two must change together. This makes that a check
 * instead of a hope.
 *
 * It also pins the Nostr relays Evently's shared worlds connect to: a relay the
 * page is told to use but the policy does not allow fails silently in the
 * browser, and "walk together" simply never finds anyone.
 */

const root = resolve(__dirname, '../..')

function tomlPolicy(): string {
  const toml = readFileSync(resolve(root, 'netlify.toml'), 'utf8')
  const match = /Content-Security-Policy = "([^"]+)"/.exec(toml)
  if (!match) throw new Error('No Content-Security-Policy in netlify.toml')
  return match[1]!
}

function middlewarePolicy(): string {
  const source = readFileSync(resolve(root, 'server/middleware/security-headers.ts'), 'utf8')
  const block = /const CSP = \[([\s\S]*?)\]\.join\('; '\)/.exec(source)
  if (!block) throw new Error('No CSP array in security-headers.ts')
  const directives = [...block[1]!.matchAll(/^\s*(["'])(.*)\1,\s*$/gm)].map((m) => m[2]!)
  return directives.join('; ')
}

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))

describe('content security policy', () => {
  it('is identical in netlify.toml and the middleware', () => {
    expect(middlewarePolicy()).toBe(tomlPolicy())
  })

  it('allows exactly the relays the deployed Evently bundle connects to', () => {
    // The built bundle, not Evently's source: it is what this site actually serves.
    const assets = resolve(root, 'public/evently/assets')
    const bundle = readdirSync(assets)
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(resolve(assets, f), 'utf8'))
      .join('\n')
    const relays = [...new Set(bundle.match(/wss:\/\/[a-z0-9.-]+/g) ?? [])]
    expect(relays.length).toBeGreaterThan(0)
    const connect = directive(tomlPolicy(), 'connect-src') ?? ''
    for (const relay of relays) expect(connect.split(' ')).toContain(relay)
    const allowedSockets = connect.split(' ').filter((s) => s.startsWith('wss://'))
    expect(allowedSockets.sort()).toEqual([...relays].sort())
  })
})
