import type { PetSpecies } from './types'
import { CREATURE_PREVIEW_COLORS } from './creatureCharacters'
import { getGameSpeedMultiplier } from './gameSpeed'

export const SAVE_VERSION = 7

export const PET_SLOT_BASE = 5
export const PET_SLOT_MAX = 36
export const PET_SLOTS_PER_PAGE = 12
export const WEEKLY_SLOT_REWARD = 5
export const QUICK_ITEM_SLOT_COUNT = 6

export function getDevPointsHatch(): number {
  return DEV_POINTS_HATCH / getGameSpeedMultiplier()
}
export function getDevPointsAdult(): number {
  return DEV_POINTS_ADULT / getGameSpeedMultiplier()
}
export function getAdultMinHours(): number {
  return ADULT_MIN_HOURS / getGameSpeedMultiplier()
}
export function getClicksPerDev(): number {
  return CLICKS_PER_DEV / getGameSpeedMultiplier()
}
export function getKeysPerDev(): number {
  return KEYS_PER_DEV / getGameSpeedMultiplier()
}
export function getMaxDevPerHour(): number {
  return MAX_DEV_PER_HOUR * getGameSpeedMultiplier()
}

/** Cooldown before a bred pet can breed again. */
export function getBreedCooldownMs(): number {
  return BREED_COOLDOWN_MS / getGameSpeedMultiplier()
}

/** Normal (non-admin) defaults — prefer getters for runtime checks. */
export const DEV_POINTS_HATCH = 100
export const DEV_POINTS_ADULT = 500
export const ADULT_MIN_HOURS = 48
export const CLICKS_PER_DEV = 100
export const KEYS_PER_DEV = 500
export const MAX_DEV_PER_HOUR = 10
export const BREED_COOLDOWN_MS = 6 * 60 * 60 * 1000

/** Extra pure-element chance bonus when both parents are pure of the same element. */
export const BREED_PURE_BONUS = 0.05

export { CREATURE_PREVIEW_COLORS }

export function petPreviewColor(species: PetSpecies): string {
  return CREATURE_PREVIEW_COLORS[species]
}
