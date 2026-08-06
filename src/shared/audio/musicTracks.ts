import type { WaveType } from './soundPresets'
import type { BgmId } from './musicIds'

export interface MusicStep {
  freq: number | null
  beats: number
}

export interface MusicChannel {
  wave: WaveType
  gain: number
  pattern: MusicStep[]
}

export interface MusicTrack {
  bpm: number
  beatsPerBar: number
  bars: number
  masterGain: number
  channels: MusicChannel[]
}

export function trackTotalBeats(track: MusicTrack): number {
  return track.beatsPerBar * track.bars
}

export function channelPatternBeats(pattern: MusicStep[]): number {
  return pattern.reduce((sum, step) => sum + step.beats, 0)
}

function rest(beats: number): MusicStep {
  return { freq: null, beats }
}

function note(freq: number, beats: number): MusicStep {
  return { freq, beats }
}

function repeatPattern(pattern: MusicStep[], times: number): MusicStep[] {
  const out: MusicStep[] = []
  for (let i = 0; i < times; i += 1) out.push(...pattern)
  return out
}

const C4 = 262
const D4 = 294
const E4 = 330
const G4 = 392
const A4 = 440
const C5 = 523
const D5 = 587
const E5 = 659
const G5 = 784
const C3 = 131
const G2 = 98
const A2 = 110
const E2 = 82

const TITLE_TRACK: MusicTrack = {
  bpm: 90,
  beatsPerBar: 4,
  bars: 4,
  masterGain: 0.14,
  channels: [
    {
      wave: 'triangle',
      gain: 0.55,
      pattern: [
        note(C4, 1), note(E4, 1), note(G4, 1), note(C5, 1),
        note(G4, 1), note(E4, 1), note(C4, 1), rest(1),
        note(E4, 1), note(G4, 1), note(C5, 1), note(E5, 1),
        note(C5, 1), note(G4, 1), note(E4, 1), rest(1)
      ]
    },
    {
      wave: 'square',
      gain: 0.25,
      pattern: repeatPattern([note(C3, 2), rest(2), note(G2, 2), rest(2)], 2)
    }
  ]
}

const HUB_TRACK: MusicTrack = {
  bpm: 110,
  beatsPerBar: 4,
  bars: 8,
  masterGain: 0.15,
  channels: [
    {
      wave: 'triangle',
      gain: 0.5,
      pattern: repeatPattern([
        note(E4, 1), note(G4, 1), note(C5, 1), note(G4, 1),
        note(E4, 1), note(D4, 1), note(C4, 2)
      ], 4)
    },
    {
      wave: 'square',
      gain: 0.3,
      pattern: repeatPattern([note(C3, 2), rest(2), note(G2, 2), rest(2)], 4)
    },
    {
      wave: 'noise',
      gain: 0.08,
      pattern: repeatPattern([note(1200, 0.5), rest(0.5), note(900, 0.5), rest(0.5)], 16)
    }
  ]
}

const BATTLE_TRACK: MusicTrack = {
  bpm: 140,
  beatsPerBar: 4,
  bars: 4,
  masterGain: 0.16,
  channels: [
    {
      wave: 'square',
      gain: 0.45,
      pattern: repeatPattern([
        note(E5, 0.5), note(G5, 0.5), note(E5, 0.5), note(C5, 0.5),
        note(D5, 1), note(E5, 1),
        note(G5, 0.5), note(E5, 0.5), note(D5, 0.5), note(C5, 0.5),
        note(A4, 1), note(G4, 1)
      ], 2)
    },
    {
      wave: 'square',
      gain: 0.35,
      pattern: repeatPattern([note(E2, 1), note(E2, 1), note(G2, 1), note(G2, 1)], 4)
    },
    {
      wave: 'noise',
      gain: 0.12,
      pattern: repeatPattern([note(800, 0.25), rest(0.25), note(600, 0.25), rest(0.25)], 16)
    }
  ]
}

const MINIGAME_TRACK: MusicTrack = {
  bpm: 130,
  beatsPerBar: 4,
  bars: 4,
  masterGain: 0.15,
  channels: [
    {
      wave: 'triangle',
      gain: 0.5,
      pattern: repeatPattern([
        note(C5, 0.5), note(E5, 0.5), note(G5, 0.5), note(C5, 0.5),
        note(A4, 1), note(G4, 1),
        note(G4, 0.5), note(A4, 0.5), note(C5, 0.5), note(G4, 0.5),
        note(E4, 1), note(D4, 1)
      ], 2)
    },
    {
      wave: 'square',
      gain: 0.28,
      pattern: repeatPattern([note(C3, 1), rest(1), note(G2, 1), rest(1)], 4)
    },
    {
      wave: 'noise',
      gain: 0.1,
      pattern: repeatPattern([note(1000, 0.5), rest(0.5), note(1000, 0.5), rest(0.5)], 8)
    }
  ]
}

export const MUSIC_TRACKS: Record<BgmId, MusicTrack> = {
  title: TITLE_TRACK,
  hub: HUB_TRACK,
  battle: BATTLE_TRACK,
  minigame: MINIGAME_TRACK
}

export function getMusicTrack(id: BgmId): MusicTrack {
  return MUSIC_TRACKS[id]
}
