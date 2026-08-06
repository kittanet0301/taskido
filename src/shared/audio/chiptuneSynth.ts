import type { SoundPreset, ToneStep, WaveType } from './soundPresets'
import { AUDIO_PEAK_LIMIT, SFX_OUTPUT_GAIN } from './audioLevels'

const MAX_VOICES = 8

export class ChiptuneSynth {
  private readonly context: AudioContext
  private activeVoices = 0

  constructor(context: AudioContext) {
    this.context = context
  }

  playPreset(preset: SoundPreset, pitchMultiplier = 1): void {
    if (this.activeVoices >= MAX_VOICES) return
    if (preset.sequence?.length) {
      this.playSequence(preset, pitchMultiplier)
      return
    }
    this.playTone(preset, pitchMultiplier)
  }

  private playSequence(preset: SoundPreset, pitchMultiplier: number): void {
    const steps = preset.sequence ?? []
    const noteDuration = preset.noteDuration ?? 0.08
    const gain = preset.gain ?? 0.14
    const wave = preset.wave ?? 'square'
    let offset = 0
    for (const step of steps) {
      const duration = step.duration ?? noteDuration
      this.scheduleTone(
        {
          wave,
          freq: step.freq * pitchMultiplier,
          duration,
          attack: 0.005,
          decay: duration * 0.85,
          gain
        },
        offset
      )
      offset += duration * 0.92
    }
  }

  private playTone(preset: SoundPreset, pitchMultiplier: number): void {
    const freq = (preset.freq ?? 440) * pitchMultiplier
    const freqEnd = preset.freqEnd != null ? preset.freqEnd * pitchMultiplier : undefined
    this.scheduleTone(
      {
        wave: preset.wave ?? 'square',
        freq,
        freqEnd,
        duration: preset.duration ?? 0.08,
        attack: preset.attack ?? 0.005,
        decay: preset.decay ?? (preset.duration ?? 0.08) * 0.7,
        sustain: preset.sustain,
        release: preset.release,
        gain: preset.gain ?? 0.14
      },
      0
    )
  }

  private scheduleTone(
    tone: {
      wave: WaveType
      freq: number
      freqEnd?: number
      duration: number
      attack: number
      decay: number
      sustain?: number
      release?: number
      gain: number
    },
    startOffset: number
  ): void {
    const ctx = this.context
    const startAt = ctx.currentTime + startOffset
    const release = tone.release ?? 0.02
    const sustainLevel = tone.sustain ?? 0
    const gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)

    const peak = Math.max(0.001, Math.min(AUDIO_PEAK_LIMIT, tone.gain * SFX_OUTPUT_GAIN))
    gainNode.gain.setValueAtTime(0.0001, startAt)
    gainNode.gain.exponentialRampToValueAtTime(peak, startAt + tone.attack)
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peak * sustainLevel),
      startAt + tone.attack + tone.decay
    )
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration + release)

    this.activeVoices += 1
    const cleanup = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1)
    }

    if (tone.wave === 'noise') {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * tone.duration), ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(tone.freq, startAt)
      if (tone.freqEnd != null) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, tone.freqEnd), startAt + tone.duration)
      }
      source.connect(filter)
      filter.connect(gainNode)
      source.start(startAt)
      source.stop(startAt + tone.duration + release + 0.02)
      source.onended = cleanup
      return
    }

    const osc = ctx.createOscillator()
    osc.type = tone.wave
    osc.frequency.setValueAtTime(Math.max(20, tone.freq), startAt)
    if (tone.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.freqEnd), startAt + tone.duration)
    }
    osc.connect(gainNode)
    osc.start(startAt)
    osc.stop(startAt + tone.duration + release + 0.02)
    osc.onended = cleanup
  }
}

export function applyPitchToSteps(steps: ToneStep[], multiplier: number): ToneStep[] {
  return steps.map((step) => ({ ...step, freq: step.freq * multiplier }))
}
