import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REEL, WORK, clipPoster, clipSrc, playhead, timecode } from './reel'

const pub = resolve(__dirname, '../../public')

/** An MP4's runtime in seconds, read from its `mvhd` box. */
function mp4Duration(file: string): number {
  const buf = readFileSync(file)
  const at = buf.indexOf('mvhd')
  if (at < 0) throw new Error(`no mvhd in ${file}`)
  const version = buf[at + 4]
  const body = at + 8
  return version === 1
    ? Number(buf.readBigUInt64BE(body + 20)) / buf.readUInt32BE(body + 16)
    : buf.readUInt32BE(body + 12) / buf.readUInt32BE(body + 8)
}

describe('work reel', () => {
  const clips = [...WORK.map((w) => w.clip), REEL]

  it('ships every clip at both sizes, with a poster', () => {
    for (const clip of clips) {
      for (const path of [clipSrc(clip), clipSrc(clip, true), clipPoster(clip)]) {
        expect(existsSync(resolve(pub, `.${path}`)), path).toBe(true)
      }
    }
  })

  // The timeline's timecode is the sum of these, so they must be the real runtimes.
  it('declares each clip at its real length', () => {
    for (const clip of clips) {
      expect(Math.abs(mp4Duration(resolve(pub, `.${clipSrc(clip)}`)) - clip.duration), clip.name).toBeLessThan(0.25)
    }
  })

  it('links only work that has somewhere to go', () => {
    for (const w of WORK) {
      if (w.url) expect(w.url).toMatch(/^https:\/\//)
      else expect(w.host).toMatch(/^Internal/)
    }
    expect(new Set(WORK.map((w) => w.slug)).size).toBe(WORK.length)
  })
})

describe('playhead', () => {
  const durations = [10, 20, 30]

  it('starts at the first chapter and ends at the last', () => {
    expect(playhead(0, durations)).toEqual({ index: 0, within: 0, seconds: 0 })
    expect(playhead(1, durations)).toEqual({ index: 2, within: 1, seconds: 60 })
  })

  it('gives each chapter an equal share of the scroll, timed by its own clip', () => {
    // Halfway through the second third: all of the first clip, half the second.
    const p = playhead(0.5, durations)
    expect(p.index).toBe(1)
    expect(p.within).toBeCloseTo(0.5)
    expect(p.seconds).toBeCloseTo(20)
  })

  it('clamps scroll outside the section', () => {
    expect(playhead(-0.3, durations).seconds).toBe(0)
    expect(playhead(1.7, durations).seconds).toBe(60)
  })
})

describe('timecode', () => {
  it('formats minutes and seconds', () => {
    expect(timecode(0)).toBe('00:00')
    expect(timecode(83.9)).toBe('01:23')
    expect(timecode(-4)).toBe('00:00')
  })
})
