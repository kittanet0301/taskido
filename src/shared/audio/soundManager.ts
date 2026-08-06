import { ChiptuneSequencer } from './chiptuneSequencer'
import { ChiptuneSynth } from './chiptuneSynth'
import { elementPitchMultiplier } from './elementPitch'
import type { BgmId } from './musicIds'
import { getMusicTrack } from './musicTracks'
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
  private sequencer: ChiptuneSequencer | null = null
  private muted = readStoredMute()
  private unlocked = false
  private unlockListenerAttached = false
  private readonly muteListeners = new Set<MuteListener>()
  private currentBgmTrack: BgmId | null = null
  private bgmPausedByMute = false

  constructor() {
    this.ensureUnlockListener()
  }

  isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    const wasMuted = this.muted
    this.muted = muted
    writeStoredMute(muted)
    for (const listener of this.muteListeners) listener(muted)

    this.sequencer?.setVolume(muted ? 0 : 1)

    if (muted && !wasMuted) {
      this.pauseBgmForMute()
    } else if (!muted && wasMuted) {
      this.resumeBgmAfterMute()
    }
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
    if (this.unlocked && this.currentBgmTrack && !this.muted) {
      this.startBgmPlayback(this.currentBgmTrack)
    }
    return this.unlocked
  }

  setBgmTrack(id: BgmId | null): void {
    if (
      id === this.currentBgmTrack
      && this.sequencer?.isPlaying()
      && !this.bgmPausedByMute
    ) {
      return
    }

    const previous = this.currentBgmTrack
    this.currentBgmTrack = id

    if (!id || typeof window === 'undefined') {
      this.stopBgmPlayback()
      return
    }

    if (previous !== id) {
      this.stopBgmPlayback(false)
    }

    if (this.muted) {
      return
    }

    if (!this.unlocked) {
      return
    }

    this.startBgmPlayback(id)
  }

  stopBgm(): void {
    this.currentBgmTrack = null
    this.stopBgmPlayback()
  }

  /** Stop playback without clearing the selected track (e.g. login/onboarding screens). */
  pauseBgm(): void {
    this.stopBgmPlayback()
  }

  getCurrentBgmTrack(): BgmId | null {
    return this.currentBgmTrack
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

  private startBgmPlayback(id: BgmId): void {
    void this.startBgmPlaybackAsync(id)
  }

  private async startBgmPlaybackAsync(id: BgmId): Promise<void> {
    const ctx = this.getContext()
    const sequencer = this.getSequencer()
    if (!ctx || !sequencer) return
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }
    if (this.currentBgmTrack !== id || this.muted || !this.unlocked) return
    this.bgmPausedByMute = false
    sequencer.setVolume(1)
    sequencer.start(getMusicTrack(id))
  }

  private stopBgmPlayback(fade = true): void {
    this.sequencer?.stop(fade)
    this.bgmPausedByMute = false
  }

  private pauseBgmForMute(): void {
    if (!this.sequencer?.isPlaying()) return
    this.bgmPausedByMute = true
    this.sequencer.pause()
  }

  private resumeBgmAfterMute(): void {
    if (!this.currentBgmTrack || !this.unlocked) return
    const sequencer = this.getSequencer()
    if (!sequencer) return
    this.bgmPausedByMute = false
    sequencer.resume(getMusicTrack(this.currentBgmTrack))
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

  private getSequencer(): ChiptuneSequencer | null {
    const ctx = this.getContext()
    if (!ctx) return null
    if (!this.sequencer) this.sequencer = new ChiptuneSequencer(ctx)
    return this.sequencer
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

export function setBgmTrack(id: BgmId | null): void {
  soundManager.setBgmTrack(id)
}

export function stopBgm(): void {
  soundManager.stopBgm()
}

export function pauseBgm(): void {
  soundManager.pauseBgm()
}

export function getCurrentBgmTrack(): BgmId | null {
  return soundManager.getCurrentBgmTrack()
}

/** @internal test helper */
export function __resetSoundManagerForTests(muted = false): void {
  soundManager.stopBgm()
  soundManager.setMuted(muted)
}
