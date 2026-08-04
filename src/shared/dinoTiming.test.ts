import { describe, expect, it } from 'vitest'
import {
  dinoAnimationTick,
  DINO_ANIM_FPS,
  DINO_FRAMES_PER_SPRITE_FRAME,
  DINO_SPRITE_FPS,
  DINO_SPRITE_FRAME_MS,
  hatchAnimMsForFrameCount
} from './dinoTiming'

describe('dinoAnimationTick', () => {
  it('uses elapsed time instead of render callback count', () => {
    expect(dinoAnimationTick(0)).toBe(0)
    expect(dinoAnimationTick(500)).toBe(DINO_ANIM_FPS / 2)
    expect(dinoAnimationTick(1000)).toBe(DINO_ANIM_FPS)
  })

  it('is stable for invalid or negative elapsed time', () => {
    expect(dinoAnimationTick(-100)).toBe(0)
    expect(dinoAnimationTick(Number.NaN)).toBe(0)
    expect(dinoAnimationTick(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('plays authored creature frames at three frames per second', () => {
    expect(DINO_SPRITE_FPS).toBe(3)
    expect(DINO_SPRITE_FRAME_MS).toBeCloseTo(1000 / 3)
    expect(DINO_FRAMES_PER_SPRITE_FRAME).toBe(20)
  })

  it('derives hatch duration from the same smooth frame rate', () => {
    expect(hatchAnimMsForFrameCount(6)).toBeCloseTo(2000)
  })
})
