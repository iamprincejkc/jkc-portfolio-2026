import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * In a `<style scoped>` block, Vue compiles `:global(A) .b { ... }` to plain
 * `A { ... }`: everything after the `:global()` is dropped. On the landing
 * page that turned "hide the moon icon in dark mode" into
 * `html.lp-root[data-theme='dark'] { display: none }`, a blank page for every
 * dark-mode visitor. A rule that depends on an ancestor outside the component
 * belongs in an unscoped `<style>` block instead.
 */
const root = resolve(__dirname, '../..')
const dirs = ['components', 'pages', 'layouts', 'app.vue'].map((d) => join(root, d))

function vueFiles(path: string): string[] {
  if (!statSync(path, { throwIfNoEntry: false })) return []
  if (statSync(path).isFile()) return path.endsWith('.vue') ? [path] : []
  return readdirSync(path).flatMap((name) => vueFiles(join(path, name)))
}

describe('scoped styles', () => {
  it('never follow :global(...) with more selector, which Vue silently drops', () => {
    const offenders: string[] = []
    for (const file of dirs.flatMap(vueFiles)) {
      const source = readFileSync(file, 'utf8')
      for (const block of source.matchAll(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/g)) {
        for (const m of block[1].matchAll(/:global\([^)]*\)\s*[^\s{,]/g)) {
          offenders.push(`${relative(root, file)}: ${m[0]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
