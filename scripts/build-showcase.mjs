/**
 * Builds the images behind the landing page's "Apps I build for myself" section
 * (components/landing/AppShowcase.vue).
 *
 *   node scripts/build-showcase.mjs --from <Personal folder> --hand <photo.jpg>
 *
 * --from   the folder that holds the other projects (Hushkey, Shiftbell, Tally,
 *          habblaud, XRayMirror, Notchpoint), for their own screenshots.
 * --hand   Pexels photo 8947174 by Kaboompics: a woman's hand holding a phone
 *          in a red case against a plain light backdrop, downloaded at 2400 px:
 *          https://images.pexels.com/photos/8947174/pexels-photo-8947174.jpeg?auto=compress&cs=tinysrgb&w=2400
 *          Pexels licence: free to use and modify, no attribution required.
 *
 * Writes `public/images/showcase/*.webp` and prints the hand's geometry, which
 * is hard-coded in AppShowcase.vue (HAND). The outputs are committed; the site
 * never runs this.
 *
 * ---------------------------------------------------------------------------
 * The hand
 * ---------------------------------------------------------------------------
 * Only the skin is kept. The photo's phone (an older iPhone in a pink case) is
 * removed, and AppShowcase.vue draws a current iPhone in CSS in its place,
 * BEHIND the hand image, so the fingers and thumb sit in front of it and the
 * palm continues below it. The backdrop is a plain, near-neutral light grey,
 * so no segmentation model is needed:
 *  1. The old case's outline, from its colour: every face of the pink case has
 *     blue above green, every bit of skin green well above blue. Each edge is
 *     the median along a stretch no finger touches. The new phone is as wide
 *     as the case (so the fingers still touch its sides), has an iPhone Pro's
 *     proportions, stands on the case's bottom edge and rises into empty space.
 *  2. A clean plate of the backdrop: average the neutral, light pixels in
 *     coarse cells, diffuse into the cells the subject covers, then refine in
 *     6 px cells, taking only pixels close to the coarse plate (the white nail
 *     polish is neutral and light too).
 *  3. Alpha from each pixel's colour distance to the plate (7 to 20: the nails
 *     sit only ~24 levels from the backdrop). Near the phone only warm pixels
 *     (skin, even in deep shadow) and nails beside it survive.
 *  4. Holes filled, everything more than 2 px inside the outline made solid,
 *     and the outline itself smoothed.
 *  5. Edge pixels unmixed from the plate, the outermost skin recoloured from
 *     the skin just inside it, and the case's pink glow on the fingers and
 *     palm moved back to the hand's own colour.
 *  6. A soft contact shadow baked onto the phone under each finger.
 *  7. Cropped from just above the phone to 0.35 of a screen height below it,
 *     so the whole hand fits a laptop's viewport while it is pinned, and the
 *     arm leaves through the bottom edge only.
 */
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const arg = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const from = arg('--from')
const handPhoto = arg('--hand')
if (!from || !handPhoto) {
  console.error('usage: node scripts/build-showcase.mjs --from <Personal folder> --hand <pexels-8947174.jpg>')
  process.exit(1)
}

const OUT = resolve('public/images/showcase')
mkdirSync(OUT, { recursive: true })
const CARD_WIDTHS = [288, 576]

