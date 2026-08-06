/** Global boost for one-shot SFX peak gain. */
export const SFX_OUTPUT_GAIN = 1.55

/** BGM master-bus boost (track masterGain values are intentionally low). */
export const BGM_BUS_GAIN = 2

/** Per-note gain inside the BGM sequencer before the master bus. */
export const BGM_NOTE_GAIN = 0.42

/** Hard ceiling for Web Audio peak gain to limit clipping. */
export const AUDIO_PEAK_LIMIT = 0.48
