import { describe, expect, it } from 'vitest'
import { escapeHtml, renderMarkdown } from './markdown'

describe('escapeHtml', () => {
  it('neutralises every character that can open a tag or an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;')
  })
})

describe('renderMarkdown', () => {
  it('renders the subset the notes actually use', () => {
    expect(renderMarkdown('## Setup')).toBe('<h5>Setup</h5>')
    expect(renderMarkdown('Plain text.')).toBe('<p>Plain text.</p>')
    expect(renderMarkdown('**bold** and *italic* and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>',
    )
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>')
    expect(renderMarkdown('---')).toBe('<hr>')
  })

  it('starts headings at h4 so a note cannot outrank the dialog title', () => {
    expect(renderMarkdown('# Title')).toBe('<h4>Title</h4>')
    expect(renderMarkdown('###### Deep')).toBe('<h6>Deep</h6>')
  })

  it('separates paragraphs on blank lines and keeps single breaks', () => {
    expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one<br>two</p><p>three</p>')
  })

  it('closes a list when prose resumes', () => {
    expect(renderMarkdown('- a\n\ntext')).toBe('<ul><li>a</li></ul><p>text</p>')
    expect(renderMarkdown('- a\ntext')).toBe('<ul><li>a</li></ul><p>text</p>')
  })

  it('renders fenced code verbatim and closes an unterminated fence', () => {
    expect(renderMarkdown('```\nconst a = 1 < 2\n```')).toBe('<pre><code>const a = 1 &lt; 2\n</code></pre>')
    expect(renderMarkdown('```js\nx')).toBe('<pre><code>x\n</code></pre>')
  })

  it('does not read emphasis inside inline code', () => {
    expect(renderMarkdown('`a * b * c`')).toBe('<p><code>a * b * c</code></p>')
  })

  /* ---- The part that matters: this is third-party text ---- */

  it('renders script tags as text, not as tags', () => {
    const html = renderMarkdown('<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('strips an event handler that arrives inside markdown', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('drops a link whose scheme is not http', () => {
    expect(renderMarkdown('[click](javascript:alert(1))')).toBe('<p>click</p>')
    expect(renderMarkdown('[click](data:text/html;base64,PHNjcmlwdD4=)')).toBe('<p>click</p>')
    expect(renderMarkdown('[docs](https://docs.n8n.io/)')).toBe(
      '<p><a href="https://docs.n8n.io/" target="_blank" rel="noopener nofollow ugc">docs</a></p>',
    )
  })

  it('cannot be tricked into an attribute by a quote in the link text', () => {
    const html = renderMarkdown('[a" onmouseover="alert(1)](https://x.dev)')
    expect(html).not.toContain('onmouseover="alert')
    expect(html).toContain('&quot;')
  })

  it('keeps a query string intact while still checking the scheme', () => {
    expect(renderMarkdown('[q](https://x.dev/a?b=1&c=2)')).toContain('href="https://x.dev/a?b=1&amp;c=2"')
  })

  it('shows an image as its alt text rather than loading a remote file', () => {
    expect(renderMarkdown('![a diagram](https://x.dev/a.png)')).toBe('<p><em>a diagram</em></p>')
  })

  it('survives empty and non-string input', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(undefined as unknown as string)).toBe('')
  })
})