// ---------------------------------------------------------------------------
// The hand
// ---------------------------------------------------------------------------
const hand = await (async () => {
  const { data, info } = await sharp(handPhoto).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  if (W !== 2400 || H !== 3600) throw new Error(`expected the 2400x3600 download, got ${W}x${H}`)
  const N = W * H
  const lum = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  const sat = (i) => { const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]); return mx ? (mx - mn) / mx : 0 }
  const smooth = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

  // 1. The old phone. Every face of the pink case has blue above green (+4 to
  // +15); every bit of skin has green well above blue (-19 to -33); backdrop
  // and nails are near 0 with no saturation. So "case-ness" is blue-over-green
  // on a saturated pixel. Each edge of the outline is the median first case
  // pixel along a stretch no finger touches (the case's pink glow tints a few
  // pixels of the fingers, and a plain bounding box caught those).
  const caseness = (i) => smooth(-4, 3, data[i + 2] - data[i + 1]) * smooth(0.1, 0.18, sat(i))
  const isCaseAt = (x, y) => caseness((y * W + x) * 3) > 0.5
  const median = (values) => { const v = values.filter((n) => n >= 0).sort((a, b) => a - b); return v[v.length >> 1] }
  const firstAlong = (from, to, at) => { const step = from < to ? 1 : -1; for (let v = from; v !== to; v += step) if (at(v)) return v; return -1 }
  const rows = Array.from({ length: 100 }, (_, k) => 1050 + k * 5) // above the fingers and the thumb
  const cols = Array.from({ length: 90 }, (_, k) => 950 + k * 5) // the middle of the top and bottom edges
  const cx0 = median(rows.map((y) => firstAlong(650, 1176, (x) => isCaseAt(x, y))))
  const cx1 = median(rows.map((y) => firstAlong(1750, 1176, (x) => isCaseAt(x, y))))
  const cy0 = median(cols.map((x) => firstAlong(850, 1300, (y) => isCaseAt(x, y))))
  const cy1 = median(cols.map((x) => firstAlong(2650, 2300, (y) => isCaseAt(x, y))))
  if (cx1 - cx0 < 700 || cx1 - cx0 > 860 || cy1 - cy0 < 1400 || cy1 - cy0 > 1650) throw new Error(`case outline looks wrong: x ${cx0}-${cx1}, y ${cy0}-${cy1}`)
  const CASE = { x0: cx0, y0: cy0, x1: cx1, y1: cy1, r: 166 }

  // The new phone: as wide as the case, so the fingers and the thumb still
  // touch its sides, with a current iPhone Pro's proportions (0.48), standing 10 px
  // below the case's bottom edge (covering the case's shadow line on the palm) and
  // rising above its old top into empty space.
  const DEV = { w: cx1 - cx0 + 1 }
  DEV.h = Math.round(DEV.w / 0.48)
  DEV.x = cx0
  DEV.y = cy1 + 1 + 10 - DEV.h
  DEV.r = Math.round(DEV.w * 0.19)
  DEV.frame = Math.round(DEV.w * 0.012) // titanium band seen from the front
  DEV.bezel = Math.round(DEV.w * 0.022) // black border around the display
  const inRoundRect = (x, y, { x0, y0, x1, y1, r }, inset = 0) => {
    const a = x0 + inset, b = y0 + inset, c = x1 - inset, d = y1 - inset, rr = Math.max(0, r - inset)
    if (x < a || x > c || y < b || y > d) return 0
    const qx = x < a + rr ? a + rr : x > c - rr ? c - rr : x
    const qy = y < b + rr ? b + rr : y > d - rr ? d - rr : y
    const dd = Math.hypot(x - qx, y - qy)
    return dd <= rr - 1 ? 1 : dd >= rr ? 0 : rr - dd
  }
  const DEVRECT = { x0: DEV.x, y0: DEV.y, x1: DEV.x + DEV.w - 1, y1: DEV.y + DEV.h - 1, r: DEV.r }

  // 2. Clean plate of the backdrop, coarse then fine.
  const isBackdrop = (p) => {
    const i = p * 3
    const r = data[i], g = data[i + 1], b = data[i + 2]
    return lum(i) > 150 && Math.abs(r - g) < 9 && Math.abs(g - b) < 9 && Math.abs(r - b) < 9 && !inRoundRect(p % W, (p / W) | 0, CASE)
  }
  const plateOf = (cell, need, seed, accept = isBackdrop) => {
    const cw = Math.ceil(W / cell), ch = Math.ceil(H / cell)
    const plate = new Float32Array(cw * ch * 3), known = new Uint8Array(cw * ch)
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      let n = 0, tot = 0
      const s = [0, 0, 0]
      for (let y = cy * cell; y < Math.min(H, (cy + 1) * cell); y++) for (let x = cx * cell; x < Math.min(W, (cx + 1) * cell); x++) {
        tot++
        const p = y * W + x
        if (accept(p, x, y)) { n++; for (let k = 0; k < 3; k++) s[k] += data[p * 3 + k] }
      }
      const c = cy * cw + cx
      if (n >= tot * need) { known[c] = 1; for (let k = 0; k < 3; k++) plate[c * 3 + k] = s[k] / n }
      else { const v = seed ? seed(cx * cell + cell / 2, cy * cell + cell / 2) : [215, 217, 216]; for (let k = 0; k < 3; k++) plate[c * 3 + k] = v[k] }
    }
    return { plate, known, cw, ch, cell }
  }
  const diffuse = ({ plate, known, cw, ch }, iterations) => {
    for (let it = 0; it < iterations; it++) for (let cy = 1; cy < ch - 1; cy++) for (let cx = 1; cx < cw - 1; cx++) {
      const c = cy * cw + cx
      if (known[c]) continue
      for (let k = 0; k < 3; k++) plate[c * 3 + k] = (plate[(c - 1) * 3 + k] + plate[(c + 1) * 3 + k] + plate[(c - cw) * 3 + k] + plate[(c + cw) * 3 + k]) / 4
    }
  }
  const sampler = ({ plate, cw, ch, cell }) => (x, y) => {
    const fx = Math.min(cw - 1.001, Math.max(0, x / cell - 0.5)), fy = Math.min(ch - 1.001, Math.max(0, y / cell - 0.5))
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
    const v = (cx, cy, k) => plate[(cy * cw + cx) * 3 + k]
    return [0, 1, 2].map((k) => (v(x0, y0, k) * (1 - tx) + v(x0 + 1, y0, k) * tx) * (1 - ty) + (v(x0, y0 + 1, k) * (1 - tx) + v(x0 + 1, y0 + 1, k) * tx) * ty)
  }
  const coarse = plateOf(24, 0.97)
  diffuse(coarse, 3000)
  // The white nail polish is neutral and light too, so near the subject only a
  // pixel within a few levels of the coarse plate counts as backdrop. Without
  // this the fine plate learned the polish's colour and keyed the nails out.
  const coarseAt = sampler(coarse)
  const nearCoarse = (p, x, y) => {
    if (!isBackdrop(p)) return false
    const B = coarseAt(x, y), i = p * 3
    return Math.hypot(data[i] - B[0], data[i + 1] - B[1], data[i + 2] - B[2]) < 6
  }
  const fine = plateOf(6, 0.4, coarseAt, nearCoarse)
  diffuse(fine, 400)
  const bgAt = sampler(fine)

  // 3. Matte of the skin only. In a zone 12 px around the new phone (which
  // covers the whole old case, its top-edge highlight and its button bumps)
  // only skin survives: clearly warm (green over blue; the palm under the
  // phone is in deep shadow but still warm), or the white of a nail beside
  // the phone. Elsewhere the case's colour is removed from the matte.
  const alpha = new Float32Array(N)
  const bg = new Float32Array(N * 3)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 3
    const B = bgAt(x, y)
    bg[i] = B[0]; bg[i + 1] = B[1]; bg[i + 2] = B[2]
    const matte = smooth(7, 20, Math.hypot(data[i] - B[0], data[i + 1] - B[1], data[i + 2] - B[2]))
    if (inRoundRect(x, y, DEVRECT, -12) || inRoundRect(x, y, CASE, -12)) {
      const bMinusG = data[i + 2] - data[i + 1]
      const warm = smooth(-5, -14, bMinusG) * smooth(25, 50, lum(i))
      // Nails are only ever beside the phone; above, below or on it a white pixel is the old case's edge.
      const beside = x < DEV.x - 2 || x > DEV.x + DEV.w + 1
      const nail = beside && sat(i) < 0.08 && lum(i) > 190 && bMinusG <= 1 ? 1 : 0
      alpha[p] = matte * Math.max(warm, nail)
    } else {
      alpha[p] = matte * (1 - caseness(i))
    }
  }

  // 4. Fill holes the backdrop cannot reach, keep a soft alpha only in a 2 px
  // band along the outside, and smooth that outline.
  const outside = new Uint8Array(N)
  {
    const stack = []
    const seedAt = (p) => { if (alpha[p] < 0.5 && !outside[p]) { outside[p] = 1; stack.push(p) } }
    for (let x = 0; x < W; x++) { seedAt(x); seedAt((H - 1) * W + x) }
    for (let y = 0; y < H; y++) { seedAt(y * W); seedAt(y * W + W - 1) }
    while (stack.length) {
      const p = stack.pop()
      const x = p % W
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= N || outside[q] || alpha[q] >= 0.5) continue
        outside[q] = 1
        stack.push(q)
      }
    }
  }
  let holes = 0
  for (let p = 0; p < N; p++) if (!outside[p] && alpha[p] < 0.5) { alpha[p] = 1; holes++ }
  const band = new Uint8Array(N)
  {
    const R = 2
    const tmp = new Uint8Array(N)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!outside[y * W + x]) continue
      for (let dx = -R; dx <= R; dx++) { const xx = x + dx; if (xx >= 0 && xx < W) tmp[y * W + xx] = 1 }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!tmp[y * W + x]) continue
      for (let dy = -R; dy <= R; dy++) { const yy = y + dy; if (yy >= 0 && yy < H) band[yy * W + x] = 1 }
    }
  }
  for (let p = 0; p < N; p++) if (!band[p]) alpha[p] = 1
  {
    const a8 = Buffer.alloc(N)
    for (let p = 0; p < N; p++) a8[p] = Math.round(alpha[p] * 255)
    const blurred = await sharp(a8, { raw: { width: W, height: H, channels: 1 } }).blur(1.1).extractChannel(0).raw().toBuffer()
    for (let p = 0; p < N; p++) if (band[p]) alpha[p] = smooth(0.22, 0.78, blurred[p] / 255)
  }

  // 5. RGBA: unmix the backdrop from soft edges, then recolour the outermost
  // skin from the skin just inside it (no pale rim from the backdrop, no pink
  // rim from the case).
  const out = Buffer.alloc(N * 4)
  for (let p = 0; p < N; p++) {
    const i = p * 3, o = p * 4, a = alpha[p]
    let rgb = [data[i], data[i + 1], data[i + 2]]
    if (a < 1 && a > 0.02) rgb = [0, 1, 2].map((c) => bg[i + c] + (data[i + c] - bg[i + c]) / a)
    for (let c = 0; c < 3; c++) out[o + c] = Math.max(0, Math.min(255, Math.round(rgb[c])))
    out[o + 3] = Math.round(255 * a)
  }
  // (sharp 0.32 writes one-channel raw input back out as three channels unless told.)
  const edge = Buffer.alloc(N)
  for (let p = 0; p < N; p++) edge[p] = out[p * 4 + 3] < 250 ? 255 : 0
  const near = await sharp(edge, { raw: { width: W, height: H, channels: 1 } }).blur(2.5).extractChannel(0).raw().toBuffer()
  const coreRGB = Buffer.alloc(N * 3), coreW = Buffer.alloc(N)
  for (let p = 0; p < N; p++) if (out[p * 4 + 3] === 255 && near[p] < 4) {
    coreW[p] = 255
    for (let c = 0; c < 3; c++) coreRGB[p * 3 + c] = out[p * 4 + c]
  }
  const blurRGB = await sharp(coreRGB, { raw: { width: W, height: H, channels: 3 } }).blur(4).raw().toBuffer()
  const blurW = await sharp(coreW, { raw: { width: W, height: H, channels: 1 } }).blur(4).extractChannel(0).raw().toBuffer()
  let bled = 0
  for (let p = 0; p < N; p++) {
    if (out[p * 4 + 3] === 0 || near[p] < 4 || blurW[p] < 8) continue
    const w = Math.min(1, near[p] / 110)
    for (let c = 0; c < 3; c++) out[p * 4 + c] = Math.round(out[p * 4 + c] * (1 - w) + ((blurRGB[p * 3 + c] / blurW[p]) * 255) * w)
    bled++
  }

  // 5b. The pink case lit the skin next to it pink-orange (fingertips, the
  // palm under the phone). Beside a silver phone that reads as sunburn, so
  // within 140 px of the phone's edge the skin's colour is moved towards the
  // hand's own colour away from the phone, keeping each pixel's brightness
  // (the texture). Nails are left alone.
  {
    const cxd = DEV.x + DEV.w / 2, cyd = DEV.y + DEV.h / 2, hx = DEV.w / 2, hy = DEV.h / 2
    const sd = (x, y) => {
      const qx = Math.abs(x - cxd) - (hx - DEV.r), qy = Math.abs(y - cyd) - (hy - DEV.r)
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - DEV.r
    }
    const ratio = [0, 0, 0]
    let n = 0
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const o = (y * W + x) * 4
      if (out[o + 3] < 255) continue
      const l = 0.299 * out[o] + 0.587 * out[o + 1] + 0.114 * out[o + 2]
      if (l < 110 || l > 235 || out[o + 2] - out[o + 1] > -12 || Math.abs(sd(x, y)) < 160) continue
      for (let c = 0; c < 3; c++) ratio[c] += out[o + c] / l
      n++
    }
    for (let c = 0; c < 3; c++) ratio[c] /= n
    let tinted = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      if (out[o + 3] === 0) continue
      const d = Math.abs(sd(x, y))
      if (d > 140) continue
      const mx = Math.max(out[o], out[o + 1], out[o + 2]), mn = Math.min(out[o], out[o + 1], out[o + 2])
      if (mx && (mx - mn) / mx < 0.1) continue // nail
      const w = smooth(140, 0, d) * 0.9
      const l = 0.299 * out[o] + 0.587 * out[o + 1] + 0.114 * out[o + 2]
      for (let c = 0; c < 3; c++) out[o + c] = Math.max(0, Math.min(255, Math.round(out[o + c] * (1 - w) + l * ratio[c] * w)))
      tinted++
    }
    console.log(`skin ratio from ${n} px: ${ratio.map((v) => v.toFixed(3)).join(', ')}; ${tinted} px recoloured near the phone`)
  }

  // 6. Contact shadows: where a finger lies on the new phone, a soft shadow
  // falls on the phone just below it. Baked in, black, only inside the phone.
  {
    const skin = Buffer.alloc(N)
    for (let p = 0; p < N; p++) skin[p] = out[p * 4 + 3]
    const soft = await sharp(skin, { raw: { width: W, height: H, channels: 1 } }).blur(9).extractChannel(0).raw().toBuffer()
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const inside = inRoundRect(x, y, DEVRECT)
      if (!inside) continue
      const p = y * W + x, o = p * 4
      const sx = Math.max(0, x - 3), sy = Math.max(0, y - 7)
      const s = 0.3 * inside * (soft[sy * W + sx] / 255)
      const a = out[o + 3] / 255
      const A = a + s * (1 - a)
      if (A <= 0) continue
      for (let c = 0; c < 3; c++) out[o + c] = Math.round((out[o + c] * a) / A)
      out[o + 3] = Math.round(A * 255)
    }
  }

  // 7. Crop: from just above the phone to 0.35 of a screen height below its
  // screen (the palm; the arm goes on through the bottom edge). Any more arm
  // makes the hand taller than a laptop viewport once it is sized to the
  // cards. Sides: the hand's extent and the phone's, plus a margin.
  const inset = DEV.frame + DEV.bezel
  const screenH = DEV.h - 2 * inset
  const top = DEV.y - 30
  const bottom = DEV.y + DEV.h - inset + Math.round(screenH * 0.35)
  let left = DEV.x - 20, right = DEV.x + DEV.w + 20
  for (let y = top; y < bottom; y++) for (let x = 0; x < W; x++) if (out[(y * W + x) * 4 + 3] > 8) {
    if (x < left) left = x
    if (x > right) right = x
  }
  left = Math.max(0, left - 24)
  right = Math.min(W - 1, right + 24)
  if (right >= W - 1) throw new Error('the arm reaches the right edge inside the crop: it would show as a hard vertical cut')
  const crop = { left, top, width: right - left + 1, height: bottom - top }
  const cut = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract(crop).png().toBuffer()
  for (const width of [744, 1376]) {
    await sharp(cut).resize({ width, kernel: 'lanczos3' }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(join(OUT, `hand-${width}.webp`))
  }
  const geometry = {
    width: crop.width,
    height: crop.height,
    device: { x: DEV.x - crop.left, y: DEV.y - crop.top, w: DEV.w, h: DEV.h, r: DEV.r, frame: DEV.frame, bezel: DEV.bezel },
    screen: { x: DEV.x - crop.left + inset, y: DEV.y - crop.top + inset, w: DEV.w - 2 * inset, h: screenH },
  }
  console.log(`hand: case ${cx0}-${cx1} x ${cy0}-${cy1}; ${holes} hole px filled, ${bled} edge px recoloured; crop`, crop)
  console.log('HAND =', JSON.stringify(geometry))
  return geometry
})()

