/**
 * Records the screen recordings behind the work reel on the home page.
 *
 *   npm i --no-save playwright-core@1.49.1
 *   WIDGET_360=../360viewer/script.js  *   WIDGET_3QV=../3QVWidget/src/New/Widget3QV/widget-3qv.js  *   node scripts/record-work.mjs [names...]
 *
 * With no names it records everything and rebuilds the showreel. Names are the
 * clip names in utils/work/reel.ts - cfs fs360 qv3 ibc jet gis hope rd - and
 * `reel` rebuilds the showreel from whatever clips are there. OUT=<dir> writes
 * somewhere other than public/videos/work.
 *
 * Needs Google Chrome (it drives the installed one rather than downloading a
 * browser) and ffmpeg on PATH. Writes to public/videos/work:
 *
 *   <name>.mp4     1280x800 H.264, for wide screens
 *   <name>-m.mp4   720x450, picked by phones via <source media>
 *   <name>.webp    the poster, shown before the clip loads and without JS
 *   reel.*         two seconds of every clip, cross-faded, for the opener
 *
 * After re-recording, update each clip's `duration` in utils/work/reel.ts - the
 * test in reel.test.ts reads the real runtimes out of the files and fails until
 * they match, because the player bar's timecode is built from them.
 *
 * ---------------------------------------------------------------------------
 * How it films
 * ---------------------------------------------------------------------------
 * Headless Chrome's screencast hands over a JPEG every time the page repaints,
 * stamped with when it was painted. Those frames are written out with their
 * real durations and ffmpeg resamples them to a constant 30fps, which plays
 * back at true speed without the stutter of a screenshot per frame. A drawn
 * cursor and click ring stand in for the mouse, which headless does not have.
 *
 * ---------------------------------------------------------------------------
 * What it does not film
 * ---------------------------------------------------------------------------
 * ibcauto.com, and the IBC image CDN, put automated browsers behind a "confirm
 * you are human" check. That is a check to respect, not to get round, so the
 * IBC clip is made from the two screenshots in public/images - the home page,
 * and the stock search page from IBC's own announcement images - and the two
 * internal projects, which have no public page at all, are camera moves over
 * the one image each has. A screen
 * recording of IBC made by hand can replace it: encode it with the same
 * ffmpeg settings as `encode()` below.
 *
 * The 360°FS clip films the plugin's own demo build with its TEST001 vehicle,
 * whose frames Jet's image host also serves. The 3QV clip films the new
 * card-swap build against a stand-in for its API, served here, that answers
 * with Jet's public photos of one car - so neither needs an API key. Both
 * plugins are private, so neither is in this repository: point WIDGET_360 and
 * WIDGET_3QV at checkouts of them.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = await import('playwright-core').catch(() => {
  console.error('Install the recorder first:  npm i --no-save playwright-core@1.49.1')
  process.exit(1)
})

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const STAGE = resolve(ROOT, 'scripts/record-work')
const IMAGES = resolve(ROOT, 'public/images')
const DEST = resolve(process.env.OUT ?? resolve(ROOT, 'public/videos/work'))
const TMP = resolve(ROOT, '.recordings')
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const W = 1440
const H = 900

mkdirSync(DEST, { recursive: true })
mkdirSync(TMP, { recursive: true })

// ---------------------------------------------------------------------------
// A local server for the pages that are not on the web: the stills and the
// 360°FS demo. The demo's frames are rewritten to Jet's host, which has no
// bot check, from IBC's, which does.
// ---------------------------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file
  if (path === '/fs360.js') {
    if (!process.env.WIDGET_360) return res.writeHead(404).end()
    const js = readFileSync(resolve(process.env.WIDGET_360), 'utf8').replaceAll('https://images.ibcjapan.net/', 'https://images.jetlogistics.co.jp/')
    return res.writeHead(200, { 'content-type': TYPES['.js'] }).end(js)
  }
  if (path === '/qv3.js') {
    if (!process.env.WIDGET_3QV) return res.writeHead(404).end()
    return res.writeHead(200, { 'content-type': TYPES['.js'] }).end(readFileSync(resolve(process.env.WIDGET_3QV)))
  }
  // Stand-in for the 3QV API: the same response shape, Jet's public photos.
  const qv3 = /^\/v1\/plugin\/([^/]+)\/3qv-images$/.exec(path)
  if (qv3) {
    const photos = [1, 2, 3, 4, 5].map((n) => ({ name: `${qv3[1]}-${n}`, url: `https://jetlogistics.co.jp/assets/images/${qv3[1]}-${n}.jpeg` }))
    return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'success', '3QV': photos }))
  }
  if (path.startsWith('/images/')) file = resolve(IMAGES, `.${path.slice(7)}`)
  else file = resolve(STAGE, `.${path}`)
  if (!(file.startsWith(STAGE) || file.startsWith(IMAGES)) || !existsSync(file)) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file))
}).listen(8099)
const LOCAL = 'http://127.0.0.1:8099'

// A drawn cursor and click ring, and a smooth scroll that ignores the site's
// own `scroll-behavior`.
const INIT = `
(() => {
  const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2
  window.__scrollTo = (y, ms = 1200) => new Promise(done => {
    document.documentElement.style.scrollBehavior = 'auto'
    const from = scrollY, max = document.documentElement.scrollHeight - innerHeight
    const to = Math.max(0, Math.min(max, y)), t0 = performance.now()
    const step = now => {
      const t = Math.min(1, (now - t0) / ms)
      scrollTo(0, from + (to - from) * ease(t))
      t < 1 ? requestAnimationFrame(step) : done()
    }
    requestAnimationFrame(step)
  })
  if (window.__noCursor) return
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 11.5-6.6 1.2 3.9 7.1-2.8 1.5-3.9-7.2L4 21z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))'
    document.documentElement.appendChild(c)
    addEventListener('mousemove', e => { c.style.transform = 'translate(' + (e.clientX - 4) + 'px,' + (e.clientY - 2) + 'px)' }, true)
    addEventListener('mousedown', e => {
      const r = document.createElement('div')
      r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;left:' + (e.clientX - 18) + 'px;top:' + (e.clientY - 18) + 'px;width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,140,40,.9);transition:transform .45s ease-out,opacity .45s ease-out'
      document.documentElement.appendChild(r)
      requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0' })
      setTimeout(() => r.remove(), 500)
    }, true)
  })
})()`

const browser = await chromium.launch({ executablePath: CHROME, args: ['--hide-scrollbars', '--force-color-profile=srgb'] })

async function scene(name, url, run, { cursor = true, warm = true, ready } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'en-US', colorScheme: 'light' })
  await ctx.addInitScript(cursor ? INIT : `window.__noCursor = true;${INIT}`)
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  if (ready) await ready(page)
  if (warm) {
    // Walk the page once so lazy images are already there when it is filmed.
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < h; y += 600) {
      await page.evaluate((v) => scrollTo(0, v), y)
      await page.waitForTimeout(120)
    }
    await page.evaluate(() => scrollTo(0, 0))
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  }
  await page.mouse.move(W * 0.62, H * 0.55)
  await page.waitForTimeout(1200)

  const cdp = await ctx.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  const start = Date.now() / 1000
  await run(page, helpers(page))
  const end = Date.now() / 1000
  await cdp.send('Page.stopScreencast')
  await ctx.close()

  // Frames -> files, plus an ffconcat list carrying each frame's real duration.
  const dir = join(TMP, name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const kept = frames.filter((f) => f.t >= start - 0.05)
  let list = 'ffconcat version 1.0\n'
  kept.forEach((f, i) => {
    const file = `${String(i).padStart(5, '0')}.jpg`
    writeFileSync(join(dir, file), Buffer.from(f.data, 'base64'))
    const next = kept[i + 1]?.t ?? end
    list += `file ${file}\nduration ${Math.max(0.001, next - Math.max(f.t, start)).toFixed(4)}\n`
  })
  list += `file ${String(kept.length - 1).padStart(5, '0')}.jpg\n`
  writeFileSync(join(dir, 'list.txt'), list)
  console.log(`${name}: ${kept.length} frames over ${(end - start).toFixed(1)}s`)
  encode(['-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt')], name, POSTER[name])
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`)
}

/** Both sizes and the poster, from any input ffmpeg can read. */
function encode(input, name, posterAt = 1) {
  const x264 = ['-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-movflags', '+faststart', '-an']
  ffmpeg([...input, '-vf', 'fps=30,scale=1280:800:flags=lanczos,format=yuv420p', '-crf', '31', ...x264, join(DEST, `${name}.mp4`)])
  ffmpeg(['-i', join(DEST, `${name}.mp4`), '-vf', 'scale=720:450:flags=lanczos,format=yuv420p', '-crf', '30', ...x264, join(DEST, `${name}-m.mp4`)])
  ffmpeg(['-ss', String(posterAt), '-i', join(DEST, `${name}.mp4`), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '72', join(DEST, `${name}.webp`)])
}

