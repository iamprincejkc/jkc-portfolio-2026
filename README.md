# JKC Portfolio — Nuxt 3

A Nuxt 3 portfolio for Jan Kevin Cadampog, built with the same animation techniques as agency-style portfolios: GSAP ScrollTrigger, Lenis smooth scroll, and a pinned scroll-driven image-scale effect for the Selected Work section.

## Stack

- **Nuxt 3** (Vue 3) — file-based routing, SSR
- **Tailwind CSS** — utility styling with custom tokens
- **GSAP + ScrollTrigger** — scroll-driven animations
- **Lenis** — smooth scroll, synced with GSAP
- **@nuxt/image** — image optimization
- **Fontshare** — General Sans (body) + Melodrama (display), free for commercial use

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For production:

```bash
npm run build
npm run preview
```

## File map

```
jkc-portfolio/
├── nuxt.config.ts             ← head meta, fonts, modules
├── tailwind.config.js         ← design tokens (colors, type scale, spacing)
├── app.vue                    ← root shell (header + page + footer)
├── pages/
│   ├── index.vue              ← composes all sections
│   ├── qr-generator.vue       ← ★ the QR tool (see below)
│   └── n8n.vue                ← ★ the workflow library (see below)
├── components/
│   ├── SiteHeader.vue         ← sticky header with hide-on-scroll
│   ├── SiteFooter.vue
│   ├── HeroSection.vue        ← name + rotating titles + marquee + photo
│   ├── MarqueeRow.vue         ← reusable infinite horizontal marquee
│   ├── PinnedHeadline.vue     ← scroll-driven word-by-word reveal
│   ├── SelectedWork.vue       ← ★ pinned + scaling images on scroll
│   ├── ExperienceSection.vue
│   ├── SkillsSection.vue      ← tech stack chips marquee
│   ├── CraftRevealSection.vue ← ★ multi-stage pinned reveal (thumbs → portrait → CTA)
│   └── ContactSection.vue
├── plugins/
│   ├── lenis.client.ts        ← smooth scroll, ticks GSAP
│   └── gsap.client.ts         ← registers ScrollTrigger
├── layouts/
│   └── tool.vue               ← chrome for the standalone tools
├── utils/qr/                  ← the QR engine, framework-free and unit-tested
│   ├── payload.ts             ← URL / Wi-Fi / vCard / vEvent encoding
│   ├── matrix.ts              ← qrcode-generator wrapper + logo hole punch
│   ├── shapes.ts              ← module and eye shape library
│   ├── path-parse.ts          ← SVG path data → move/line/cubic/close
│   ├── render.ts              ← style options → a drawable scene
│   ├── export-svg.ts          ← scene → SVG
│   ├── export-pdf.ts          ← scene → vector PDF, written by hand
│   ├── export-eps.ts          ← scene → vector EPS
│   ├── download.ts            ← PNG rasterising and saving (needs a DOM)
│   ├── randomize.ts           ← "Randomize style" and its locks
│   ├── share.ts               ← the whole editor state ↔ the query string
│   └── logos.ts               ← GENERATED: brand marks, see scripts/
├── utils/n8n/                 ← the workflow library's engine, also unit-tested
│   ├── nodes.ts               ← n8n node type → service name, label, kind
│   ├── derive.ts              ← a raw workflow → a catalog row and a diagram
│   ├── search.ts              ← client-side search, filters and facet counts
│   ├── graph.ts               ← nodes + connections → an SVG scene
│   ├── markdown.ts            ← sticky notes → HTML, escape-first
│   └── palette.ts             ← node-kind colours and service bubbles
├── assets/css/main.css        ← base styles, marquee/rotator/header CSS
├── assets/css/qr.css          ← the QR tool's liquid-glass system
├── assets/css/n8n.css         ← the workflow library's clay system
├── public/images/             ← your real project + skill assets
└── public/n8n/                ← GENERATED: the catalog and 2,045 workflows
```

## How the key effects work

### 1. Selected Work — scroll-pinned image scaling

In `components/SelectedWork.vue`. The pattern:

1. The outer `<section>` has `projects.length × 100vh` of scroll height (created by ScrollTrigger's `end: '+=N*innerHeight'`).
2. The inner div is **pinned** during that scroll range.
3. A single GSAP timeline runs with `scrub: 1` — tied directly to scroll position, not time.
4. For each project transition, the current image scales from `1 → 1.25` while fading to `opacity: 0`, and the next image scales from `0.55 → 1` while fading from `0 → 1`.
5. `onUpdate` reads `self.progress` to highlight the matching row in the list.

To swap projects, edit the `projects` array at the top of the component. Each needs `slug`, `name`, `category`, `year`, `image`, `url`.

### 2. Pinned headline word reveal

In `components/PinnedHeadline.vue`. The text is split into `<span>`s, each starts at `opacity: 0.12`, and GSAP staggers them to `opacity: 1` tied to scroll progress between the section's `top 75%` and `bottom 40%` — so they fade in word-by-word as the reader scrolls past.

### 3. Hero rotating titles

CSS-only — see `.rotator` in `assets/css/main.css`. A vertical stack of `<span>`s slides up via `@keyframes`, with `steps(1)` so it snaps between titles instead of scrolling smoothly.

### 4. Marquee text

CSS-only too — two identical tracks side-by-side, both translating `0 → -100%` on a loop. Because each track is the full width, when track A reaches `-100%` track B is right behind it, giving a seamless infinite scroll.

### 5. Header hide-on-scroll

`components/SiteHeader.vue` — vanilla `scroll` listener with `requestAnimationFrame` throttling. Toggles an `is-hidden` class based on scroll direction. `mix-blend-mode: difference` makes the text invert against whatever is behind it.

## The QR generator (`/qr-generator`)

Entirely client-side: there is no API behind it, so the page is prerendered
alongside the homepage and nothing anyone types is ever uploaded.

The engine stops at a **scene** - a background colour and an ordered list of
filled paths in module coordinates. Every exporter draws that same scene, which
is the only reason the PDF is guaranteed to match the preview. Shapes are built
as command lists using only move / line / cubic / close, never arcs, because an
arc is the one SVG command with no PDF or PostScript equivalent.

PDF and EPS are written by hand rather than through a library. Both are vector,
including gradients (PDF shadings, PostScript `shfill`) and brand logos. A
PDF library plus its SVG plugin would be roughly 400 kB shipped to every
visitor to write a document that uses about fifteen operators.

Brand marks are baked into `utils/qr/logos.ts` at author time rather than
imported at runtime. Regenerate them with:

```bash
node scripts/generate-qr-logos.mjs
```

Scannability is treated as a correctness property, not a nicety:

- The three finder patterns are styled separately and never distorted.
- A logo clears the modules under it rather than covering them, and raises
  error correction to at least Q.
- The randomiser draws from curated palettes, so a reroll cannot produce an
  unscannable code.
- The contrast ratio is shown live next to the colour pickers.

Run the engine's tests with `npm test`. They cover payload escaping, the SVG
path parser, shape geometry, the scene, and all three vector formats agreeing
on their coordinates.

## The workflow library (`/n8n`)

A browser for 2,045 real n8n automations: search them, read the diagram and
whatever the author wrote on the canvas, then copy the JSON onto your own n8n.

Everything is served from this site.
`public/n8n/catalog.json` is the browse index — one row per workflow, ~130 kB
gzipped — and each workflow is its own file under `public/n8n/workflows/`,
fetched only when someone opens it.
Nothing on the page depends on a third-party host at run time, so Copy and
Download cannot break because somebody else's repository moved.

Regenerate both with:

```bash
node scripts/build-n8n-catalog.mjs
```

That script downloads the corpus, derives every catalog row, and refuses to
write anything if the connection graph in the source is broken — read its
header comment before changing the ref it is pinned to.
The pin is not incidental: the corpus was damaged upstream in November 2025,
and on that branch 99.9% of connections point at nodes that no longer exist.

Three things are worth knowing about the data, because they shape the code:

- **Half the workflows have no name**, and many of the rest are called "My
  workflow". Names are derived from the filename when the file's own name says
  nothing, which is why `utils/n8n/derive.ts` has a table of run-together node
  names to unpack.
- **There is no description field.** The summaries are the first sticky note
  the author pinned to the canvas, with the markdown taken off.
- **Sticky notes are third-party markdown.** `utils/n8n/markdown.ts` escapes the
  whole note before it emits a single tag, so the tags it then produces are the
  only ones that can reach the DOM.

The diagram keeps each author's own node coordinates rather than re-solving the
layout — an arrangement someone made by hand carries meaning that no
auto-layout recovers. `utils/n8n/graph.ts` only turns those coordinates into a
viewBox, routes the two kinds of n8n edge (data runs sideways, agent wiring runs
up), and measures how much room each caption has before it collides with its
neighbour's.

**Light and dark**, resolved into a `data-n8-theme` attribute on the html
element by an inline script that runs before first paint — see
`composables/useN8nTheme.ts`.
The attribute is always an explicit `light` or `dark`, never "system", which is
why `n8n.css` has one dark block instead of one for the media query and another
for the override.
It also drives `color-scheme`, which is the only thing that stops the browser
drawing this site's dark scrollbar down the side of a light page.
The page removes the attribute when it unmounts, so the theme cannot leak onto
the portfolio's own near-black pages.

**Two result layouts**, switched by the control next to the sort chips and
remembered in localStorage — cards to browse with, a compact list to look
things up in.
The list drops the category (the rail already filters by it) and lets the
summary take whatever room is left after the name, so it fits roughly four
times as many workflows on a screen: a row is 47px against a card's 236px.
The preference stays out of the query string on purpose — sharing a search
should not impose how you like to read results.

Two performance rules the page learned the hard way, both worth keeping:

- **The background is gradients, not blurred elements.** It used to be three
  `filter: blur(90px)` divs whose keyframes animated `scale()`, which forces
  the browser to re-rasterise a 90px blur on every frame for as long as the tab
  is open. Radial gradients painted into the background look the same and
  promote nothing.
- **The grid grows only when asked.** Infinite scroll fired five times during
  one flick to the bottom and left 120 cards and 1,800 nodes mounted. A button
  keeps the page the size the reader chose: 24 cards, ~540 nodes, however far
  they scroll.

Run its tests with `npm test`.

## Security and licensing

- **[SECURITY.md](SECURITY.md)** — how to report something, what protects what
  (the PIN gate, the rate limits, the headers), an honest account of what the
  code can and cannot do about denial of service, and the one dependency
  advisory that is known and accepted rather than fixed.
- **[LICENSE](LICENSE)** — all rights reserved. Read it, learn from it, ask
  before reusing it.
- **[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)** — the material here that
  belongs to other people and stays under its own terms.

Security headers live in **two** places that must be changed together:
`netlify.toml` for what the CDN serves directly, and
`server/middleware/security-headers.ts` for responses the SSR function
produces, which the CDN rules do not reliably reach.

## Customizing

- **Email** — replace `princejankevin+profile@gmail.com` in `ContactSection.vue` and `SiteFooter.vue`.
- **Contact form backend** — `submit()` in `ContactSection.vue` is a stub. Wire it to Formspree, Resend, Supabase, or whatever you like.
- **Accent color** — change `--color-accent` in `main.css` and `accent` in `tailwind.config.js`. Both must match.
- **Add projects** — push to the `projects` array in `SelectedWork.vue` and drop the image into `public/images/`.
- **Pages** — add `pages/work/[slug].vue` for individual project pages later.

## Notes

- GSAP became fully free under Webflow in 2024 so all plugins (including ScrollTrigger) can be used without a license. SplitText is also free now if you want word-level animation control beyond what's here.
- Lenis is open-source from Studio Freight (now Darkroom Engineering).
- If you see jank during the pinned section, try setting `scrub: 0.5` (snappier) or `scrub: 2` (smoother lag).
- `prefers-reduced-motion`: Lenis now hands the wheel straight to the browser when it is set, so the page stops gliding after the wheel stops — that was the one effect moving the page without being asked. The scroll-*linked* GSAP effects (the pinned sections, the image scale) still run, deliberately: they track the reader's own scrolling rather than animating on their own, and disabling them would leave those sections in a half-built state. If you want them gone too, wrap each section's timeline in `gsap.matchMedia()` rather than disabling ScrollTrigger globally.
