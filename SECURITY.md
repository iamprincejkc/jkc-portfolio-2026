# Security

## Reporting something

Email **princejankevin@gmail.com** with what you found and how to reproduce it.
Please do not open a public issue for anything exploitable.

This is a personal portfolio, not a funded product: there is no bounty, and the honest expectation is a reply within a few days and a fix when there is one to make.

## What is worth reporting

Anything that lets someone read or change what they should not: bypassing the `/gallery` PIN gate, reaching `/api/gallery/admin/*` without an admin session, forging a session cookie, executing script in a visitor's browser, or extracting a server-side secret.

Not worth reporting:

- **"I can read your JavaScript."** Yes. Every site ships its client code to the browser, and this one's source is public anyway.
- Missing headers on `*.netlify.app` preview deploys.
- Findings from an automated scanner with no demonstrated impact.
- Anything requiring physical access, a compromised device, or the site owner's own credentials.

## What protects what

### The gate — `server/middleware/gate.ts`, `server/utils/auth.ts`

`/gallery` and `/api/gallery` are PIN-gated. Everything else on the site is public by design.

- Sessions are stateless HMAC-SHA256 tokens in an `httpOnly`, `sameSite=lax`, `secure` cookie. There is no session store to steal.
- Token verification compares signatures with `timingSafeEqual` after a length check, and rejects anything malformed, tampered with or expired.
- PINs are compared in constant time. Both candidate PINs are always checked, so response timing does not reveal which one was entered.
- **Fails closed.** A missing or short `NUXT_AUTH_SECRET` returns 503 rather than letting everyone in.
- Admin sessions expire in 2 hours; viewer sessions in 12.
- The `?next=` redirect only ever accepts a path on this origin, so the gate cannot be turned into an open redirect.

### Rate limits — `server/utils/rate-limit.ts`

| Endpoint | Limit | Why |
|---|---|---|
| `/api/gallery/session` | 8 per 10 min, per IP and scope | A PIN has a small keyspace; this is what stands between it and a brute-force |
| `/api/contact` | 5 per 10 min, per IP | Each accepted request sends real email and costs real money |
| `/api/gallery/admin/sign-upload` | 60 per min | Caps how fast a stolen admin session could burn Cloudinary storage |

**Known limitation, stated plainly:** the limiter is in-process. On serverless, an attacker spread across many cold instances gets a higher effective ceiling than the numbers above. Moving `consume()` to a Redis `INCR`/`EXPIRE` would fix it; the function signature was written so that swap does not touch the call sites.

### Secrets

Every credential is server-only, read through `runtimeConfig` and set as an environment variable in Netlify. None is bundled into client JavaScript — verified by grepping the built bundle for all eight names.

`.env` is gitignored and has never been committed. `.env.example` holds empty placeholders and comments.

### Headers — `server/middleware/security-headers.ts` and `netlify.toml`

CSP, HSTS, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, a deny-by-default `Permissions-Policy`, COOP and CORP.

The set is duplicated in two places on purpose: `netlify.toml` covers what the CDN serves directly, and the middleware covers responses produced by the SSR function, which the CDN rules do not reliably reach. **Change them together.**

The CSP uses `script-src 'unsafe-inline'`. That is a real weakness and it is deliberate — see the note at the top of the middleware for why a nonce cannot exist on a prerendered page, and why build-time hashes were rejected. Everything that does not depend on it is locked down: no framing, no plugins, no `<base>` hijack, forms post only to this origin, and images, fonts, styles and connections are limited to named origins.

### Untrusted content

`/n8n` renders markdown written by other people — sticky notes from ~2,000 third-party workflow files.

`utils/n8n/markdown.ts` escapes every character of a note **before** it emits a single tag, so the only tags that can reach the DOM are ones it generated itself. A `<script>` in a note renders as visible text. Link destinations are restricted to `http:` and `https:`, so `javascript:` and `data:` URLs are dropped. This is covered by tests, including the attribute-injection and scheme-smuggling cases.

## Denial of service

Worth being straight about which half of this is in the code and which is not.

**Network-layer floods** are absorbed by Netlify's CDN and Cloudflare in front of it. No application change affects that, and anyone claiming otherwise is selling something.

**What the code controls** is whether a request is cheap:

- The portfolio, `/qr-generator` and `/n8n` are prerendered and served from the CDN. They never reach a server function, so flooding them costs bandwidth and nothing else.
- The 1,971 workflow files and the catalog are static assets with long cache lifetimes.
- `/api/now-playing` is memoised in-process and sent with `max-age=20`, so a hot page hits Last.fm at most three times a minute regardless of traffic.
- The only endpoints that do real work — send email, mint upload tickets, check a PIN — are the three rate-limited ones above.

## Dependencies

`npm audit --omit=dev` reports **0 vulnerabilities**.

`npm audit` still reports **3 high**, all one chain: `sharp` → `ipx` → `@nuxt/image`, for CVEs in native libvips and libheif. Two things are worth stating precisely, because the number on its own is misleading.

**None of that code is deployed.** `nuxt.config.ts` selects Netlify's Image CDN when `NETLIFY` is set, so images are resized at the edge. A production build contains **zero** `sharp` and **zero** `ipx` directories — verified by building with `NETLIFY=true` and counting. `ipx` is retained for local development only, where `/.netlify/images` does not exist. `npm audit` reads the dependency tree, not what ships, so it counts a package that never reaches the server.

**It was not reachable before that either.** These are memory-safety bugs in image *decoders*, which need a malicious image to reach. `image.domains` is unset, so `/_ipx/` would only ever have processed files already in `public/images/` — the owner's own. There was never a path for an attacker to supply the bytes.

The clean fix is `@nuxt/image@2`, which clears the advisory outright. It was tried and **breaks the build** — it stops during prerendering and never emits the client assets — so it is reverted and waiting on an upstream fix.

Re-check with:

```bash
npm audit --omit=dev        # what ships
NETLIFY=true npm run build  # then confirm no sharp/ipx in .output
```
