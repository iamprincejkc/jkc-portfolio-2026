import { describe, expect, it } from 'vitest'
import { usableIceServers } from './evently-ice'

describe('usableIceServers', () => {
  it('keeps STUN and TURN entries with their credentials', () => {
    const servers = usableIceServers({
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        {
          urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
          username: 'u',
          credential: 'c',
        },
      ],
    })
    expect(servers).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' },
    ])
  })

  it('drops port 53, which browsers block, and anything that is not an ICE URL', () => {
    const servers = usableIceServers({
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:53', 'turn:turn.cloudflare.com:53?transport=udp', 'turn:turn.cloudflare.com:3478?transport=udp'] },
        { urls: 'https://example.com' },
        { urls: 42 },
        null,
      ],
    })
    expect(servers).toEqual([{ urls: ['turn:turn.cloudflare.com:3478?transport=udp'] }])
  })

  it('returns nothing for a malformed response', () => {
    expect(usableIceServers(null)).toEqual([])
    expect(usableIceServers({ iceServers: 'nope' })).toEqual([])
  })
})
