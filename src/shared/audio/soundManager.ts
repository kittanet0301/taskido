import { ChiptuneSynth } from './chiptuneSynth'
import { elementPitchMultiplier } from './elementPitch'
import { SOUND_PRESETS } from './soundPresets'
import { SFX_IDS, type SfxId } from './soundIds'

export const AUDIO_MUTE_STORAGE_KEY = 'taskino-audio-muted'

export interface PlaySfxOptions {
  pitchMultiplier?: number
  element?: string | null
}

type MuteListener = (muted: boolean) => void

function readStoredMute(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(AUDIO_MUTE_STORAGE_KEY) === '1'
}

function writeStoredMute(muted: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AUDIO_MUTE_STORAGE_KEY, muted ? '1' : '0')
}

class SoundManager {
  private context: AudioContext | null = null
  private synth: ChiptuneSynth | null = null
  private muted = readStoredMute()
  private unlocked = false
  private unlockListenerAttached = false
  private readonly muteListeners = new Set<MuteListener>()

  isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    writeStoredMute(muted)
    for (const listener of this.muteListeners) listener(muted)
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  subscribeMute(listener: MuteListener): () => void {
    this.muteListeners.add(listener)
    return () => this.muteListeners.delete(listener)
  }

  isUnlocked(): boolean {
    return this.unlocked
  }

  async unlock(): Promise<boolean> {
    if (typeof window === 'undefined') return false
    this.ensureUnlockListener()
    const ctx = this.getContext()
    if (!ctx) return false
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return false
      }
    }
    this.unlocked = ctx.state === 'running'
    return this.unlocked
  }

  playSfx(id: SfxId, options: PlaySfxOptions = {}): void {
    if (this.muted) return
    if (typeof window === 'undefined') return
    const preset = SOUND_PRESETS[id]
    if (!preset) return
    const ctx = this.getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const synth = this.getSynth()
    if (!synth) return
    const elementPitch = elementPitchMultiplier(options.element)
    const pitchMultiplier = (options.pitchMultiplier ?? 1) * elementPitch
    synth.playPreset(preset, pitchMultiplier)
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.context) {
      const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      this.context = new Ctx()
    }
    return this.context
  }

  private getSynth(): ChiptuneSynth | null {
    const ctx = this.getContext()
    if (!ctx) return null
    if (!this.synth) this.synth = new ChiptuneSynth(ctx)
    return this.synth
  }

  private ensureUnlockListener(): void {
    if (this.unlockListenerAttached || typeof document === 'undefined') return
    this.unlockListenerAttached = true
    const tryUnlock = () => {
      void this.unlock()
    }
    document.addEventListener('pointerdown', tryUnlock, { once: true })
    document.addEventListener('keydown', tryUnlock, { once: true })
  }
}

export const soundManager = new SoundManager()

export function isMuted(): boolean {
  return soundManager.isMuted()
}

export function setMuted(muted: boolean): void {
  soundManager.setMuted(muted)
}

export function toggleMuted(): boolean {
  return soundManager.toggleMuted()
}

export function unlockAudio(): Promise<boolean> {
  return soundManager.unlock()
}

export function playSfx(id: SfxId, options?: PlaySfxOptions): void {
  soundManager.playSfx(id, options)
}

export function getAllSfxIds(): readonly SfxId[] {
  return SFX_IDS
}

/** @internal test helper */
export function __resetSoundManagerForTests(muted = false): void {
  soundManager.setMuted(muted)
}
