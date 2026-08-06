import type { SfxId } from './soundIds'

export type WaveType = 'square' | 'triangle' | 'sawtooth' | 'noise'

export interface ToneStep {
  freq: number
  duration?: number
}

export interface SoundPreset {
  wave?: WaveType
  freq?: number
  freqEnd?: number
  duration?: number
  attack?: number
  decay?: number
  sustain?: number
  release?: number
  gain?: number
  sequence?: ToneStep[]
  noteDuration?: number
}

export const SOUND_PRESETS: Record<SfxId, SoundPreset> = {
  ui_click: { wave: 'triangle', freq: 880, duration: 0.04, gain: 0.12 },
  ui_confirm: { wave: 'square', freq: 660, duration: 0.06, gain: 0.14, freqEnd: 880 },
  ui_cancel: { wave: 'triangle', freq: 440, duration: 0.08, gain: 0.1, freqEnd: 330 },
  ui_tab: { wave: 'triangle', freq: 740, duration: 0.05, gain: 0.11 },
  ui_error: { wave: 'square', freq: 220, duration: 0.12, gain: 0.15, freqEnd: 180 },
  title_start: {
    wave: 'square',
    sequence: [
      { freq: 523, duration: 0.08 },
      { freq: 659, duration: 0.08 },
      { freq: 784, duration: 0.12 }
    ],
    noteDuration: 0.08,
    gain: 0.16
  },
  care_eat: { wave: 'triangle', freq: 520, duration: 0.1, gain: 0.13, freqEnd: 620 },
  care_drink: { wave: 'triangle', freq: 680, duration: 0.08, gain: 0.11, freqEnd: 820 },
  care_medicine: { wave: 'square', freq: 440, duration: 0.14, gain: 0.12, freqEnd: 660 },
  care_toy: { wave: 'square', freq: 880, duration: 0.06, gain: 0.13, freqEnd: 1100 },
  care_happy: {
    wave: 'square',
    sequence: [
      { freq: 523 },
      { freq: 659 },
      { freq: 784 }
    ],
    noteDuration: 0.07,
    gain: 0.14
  },
  level_up: {
    wave: 'square',
    sequence: [
      { freq: 523 },
      { freq: 659 },
      { freq: 784 },
      { freq: 988 }
    ],
    noteDuration: 0.1,
    gain: 0.16
  },
  evolve: {
    wave: 'square',
    sequence: [
      { freq: 392 },
      { freq: 523 },
      { freq: 659 },
      { freq: 784 },
      { freq: 988 }
    ],
    noteDuration: 0.09,
    gain: 0.17
  },
  hatch: {
    wave: 'square',
    sequence: [
      { freq: 440 },
      { freq: 554 },
      { freq: 659 },
      { freq: 880 }
    ],
    noteDuration: 0.11,
    gain: 0.18
  },
  battle_windup: { wave: 'triangle', freq: 280, duration: 0.1, gain: 0.1, freqEnd: 420 },
  battle_travel: { wave: 'noise', freq: 600, duration: 0.12, gain: 0.08, freqEnd: 200 },
  battle_impact: { wave: 'square', freq: 440, duration: 0.09, gain: 0.18, freqEnd: 110 },
  battle_recover: { wave: 'triangle', freq: 330, duration: 0.07, gain: 0.08, freqEnd: 220 },
  battle_guard: { wave: 'square', freq: 220, duration: 0.12, gain: 0.14 },
  battle_dodge: { wave: 'triangle', freq: 880, duration: 0.06, gain: 0.1, freqEnd: 1320 },
  battle_heal: {
    wave: 'triangle',
    sequence: [
      { freq: 440 },
      { freq: 554 },
      { freq: 659 }
    ],
    noteDuration: 0.08,
    gain: 0.12
  },
  battle_flee: { wave: 'triangle', freq: 660, duration: 0.14, gain: 0.1, freqEnd: 440 },
  battle_ko: { wave: 'square', freq: 180, duration: 0.2, gain: 0.2, freqEnd: 80 },
  battle_win: {
    wave: 'square',
    sequence: [
      { freq: 523 },
      { freq: 659 },
      { freq: 784 },
      { freq: 988 },
      { freq: 1175 }
    ],
    noteDuration: 0.1,
    gain: 0.18
  },
  battle_lose: {
    wave: 'square',
    sequence: [
      { freq: 392 },
      { freq: 349 },
      { freq: 294 },
      { freq: 220 }
    ],
    noteDuration: 0.14,
    gain: 0.16
  },
  jump: { wave: 'triangle', freq: 440, duration: 0.05, gain: 0.1, freqEnd: 660 },
  land: { wave: 'triangle', freq: 220, duration: 0.04, gain: 0.08 },
  minigame_hit: { wave: 'square', freq: 160, duration: 0.15, gain: 0.18, freqEnd: 90 },
  minigame_over: {
    wave: 'square',
    sequence: [
      { freq: 330 },
      { freq: 262 },
      { freq: 196 }
    ],
    noteDuration: 0.16,
    gain: 0.17
  },
  collect: { wave: 'square', freq: 988, duration: 0.06, gain: 0.13, freqEnd: 1318 },
  market_buy: {
    wave: 'square',
    sequence: [
      { freq: 659 },
      { freq: 880 }
    ],
    noteDuration: 0.07,
    gain: 0.13
  },
  item_use: { wave: 'triangle', freq: 740, duration: 0.07, gain: 0.11, freqEnd: 880 },
  breed: {
    wave: 'square',
    sequence: [
      { freq: 440 },
      { freq: 554 },
      { freq: 659 },
      { freq: 880 }
    ],
    noteDuration: 0.08,
    gain: 0.15
  },
  release: { wave: 'triangle', freq: 440, duration: 0.16, gain: 0.1, freqEnd: 220 },
  mission_claim: {
    wave: 'square',
    sequence: [
      { freq: 523 },
      { freq: 784 },
      { freq: 988 }
    ],
    noteDuration: 0.09,
    gain: 0.15
  },
  chat_dash: { wave: 'noise', freq: 500, duration: 0.06, gain: 0.06, freqEnd: 900 },
  chat_bite: { wave: 'square', freq: 320, duration: 0.05, gain: 0.1, freqEnd: 180 },
  egg_notify: {
    wave: 'square',
    sequence: [
      { freq: 784 },
      { freq: 988 }
    ],
    noteDuration: 0.08,
    gain: 0.14
  },
  notification_pop: { wave: 'triangle', freq: 880, duration: 0.05, gain: 0.1, freqEnd: 1100 }
}