/** Every screenshot is cropped to the drawn phone's screen aspect, so a card and the phone in the hand are the same size. */
const SCREEN = { w: hand.screen.w, h: hand.screen.h }

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

/**
 * slug -> source. `crop` picks which part survives cropping to the card's
 * aspect: 'top' keeps the app bar, 'center' for screens without one.
 * Every source uses demo data; none shows a real name, address or secret.
 * Hushkey's settings and pairing screens are left out: they show the home
 * network's address.
 */
const SHOTS = {
  'hushkey-groups': { src: 'Hushkey/docs/screenshots/phone/home-groups.png', crop: 'top' },
  'hushkey-item': { src: 'Hushkey/docs/screenshots/phone/item.png', crop: 'top' },
  'hushkey-locked': { src: 'Hushkey/docs/screenshots/phone/locked.png', crop: 'center' },
  'hushkey-passwords': { src: 'Hushkey/docs/screenshots/phone/home-passwords.png', crop: 'top' },
  'shiftbell-standup': { src: 'Shiftbell/docs/screenshots/phone/alarm-custom.png', crop: 'top' },
  'shiftbell-late': { src: 'Shiftbell/docs/screenshots/phone/alarm-late.png', crop: 'top' },
  'shiftbell-time-in': { src: 'Shiftbell/docs/screenshots/phone/alarm-time-in.png', crop: 'top' },
  'shiftbell-home': { src: 'Shiftbell/docs/screenshots/phone/home.png', crop: 'top' },
  'shiftbell-editor': { src: 'Shiftbell/docs/screenshots/phone/editor.png', crop: 'top' },
  'tally-home': { src: 'Tally/tool/screenshots/07_home_partial.png', crop: 'top' },
  'tally-behind': { src: 'Tally/tool/screenshots/10_home_behind_dark.png', crop: 'top' },
  'tally-breakdown': { src: 'Tally/tool/screenshots/24_breakdown_dark.png', crop: 'top' },
  'tally-subscriptions': { src: 'Tally/tool/screenshots/22_subscriptions.png', crop: 'top' },
  'jgents-mobile': { src: 'habblaud/docs/screenshots/mobile.png', crop: 'top' },
  'xray-mirror': {
    src: 'XRayMirror/test-results/demo-layout-phone-no-sidew-de232--the-stage-keeps-its-gutter/layout-phone.png',
    crop: 'top',
  },
}

