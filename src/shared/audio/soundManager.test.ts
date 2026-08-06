import { afterEach, describe, expect, it } from 'vitest'
import { SOUND_PRESETS } from './soundPresets'
import { SFX_IDS } from './soundIds'
import {
  AUDIO_MUTE_STORAGE_KEY,
  __resetSoundManagerForTests,
  getAllSfxIds,
  isMuted,
  playSfx,
  setMuted,
  toggleMuted
} from './soundManager'

describe('soundManager', () => {
  afterEach(() => {
    __resetSoundManagerForTests(false)
    localStorage.removeItem(AUDIO_MUTE_STORAGE_KEY)
  })

  it('exposes every sfx id in the preset catalog without duplicates', () => {
    const ids = getAllSfxIds()
    expect(ids).toEqual(SFX_IDS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(SOUND_PRESETS[id]).toBeDefined()
    }
  })

  it('persists mute state in localStorage', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    expect(localStorage.getItem(AUDIO_MUTE_STORAGE_KEY)).toBe('1')
    setMuted(false)
    expect(isMuted()).toBe(false)
    expect(localStorage.getItem(AUDIO_MUTE_STORAGE_KEY)).toBe('0')
  })

  it('toggleMuted flips mute state', () => {
    expect(isMuted()).toBe(false)
    expect(toggleMuted()).toBe(true)
    expect(toggleMuted()).toBe(false)
  })

  it('does not throw when playing while muted', () => {
    setMuted(true)
    expect(() => playSfx('ui_click')).not.toThrow()
  })
})
