import { describe, expect, it } from 'vitest'
import { dinoAnimationTick, DINO_ANIM_FPS } from './dinoTiming'

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
})
