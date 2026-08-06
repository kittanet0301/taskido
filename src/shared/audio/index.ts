export {
  AUDIO_MUTE_STORAGE_KEY,
  getAllSfxIds,
  getCurrentBgmTrack,
  isMuted,
  pauseBgm,
  playSfx,
  setBgmTrack,
  setMuted,
  soundManager,
  stopBgm,
  toggleMuted,
  unlockAudio
} from './soundManager'
export type { PlaySfxOptions } from './soundManager'
export { SFX_IDS, type SfxId } from './soundIds'
export { BGM_IDS, type BgmId } from './musicIds'
export { elementPitchMultiplier } from './elementPitch'
