/**
 * The sticky-note renderer.
 *
 * Workflow authors write their documentation as markdown on sticky notes, so
 * the notes panel has to render markdown - but this is other people's text
 * from a public repository, which makes the security property the design
 * constraint rather than the feature list.
 *
 * So: escape first, parse second. Every character of the source is HTML-escaped
 * before a single tag is emitted, and the tags this then produces are the only
 * ones that can ever reach the DOM. A `<script>` in a note comes out as visible
 * text, because by the time any rule matches, its angle brackets are already
 * `&lt;`. Sanitising after generating - the usual order - is the arrangement
 * that has to be got exactly right; this one cannot go wrong.
 *
 * The subset is what actually appears in these notes: headings, bold, italic,
 * inline code, fenced code, links, lists and rules. Anything else stays as the
 * literal text the author typed, which for a note is a perfectly good outcome.
 * A markdown library would be a dependency, a bundle, and a sanitiser to audit.
 */

/** Link schemes allowed through. Everything else, `javascript:` included. */
const SAFE_LINK = /^https?:\/\/[^\s<>"']+$/i

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

/**
 * A link destination, allowing one level of balanced parentheses.
 *
 * Without the balancing, `[x](javascript:alert(1))` ends at the first `)` and
 * leaves a stray one in the output - and worse, the scheme check then runs
 * against a truncated URL that no longer looks dangerous. One level covers
 * both that and the Wikipedia-style URLs that are the honest reason to
 * support parentheses at all.
 */
const HREF = String.raw`([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)`

const IMAGE = new RegExp(String.raw`!\[([^\]]*)\]\(${HREF}\)`, 'g')
const LINK = new RegExp(String.raw`\[([^\]]*)\]\(${HREF}\)`, 'g')

/**
 * Placeholder delimiter for lifted code spans.
 *
 * A NUL byte, which `escapeHtml` neither produces nor removes, and which no
 * sticky note contains. Any that somehow arrives in the source is stripped
 * before the placeholders go in, so a note cannot forge one.
 */
const MARK = '\u0000'
const PLACEHOLDER = new RegExp(`${MARK}(\\d+)${MARK}`, 'g')

/** Inline rules, applied to already-escaped text. */
function inline(escaped: string): string {
  /*
   * Code spans come out first and go back in last. Replacing them in place
   * would leave their contents in the string for the emphasis rules to find,
   * and `a * b * c` inside backticks would come back with an <em> in it.
   */
  const codes: string[] = []
  const lifted = escaped
    .split(MARK)
    .join('')
    .replace(/`([^`\n]+)`/g, (_, code) => `${MARK}${codes.push(code) - 1}${MARK}`)

  const marked = lifted
    .replace(IMAGE, (match, alt) => (alt ? `<em>${alt}</em>` : match))
    .replace(LINK, (_match, label, href) => {
      // The href has been escaped, so `&` is `&amp;` - undo just that one
      // before testing the scheme, then leave it escaped in the attribute.
      const url = String(href).replace(/&amp;/g, '&')
      if (!SAFE_LINK.test(url)) return label
      return `<a href="${href}" target="_blank" rel="noopener nofollow ugc">${label || href}</a>`
    })
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')

  return marked.replace(PLACEHOLDER, (_, index) => `<code>${codes[Number(index)]}</code>`)
}

/**
 * Markdown to a small, fixed set of HTML tags.
 *
 * Block-level parsing is a single pass over the lines with one piece of state -
 * whether a list or a code fence is open - which is all this subset needs.
 */
export function renderMarkdown(markdown: string): string {
  const lines = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const out: string[] = []

  let list: 'ul' | 'ol' | null = null
  let fenced = false
  let paragraph: string[] = []

  const closeParagraph = () => {
    if (paragraph.length === 0) return
    out.push(`<p>${inline(escapeHtml(paragraph.join('\n')).replace(/\n/g, '<br>'))}</p>`)
    paragraph = []
  }

  const closeList = () => {
    if (!list) return
    out.push(`</${list}>`)
    list = null
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      closeParagraph()
      closeList()
      out.push(fenced ? '</code></pre>' : '<pre><code>')
      fenced = !fenced
      continue
    }

    if (fenced) {
      out.push(`${escapeHtml(line)}\n`)
      continue
    }

    if (!line.trim()) {
      closeParagraph()
      closeList()
      continue
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      closeParagraph()
      closeList()
      // Notes live inside a panel, so their headings start at h4 - promoting
      // them to h1 would put six competing document titles on one screen.
      const level = Math.min(6, 3 + heading[1].length)
      out.push(`<h${level}>${inline(escapeHtml(heading[2].trim()))}</h${level}>`)
      continue
    }

    if (/^\s{0,3}([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      closeParagraph()
      closeList()
      out.push('<hr>')
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      closeParagraph()
      const wanted = bullet ? 'ul' : 'ol'
      if (list !== wanted) {
        closeList()
        out.push(`<${wanted}>`)
        list = wanted
      }
      out.push(`<li>${inline(escapeHtml((bullet ?? numbered)![1]))}</li>`)
      continue
    }

    closeList()
    paragraph.push(line.trim())
  }

  closeParagraph()
  closeList()
  if (fenced) out.push('</code></pre>')

  return out.join('')
}