function helpers(page) {
  const wait = (ms) => page.waitForTimeout(ms)
  const scrollTo = (y, ms) => page.evaluate(([y, ms]) => window.__scrollTo(y, ms), [y, ms])
  const glide = (x, y, steps = 28) => page.mouse.move(x, y, { steps })
  const clickAt = async (x, y) => {
    await glide(x, y)
    await wait(180)
    await page.mouse.click(x, y)
  }
  const clickEl = async (locator) => {
    const b = await locator.first().boundingBox()
    if (!b) throw new Error('nothing to click')
    await clickAt(b.x + b.width / 2, b.y + b.height / 2)
  }
  const drag = async (x1, y1, x2, y2, steps = 60) => {
    await glide(x1, y1)
    await page.mouse.down()
    await page.mouse.move(x2, y2, { steps })
    await page.mouse.up()
  }
  return { wait, scrollTo, glide, clickEl, drag }
}

// ---------------------------------------------------------------------------
// The scenes. Coordinates are page pixels at 1440x900 and will need nudging
// when a site's layout changes; check a contact sheet of the result.
// ---------------------------------------------------------------------------
const scenes = {
  cfs: () =>
    scene('cfs', 'https://capitalfinancialservices.co.nz/', async (page, t) => {
      await t.wait(1200)
      // The repayment calculator only - nothing is submitted.
      await t.clickEl(page.locator('#calc-amount'))
      await page.keyboard.type('25000', { delay: 110 })
      await t.clickEl(page.locator('#calc-term'))
      await page.keyboard.type('60', { delay: 140 })
      await t.wait(300)
      await t.clickEl(page.locator('label').filter({ hasText: /^\s*Monthly\s*$/ }))
      await t.wait(1500)
      await t.scrollTo(1160, 1400)
      await t.wait(300)
      for (const x of [250, 600, 945, 1290]) {
        await t.glide(x, 1530 - 1160, 22)
        await t.wait(400)
      }
      await t.scrollTo(2000, 1400)
      await t.wait(800)
      await t.scrollTo(2880, 1300)
      await t.wait(900)
      await t.scrollTo(3380, 1100)
      await t.wait(200)
      await t.clickEl(page.locator('summary').filter({ hasText: 'pre-approval' }))
      await t.wait(1600)
    }),

  fs360: () =>
    scene(
      'fs360',
      `${LOCAL}/fs360.html`,
      async (page, t) => {
        await t.wait(600)
        await t.drag(560, 470, 980, 470, 90)
        await t.wait(400)
        await t.drag(980, 470, 420, 470, 110)
        await t.wait(400)
        for (const id of ['#btn-top', '#btn-bottom', '#btn-normal']) {
          await t.clickEl(page.locator(id))
          await t.wait(400)
          await t.drag(700, 470, 900, 470, 60)
          await t.wait(400)
        }
        await t.clickEl(page.locator('#btn-interior'))
        await t.wait(2600)
        await t.drag(720, 450, 380, 470, 120)
        await t.wait(300)
        await t.drag(380, 470, 900, 430, 120)
        await t.wait(1000)
      },
      {
        warm: false,
        // Film once the plugin has every frame, not while it fetches them.
        ready: async (page) => {
          await page.waitForFunction(() => document.querySelector('#car-360-modal')?.style.display === 'block', null, { timeout: 120000 })
          await page.waitForTimeout(3000)
        },
      },
    ),

  qv3: () =>
    scene(
      'qv3',
      `${LOCAL}/qv3.html`,
      async (page, t) => {
        await t.wait(700)
        await t.clickEl(page.locator('#open-3qv'))
        await t.wait(1600)
        for (let i = 0; i < 3; i++) {
          await t.clickEl(page.locator('.qv3-carousel-right'))
          await t.wait(1100)
        }
        // A swipe, as a phone would do it.
        await t.drag(980, 450, 460, 450, 26)
        await t.wait(1200)
        await t.clickEl(page.locator('.qv3-carousel-dot').nth(1))
        await t.wait(1200)
        await t.clickEl(page.locator('.qv3-carousel-left'))
        await t.wait(1300)
      },
      {
        warm: false,
        // The trigger only appears once the photos have loaded; fetch them all first.
        ready: async (page) => {
          await page.locator('#open-3qv').waitFor({ state: 'visible', timeout: 30000 })
          await page.evaluate(() => Promise.all([1, 2, 3, 4, 5].map((n) => new Promise((done) => {
            const i = new Image()
            i.onload = i.onerror = done
            i.src = `https://jetlogistics.co.jp/assets/images/ZYX10-2192564-${n}.jpeg`
          }))))
        },
      },
    ),

  jet: () =>
    scene('jet', 'https://jetlogistics.co.jp/en', async (page, t) => {
      await t.wait(1400)
      await t.glide(1180, 330)
      await t.wait(600)
      await t.scrollTo(820, 1400)
      await t.wait(400)
      for (let i = 0; i < 2; i++) {
        await t.clickEl(page.getByRole('button', { name: '›' }))
        await t.wait(1000)
      }
      await t.scrollTo(1650, 1400)
      await t.wait(700)
      await t.scrollTo(2350, 1300)
      await t.wait(900)
      await t.scrollTo(3650, 1700)
      await t.wait(1100)
    }),

  gis: () =>
    scene('gis', 'https://globalinspectionspecialist.com/home', async (page, t) => {
      await t.wait(1200)
      for (const [x, y] of [[930, 240], [1225, 240], [1225, 530], [930, 530]]) {
        await t.glide(x, y, 22)
        await t.wait(420)
      }
      for (const y of [760, 1420, 2120]) {
        await t.scrollTo(y, 1300)
        await t.wait(850)
      }
      await t.scrollTo(2950, 1300)
      await t.wait(300)
      for (const x of [280, 720, 1160]) {
        await t.glide(x, 3480 - 2950, 22)
        await t.wait(420)
      }
      await t.scrollTo(4250, 1600)
      await t.wait(1000)
    }),

  // Home page, then the stock search page: see record-work/ibc.html.
  ibc: () =>
    scene(
      'ibc',
      `${LOCAL}/ibc.html`,
      async (page, t) => {
        await page.evaluate(() => document.body.classList.add('go'))
        await t.wait(9000)
      },
      { cursor: false, warm: false },
    ),
  hope: () => still('hope', 'project-hope.webp', 'push'),
  rd: () => still('rd', 'project-rdgcash.webp', 'pan-y'),
}

