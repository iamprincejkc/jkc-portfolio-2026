import { describe, expect, it } from 'vitest'
import { cleanText, hostOf, parseReadme, slugify, summarise } from './parse'

/**
 * A miniature of the upstream README, carrying every shape the real one has:
 * a sponsor table before the directory that must not be read as data, an
 * index of links, two real categories, a repeated name inside one of them,
 * the "Back to Index" line that ends every section, and a `##` heading that
 * closes the last table.
 */
const README = `
# Try Public APIs for free

## APILayer APIs
| API | Description | Call this API |
|:---|:---|:---|
| [IPstack](https://ipstack.com/) | Locate visitors by IP | [Run](https://postman.com/x) |

### APIs Covered Under APILayer Suite!

- [IPstack](https://apilayer.com/products/ipstack)

## Index

* [Animals](#animals)
* [Books](#books)

### Animals
API | Description | Auth | HTTPS | CORS
|:---|:---|:---|:---|:---|
| [Cat Facts](https://alexwohlbruck.github.io/cat-facts/) | Daily cat facts | No | Yes | No | |
| [Cat Facts](https://catfact.ninja/) | Random cat facts | No | Yes | Yes |
| [Cats](https://docs.thecatapi.com/) | Pictures of cats from Tumblr | \`apiKey\` | Yes | No |
| [IUCN](http://apiv3.iucnredlist.org/api/v3/docs) | IUCN Red List of Threatened Species. | \`apiKey\` | No | No |

**[⬆ Back to Index](#index)**

### Books
API | Description | Auth | HTTPS | CORS
|:---|:---|:---|:---|:---|
| [Google Books](https://developers.google.com/books/) | Search [books](https://books.google.com) and \`shelves\` | \`OAuth\` | Yes | Yes |
| [Penguin](https://www.penguinrandomhouse.biz/webservices/rest/) | Publisher catalogue | No | Yes | Unknown |
| [Mashape](https://example.org/docs) | Odd header auth | \`X-Mashape-Key\` | Yes | Yes |

**[⬆ Back to Index](#index)**

## License

MIT
`

describe('parseReadme', () => {
  const result = parseReadme(README)

  it('reads every directory row and nothing else', () => {
    expect(result.skipped).toEqual([])
    expect(result.entries).toHaveLength(7)
  })

  it('ignores tables that are not the directory', () => {
    // The sponsor table's header has no Auth/HTTPS/CORS columns, so the
    // section never arms and IPstack never becomes an entry.
    expect(result.entries.map((entry) => entry.name)).not.toContain('IPstack')
  })

  it('takes the category from the heading above the table', () => {
    expect(result.entries.filter((entry) => entry.category === 'Animals')).toHaveLength(4)
    expect(result.entries.filter((entry) => entry.category === 'Books')).toHaveLength(3)
  })

  it('stops at a `##` heading', () => {
    expect(result.entries.map((entry) => entry.category)).not.toContain('License')
  })

  it('collapses the auth cell into a bucket, keeping the odd ones labelled', () => {
    const byName = new Map(result.entries.map((entry) => [entry.name, entry]))
    expect(byName.get('Cats')?.auth).toBe('API key')
    expect(byName.get('Google Books')?.auth).toBe('OAuth')
    expect(byName.get('Penguin')?.auth).toBe('None')
    expect(byName.get('Mashape')?.auth).toBe('Other')
    expect(byName.get('Mashape')?.authLabel).toBe('X-Mashape-Key')
  })

  it('keeps CORS three-valued', () => {
    const cors = result.entries.map((entry) => entry.cors)
    expect(cors).toContain('Yes')
    expect(cors).toContain('No')
    expect(cors).toContain('Unknown')
  })

  it('reads HTTPS from the cell rather than from the URL', () => {
    const iucn = result.entries.find((entry) => entry.name === 'IUCN')
    expect(iucn?.https).toBe(false)
    expect(iucn?.url.startsWith('http://')).toBe(true)
  })

  it('marks an entry browser-ready only when all three hold', () => {
    const ready = result.entries.filter((entry) => entry.ready).map((entry) => entry.name)
    // Only the no-auth, HTTPS, CORS-confirmed one qualifies. `Penguin` has no
    // auth and HTTPS but unverified CORS, which is not the same as yes.
    expect(ready).toEqual(['Cat Facts'])
  })

  it('gives a repeated name inside one category its own id', () => {
    const ids = result.entries.map((entry) => entry.id)
    expect(ids).toContain('animals-cat-facts')
    expect(ids).toContain('animals-cat-facts-2')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tolerates a row with a trailing empty cell', () => {
    // The first Cat Facts row ends `| No | |` upstream.
    expect(result.entries[0]).toMatchObject({ name: 'Cat Facts', cors: 'No' })
  })

  it('strips markdown out of a description', () => {
    const books = result.entries.find((entry) => entry.name === 'Google Books')
    expect(books?.description).toBe('Search books and shelves')
  })

  it('derives the host without `www.`', () => {
    const penguin = result.entries.find((entry) => entry.name === 'Penguin')
    expect(penguin?.host).toBe('penguinrandomhouse.biz')
  })
})

describe('cleanText', () => {
  it('drops a trailing full stop but not an internal one', () => {
    expect(cleanText('IUCN Red List of Threatened Species.')).toBe('IUCN Red List of Threatened Species')
    expect(cleanText('Version 2.0 of the API')).toBe('Version 2.0 of the API')
  })

  it('collapses whitespace and unescapes pipes', () => {
    expect(cleanText('  a \\| b   c ')).toBe('a | b c')
  })
})

describe('slugify', () => {
  it('is stable, lowercase and hyphenated', () => {
    expect(slugify('Art & Design')).toBe('art-design')
    expect(slugify('  Open Data  ')).toBe('open-data')
  })

  it('folds accents rather than dropping the word', () => {
    expect(slugify('Café')).toBe('cafe')
  })

  it('never returns an empty id', () => {
    expect(slugify('!!!')).toBe('api')
  })
})

describe('hostOf', () => {
  it('returns an empty host rather than throwing on a bad URL', () => {
    expect(hostOf('not a url')).toBe('')
  })
})

describe('summarise', () => {
  it('counts totals and ready per category, alphabetically', () => {
    const stats = summarise(parseReadme(README).entries)
    expect(stats.map((stat) => stat.name)).toEqual(['Animals', 'Books'])
    expect(stats[0]).toEqual({ name: 'Animals', total: 4, ready: 1 })
    expect(stats[1]).toEqual({ name: 'Books', total: 3, ready: 0 })
  })
})
