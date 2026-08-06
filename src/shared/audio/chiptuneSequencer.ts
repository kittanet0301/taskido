import type { WaveType } from './soundPresets'
import { AUDIO_PEAK_LIMIT, BGM_BUS_GAIN, BGM_NOTE_GAIN } from './audioLevels'
import type { MusicChannel, MusicStep, MusicTrack } from './musicTracks'
import { trackTotalBeats } from './musicTracks'

const LOOKAHEAD_SEC = 0.2
const TICK_MS = 25
const MAX_BGM_VOICES = 6
const CROSSFADE_SEC = 0.4

interface BeatEvent {
  beat: number
  channel: MusicChannel
  step: MusicStep
}

export class ChiptuneSequencer {
  private readonly masterGain: GainNode
  private timer: ReturnType<typeof setInterval> | null = null
  private track: MusicTrack | null = null
  private events: BeatEvent[] = []
  private loopEpoch = 0
  private scheduledKeys = new Set<string>()
  private activeVoices = 0
  private paused = false
  private targetGain = 0
  private volumeMultiplier = 1

  constructor(private readonly context: AudioContext) {
    this.masterGain = context.createGain()
    this.masterGain.gain.value = 0
    this.masterGain.connect(context.destination)
  }

  isPlaying(): boolean {
    return this.track != null && this.timer != null
  }

  getTargetGain(): number {
    return this.targetGain * this.volumeMultiplier * BGM_BUS_GAIN
  }

  setVolume(multiplier: number): void {
    this.volumeMultiplier = Math.max(0, Math.min(1, multiplier))
    this.applyMasterGain(this.paused || this.volumeMultiplier <= 0 ? 0.0001 : this.targetGain * this.volumeMultiplier * BGM_BUS_GAIN)
  }

  start(track: MusicTrack): void {
    this.stop(false)
    this.track = track
    this.targetGain = track.masterGain
    this.events = buildBeatEvents(track)
    this.loopEpoch = this.context.currentTime + 0.05
    this.scheduledKeys.clear()
    this.paused = false
    this.applyMasterGain(this.targetGain * this.volumeMultiplier * BGM_BUS_GAIN)
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  stop(fade = true): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    const now = this.context.currentTime
    if (fade) {
      this.masterGain.gain.cancelScheduledValues(now)
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now)
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_SEC)
    } else {
      this.masterGain.gain.cancelScheduledValues(now)
      this.masterGain.gain.setValueAtTime(0.0001, now)
    }
    this.track = null
    this.events = []
    this.scheduledKeys.clear()
    this.targetGain = 0
  }

  pause(): void {
    this.paused = true
    const now = this.context.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now)
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.2)
  }

  resume(track: MusicTrack): void {
    if (!this.track) {
      this.start(track)
      return
    }
    this.paused = false
    this.targetGain = track.masterGain
    this.loopEpoch = this.context.currentTime + 0.05
    this.scheduledKeys.clear()
    this.applyMasterGain(this.targetGain * this.volumeMultiplier * BGM_BUS_GAIN)
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), TICK_MS)
    }
  }

  private applyMasterGain(value: number): void {
    const now = this.context.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now)
    this.masterGain.gain.linearRampToValueAtTime(Math.max(0.0001, value), now + CROSSFADE_SEC)
  }

  private tick(): void {
    if (!this.track || this.paused) return
    const totalBeats = trackTotalBeats(this.track)
    const beatSec = 60 / this.track.bpm
    const loopDuration = totalBeats * beatSec
    const now = this.context.currentTime
    const scheduleEnd = now + LOOKAHEAD_SEC

    for (const event of this.events) {
      if (event.step.freq == null) continue

      const beatOffset = event.beat * beatSec
      let startAt = this.loopEpoch + beatOffset
      while (startAt < now - 0.01) {
        startAt += loopDuration
      }
      if (startAt > scheduleEnd) continue

      const key = `${startAt.toFixed(4)}:${event.channel.wave}:${event.step.freq}`
      if (this.scheduledKeys.has(key)) continue
      this.scheduledKeys.add(key)

      this.scheduleNote(event.channel, event.step, startAt, beatSec)
    }

    if (this.scheduledKeys.size > 512) {
      this.scheduledKeys.clear()
    }
  }

  private scheduleNote(channel: MusicChannel, step: MusicStep, startAt: number, beatSec: number): void {
    if (this.activeVoices >= MAX_BGM_VOICES || step.freq == null) return
    const duration = Math.max(0.04, step.beats * beatSec * 0.92)
    const peak = Math.max(0.0001, Math.min(AUDIO_PEAK_LIMIT, channel.gain * BGM_NOTE_GAIN))

    const gainNode = this.context.createGain()
    gainNode.connect(this.masterGain)
    gainNode.gain.setValueAtTime(0.0001, startAt)
    gainNode.gain.exponentialRampToValueAtTime(peak, startAt + 0.008)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

    this.activeVoices += 1
    const cleanup = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1)
    }

    if (channel.wave === 'noise') {
      const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1
      }
      const source = this.context.createBufferSource()
      source.buffer = buffer
      const filter = this.context.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(step.freq, startAt)
      source.connect(filter)
      filter.connect(gainNode)
      source.start(startAt)
      source.stop(startAt + duration + 0.02)
      source.onended = cleanup
      return
    }

    const osc = this.context.createOscillator()
    osc.type = channel.wave as OscillatorType
    osc.frequency.setValueAtTime(Math.max(20, step.freq), startAt)
    osc.connect(gainNode)
    osc.start(startAt)
    osc.stop(startAt + duration + 0.02)
    osc.onended = cleanup
  }
}

function buildBeatEvents(track: MusicTrack): BeatEvent[] {
  const events: BeatEvent[] = []
  for (const channel of track.channels) {
    let beat = 0
    for (const step of channel.pattern) {
      events.push({ beat, channel, step })
      beat += step.beats
    }
  }
  return events.sort((a, b) => a.beat - b.beat)
}

export { CROSSFADE_SEC, buildBeatEvents }