/** Nine seconds of one eased camera move across a single image. */
function still(name, image, move) {
  return scene(
    name,
    `${LOCAL}/still.html?img=/images/${image}&move=${move}`,
    async (page, t) => {
      await page.evaluate(() => document.body.classList.add('go'))
      await t.wait(9000)
    },
    { cursor: false, warm: false },
  )
}

/** The frame each poster is taken from, in seconds: a moment that reads as a still. */
const POSTER = { cfs: 4.6, fs360: 1.2, qv3: 3.6, ibc: 6.4, jet: 0.6, gis: 0.8, hope: 1.5, rd: 1.5 }

/** Where in each clip its two seconds of the showreel come from, in reel order. */
const REEL = [['cfs', 1.6], ['fs360', 0.8], ['qv3', 3.4], ['ibc', 4.2], ['jet', 4.2], ['gis', 6.5], ['hope', 2.0], ['rd', 2.0]]

function reel() {
  const seg = 1.9
  const fade = 0.35
  const inputs = REEL.flatMap(([name, at]) => ['-ss', String(at), '-t', String(seg), '-i', join(DEST, `${name}.mp4`)])
  let graph = REEL.map((_, i) => `[${i}:v]settb=AVTB,fps=30,setpts=PTS-STARTPTS[v${i}]`).join(';')
  let prev = 'v0'
  for (let k = 1; k < REEL.length; k++) {
    graph += `;[${prev}][v${k}]xfade=transition=fade:duration=${fade}:offset=${(k * (seg - fade)).toFixed(2)}[x${k}]`
    prev = `x${k}`
  }
  const tmp = join(TMP, 'reel.mp4')
  ffmpeg([...inputs, '-filter_complex', graph, '-map', `[${prev}]`, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', tmp])
  encode(['-i', tmp], 'reel', 0.5)
  console.log('reel: rebuilt')
}

try {
  const names = process.argv.slice(2)
  for (const name of names.length ? names.filter((n) => n !== 'reel') : Object.keys(scenes)) {
    if (!scenes[name]) throw new Error(`no scene "${name}"`)
    await scenes[name]()
  }
  if (!names.length || names.includes('reel')) reel()
} finally {
  await browser.close()
  server.close()
}