async function writeCard(slug, input, position = 'top') {
  for (const w of CARD_WIDTHS) {
    const h = Math.round((w * SCREEN.h) / SCREEN.w)
    await sharp(input)
      .resize(w, h, { fit: 'cover', position, kernel: 'lanczos3' })
      .webp({ quality: 84, effort: 6 })
      .toFile(join(OUT, `${slug}-${w}.webp`))
  }
}

for (const [slug, { src, crop }] of Object.entries(SHOTS)) {
  await writeCard(slug, join(from, src), crop === 'center' ? 'centre' : 'top')
}

// Notchpoint lives at the top edge of a Windows desktop, not on a phone, so its
// card is the top of a screen: the open notch panel from its README, cut out
// exactly (measured: x 345-655, y 0-364, 20 px bottom corners) and hanging from
// the card's top edge over a drawn wallpaper in the README wallpaper's colours.
{
  const src = join(from, 'Notchpoint/docs/media/notch-expanded.png')
  const W = 576
  const H = Math.round((W * SCREEN.h) / SCREEN.w)
  const PANEL = { left: 345, top: 0, width: 311, height: 364, radius: 20 }
  const scale = 470 / PANEL.width
  const pw = Math.round(PANEL.width * scale)
  const ph = Math.round(PANEL.height * scale)
  const r = Math.round(PANEL.radius * scale)
  const shape = Buffer.from(
    `<svg width="${pw}" height="${ph}"><path fill="#fff" d="M0 0H${pw}V${ph - r}A${r} ${r} 0 0 1 ${pw - r} ${ph}H${r}A${r} ${r} 0 0 1 0 ${ph - r}Z"/></svg>`,
  )
  const panel = await sharp(src)
    .extract({ left: PANEL.left, top: PANEL.top, width: PANEL.width, height: PANEL.height })
    .resize(pw, ph, { kernel: 'lanczos3' })
    .ensureAlpha()
    .composite([{ input: shape, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const bokeh = [
    [80, 760, 70, '#9fd3e6', 0.18],
    [470, 640, 46, '#e8f4ff', 0.22],
    [520, 980, 90, '#6fa9c0', 0.14],
    [150, 1080, 40, '#f2d48c', 0.16],
    [330, 860, 24, '#ffffff', 0.25],
    [60, 520, 30, '#cfe9f5', 0.16],
  ]
    .map(([cx, cy, rad, c, o]) => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${c}" opacity="${o}" filter="url(#b)"/>`)
    .join('')
  const wall = Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#1b2a33"/><stop offset="0.55" stop-color="#101a21"/><stop offset="1" stop-color="#080c10"/></linearGradient>` +
      `<filter id="b" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>` +
      `<filter id="s" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>` +
      `</defs><rect width="100%" height="100%" fill="url(#g)"/>${bokeh}` +
      `<rect x="${(W - pw) / 2 + 20}" y="${ph - 60}" width="${pw - 40}" height="70" rx="30" fill="#000" opacity="0.55" filter="url(#s)"/></svg>`,
  )
  const card = await sharp(wall).composite([{ input: panel, top: 0, left: Math.round((W - pw) / 2) }]).png().toBuffer()
  await writeCard('notchpoint', card)
}

console.log(`cards: ${Object.keys(SHOTS).length + 1} at ${SCREEN.w}x${SCREEN.h} aspect`)
