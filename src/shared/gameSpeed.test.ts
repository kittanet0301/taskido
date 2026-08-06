import { afterEach, describe, expect, it } from 'vitest'
import {
  getAdultMinHours,
  getBreedCooldownMs,
  getClicksPerDev,
  getDevPointsAdult,
  getDevPointsHatch,
  getKeysPerDev,
  getMaxDevPerHour
} from './constants'
import { setGameSpeedMultiplier } from './gameSpeed'

describe('global game speed multiplier', () => {
  afterEach(() => setGameSpeedMultiplier(1))

  it.each([1, 4, 8, 16, 32, 64] as const)('applies x%s to every progress rule', (multiplier) => {
    setGameSpeedMultiplier(multiplier)
    expect(getDevPointsHatch()).toBe(100 / multiplier)
    expect(getDevPointsAdult()).toBe(500 / multiplier)
    expect(getAdultMinHours()).toBe(48 / multiplier)
    expect(getClicksPerDev()).toBe(100 / multiplier)
    expect(getKeysPerDev()).toBe(500 / multiplier)
    expect(getMaxDevPerHour()).toBe(10 * multiplier)
    expect(getBreedCooldownMs()).toBe((6 * 60 * 60 * 1000) / multiplier)
  })
})
