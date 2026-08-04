/** Assumed requestAnimationFrame rate for sprite timing math. */
export const DINO_ANIM_FPS = 60
/** Creature strip playback rate. Three FPS gives the pixel animation a deliberate, readable cadence. */
export const DINO_SPRITE_FPS = 3
/** Duration each sprite strip frame stays on screen. */
export const DINO_SPRITE_FRAME_MS = 1000 / DINO_SPRITE_FPS

/**
 * Convert real elapsed time to the legacy 60 Hz animation clock.
 * Sprite playback must not use requestAnimationFrame call counts because the
 * callback rate varies by display, throttling state, and concurrent RAF loops.
 */
export function dinoAnimationTick(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  return Math.floor((elapsedMs / 1000) * DINO_ANIM_FPS)
}

export const DINO_FRAMES_PER_SPRITE_FRAME = Math.max(
  1,
  Math.round((DINO_SPRITE_FRAME_MS / 1000) * DINO_ANIM_FPS)
)
export const DINO_HATCH_FRAMES_PER_SPRITE_FRAME = DINO_FRAMES_PER_SPRITE_FRAME

/** Global slowdown for bob / mood cycles (not per-frame sprite timing). */
export const DINO_SPEED = 16

export const DINO_BOB_PERIOD_EGG = 8 * DINO_SPEED
export const DINO_BOB_PERIOD = 10 * DINO_SPEED
/** Walk pixels per tick — scale with faster sprite frames so stride distance stays natural. */
const LEGACY_FRAMES_PER_SPRITE_FRAME = 6 * DINO_SPEED
export const DINO_WALK_SPEED =
  (1.2 / DINO_SPEED) * (LEGACY_FRAMES_PER_SPRITE_FRAME / DINO_FRAMES_PER_SPRITE_FRAME)

/** Longest hatch strip in the project (creature egg hatch). */
export const DINO_HATCH_CLIP_FRAMES = 6
export const DINO_HATCH_CLIP_TICKS = DINO_HATCH_CLIP_FRAMES * DINO_HATCH_FRAMES_PER_SPRITE_FRAME

/** Hatch sprite playback duration from per-frame timing. */
export function hatchAnimMsForFrameCount(frameCount: number): number {
  return frameCount * DINO_SPRITE_FRAME_MS
}

export const DINO_HATCH_ANIM_MS = hatchAnimMsForFrameCount(DINO_HATCH_CLIP_FRAMES)

/** Hold on the final hatch frame before transitioning to baby. */
export const DINO_HATCH_POST_DELAY_MS = 4000

export const DINO_HATCH_POST_DELAY_TICKS = Math.round(
  (DINO_HATCH_POST_DELAY_MS / 1000) * DINO_ANIM_FPS
)

export function hatchWaitMsForFrameCount(frameCount: number): number {
  return hatchAnimMsForFrameCount(frameCount) + DINO_HATCH_POST_DELAY_MS
}

/** @deprecated Use DINO_HATCH_ANIM_MS or hatchAnimMsForFrameCount */
export const DINO_HATCH_MS = DINO_HATCH_ANIM_MS

export const DINO_HAPPY_CYCLE = 120 * DINO_SPEED
export const DINO_HAPPY_BURST = 30 * DINO_SPEED
