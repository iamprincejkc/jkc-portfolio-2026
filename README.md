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
│   └── index.vue              ← composes all sections
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
├── assets/css/main.css        ← base styles, marquee/rotator/header CSS
└── public/images/             ← your real project + skill assets
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
- `prefers-reduced-motion`: not wired in yet — add a check in the GSAP plugins to skip ScrollTrigger setup for users who prefer reduced motion.
