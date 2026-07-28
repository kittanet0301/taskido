import type { PetSpecies } from './types'
import { CREATURE_PREVIEW_COLORS } from './creatureCharacters'
import { getSessionIsAdmin } from './sessionFlags'

export const SAVE_VERSION = 7

export const PET_SLOT_BASE = 5
export const PET_SLOT_MAX = 36
export const PET_SLOTS_PER_PAGE = 12
export const WEEKLY_SLOT_REWARD = 5
export const QUICK_ITEM_SLOT_COUNT = 6

/**
 * When true, signed-in admins get fast hatch/evolve/breed timings.
 * Regular users always use the normal (slow) values.
 */
export const TEST_FAST_EVO = true

/** True only for admins while TEST_FAST_EVO is enabled. */
export function fastEvoEnabled(): boolean {
  return TEST_FAST_EVO && getSessionIsAdmin()
}

/** Instant hatch/evolve while admin is testing creature art. */
export function getDevPointsHatch(): number {
  return fastEvoEnabled() ? 0 : 100
}
export function getDevPointsAdult(): number {
  return fastEvoEnabled() ? 0 : 500
}
export function getAdultMinHours(): number {
  return fastEvoEnabled() ? 0 : 48
}
export function getClicksPerDev(): number {
  return fastEvoEnabled() ? 10 : 100
}
export function getKeysPerDev(): number {
  return fastEvoEnabled() ? 50 : 500
}
export function getMaxDevPerHour(): number {
  return fastEvoEnabled() ? 999 : 10
}

/** Cooldown before a bred pet can breed again. */
export function getBreedCooldownMs(): number {
  return fastEvoEnabled() ? 60_000 : 6 * 60 * 60 * 1000
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
