import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BGM_IDS } from './musicIds'
import {
  channelPatternBeats,
  getMusicTrack,
  MUSIC_TRACKS,
  trackTotalBeats
} from './musicTracks'
import {
  AUDIO_MUTE_STORAGE_KEY,
  __resetSoundManagerForTests,
  getCurrentBgmTrack,
  setBgmTrack,
  setMuted,
  stopBgm
} from './soundManager'

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  const mock = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    }
  }
  Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true })
}

describe('musicManager', () => {
  beforeEach(() => {
    installLocalStorageMock()
  })

  afterEach(() => {
    stopBgm()
    __resetSoundManagerForTests(false)
    localStorage.removeItem(AUDIO_MUTE_STORAGE_KEY)
  })

  it('exposes every bgm id in the track catalog without duplicates', () => {
    expect(BGM_IDS).toEqual(['title', 'hub', 'battle', 'minigame'])
    expect(new Set(BGM_IDS).size).toBe(BGM_IDS.length)
    for (const id of BGM_IDS) {
      expect(MUSIC_TRACKS[id]).toBeDefined()
      expect(getMusicTrack(id)).toBe(MUSIC_TRACKS[id])
    }
  })

  it('aligns every channel pattern to the track loop length', () => {
    for (const id of BGM_IDS) {
      const track = getMusicTrack(id)
      const total = trackTotalBeats(track)
      expect(total).toBeGreaterThan(0)
      for (const channel of track.channels) {
        expect(channelPatternBeats(channel.pattern)).toBe(total)
      }
    }
  })

  it('does not throw when setting bgm while muted', () => {
    setMuted(true)
    expect(() => setBgmTrack('hub')).not.toThrow()
    expect(getCurrentBgmTrack()).toBe('hub')
  })

  it('stores and clears the current bgm track id', () => {
    setBgmTrack('battle')
    expect(getCurrentBgmTrack()).toBe('battle')
    stopBgm()
    expect(getCurrentBgmTrack()).toBeNull()
  })
})
