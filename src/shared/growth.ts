import type { GameSave, PetData } from './types'
import {
  SAVE_VERSION,
  TEST_FAST_EVO,
  PET_SLOT_BASE,
  getBreedCooldownMs
} from './constants'
import { createDefaultMissions, ensureAllMissions } from './missions'
import { clampSlotLimit } from './petCollection'
import { getDefaultInventory, getDefaultQuickItemSlots, normalizeQuickItemSlots } from './items'
import { createDefaultMinigameState } from './minigame'
import { hatchEgg, defaultPetName } from './creatureCharacters'
import { primariesForElements } from './combatStats'
import { rollSkillLoadout } from './battle/skillTrees'
import { normalizePetData } from './petNormalize'
import { elementForCreatureSpecies } from './creatureCharacters'

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function createEggPet(species?: PetData['character']): PetData {
  const hatch = hatchEgg(species)
  const elementPrimary = elementForCreatureSpecies(hatch.character)
  const elementSecondary = null
  const primaries = primariesForElements(elementPrimary, elementSecondary)
  return {
    id: uuid(),
    name: defaultPetName(hatch.character),
    character: hatch.character,
    gender: hatch.gender,
    stage: 'egg',
    stats: { health: 100, emotion: 80, evolution: 0 },
    primaries,
    elementPrimary,
    elementSecondary,
    skillLoadout: null,
    skillUpgradePoints: 0,
    pendingGrowthOffers: null,
    lastBredAt: null,
    hatchedAt: null,
    createdAt: new Date().toISOString(),
    animationState: 'egg_idle',
    feedCount: 0
  }
}

export function hatchPet(pet: PetData): PetData {
  const loadout =
    pet.skillLoadout ?? rollSkillLoadout(pet.elementPrimary, pet.elementSecondary)
  return {
    ...pet,
    stage: 'baby',
    hatchedAt: new Date().toISOString(),
    animationState: 'idle',
    skillLoadout: loadout,
    skillUpgradePoints: pet.skillUpgradePoints ?? 0
  }
}

/** Keep character/stats; rewind to egg (e.g. after clear-data / test bootstrap). */
export function resetPetToEggStage(pet: PetData): PetData {
  return {
    ...pet,
    stage: 'egg',
    hatchedAt: null,
    animationState: 'egg_idle',
    skillLoadout: null,
    skillUpgradePoints: 0,
    pendingGrowthOffers: null
  }
}

export function canBreed(a: PetData, b: PetData, now: number = Date.now()): boolean {
  if (!a || !b || a.id === b.id) return false
  if (a.stage !== 'adult' || b.stage !== 'adult') return false
  if (a.gender === b.gender) return false
  const cooldownOk = (pet: PetData) => {
    if (!pet.lastBredAt) return true
    const t = new Date(pet.lastBredAt).getTime()
    if (!Number.isFinite(t)) return true
    return now - t >= getBreedCooldownMs()
  }
  return cooldownOk(a) && cooldownOk(b)
}

/**
 * Locally breed two adult pets: produces an egg (species inherited 50/50 from
 * parents, with the inherited species' fixed element, and stamps `lastBredAt`
 * on both parents.
 */
export function breedPetsLocal(
  a: PetData,
  b: PetData,
  rng: () => number = Math.random,
  now: number = Date.now()
): { parents: [PetData, PetData]; egg: PetData } {
  const inheritSpecies = rng() < 0.5 ? a.character : b.character
  const egg = createEggPet(inheritSpecies)

  const elementPrimary = elementForCreatureSpecies(egg.character)
  const elementSecondary = null

  const primaries = primariesForElements(elementPrimary, elementSecondary, rng)
  const nextEgg: PetData = {
    ...egg,
    elementPrimary,
    elementSecondary,
    primaries
  }

  const nowIso = new Date(now).toISOString()
  const parentA: PetData = { ...a, lastBredAt: nowIso }
  const parentB: PetData = { ...b, lastBredAt: nowIso }
  return { parents: [parentA, parentB], egg: nextEgg }
}

export function evolvePet(pet: PetData): PetData {
  return {
    ...pet,
    stage: 'adult',
    animationState: 'evolve'
  }
}

function migratePet(pet: PetData & { species?: string; element?: string }): PetData {
  return normalizePetData(pet as PetData & Record<string, unknown>)
}

function normalizeMinigameFields(save: GameSave): GameSave {
  return {
    ...save,
    minigame: save.minigame ?? createDefaultMinigameState()
  }
}

function normalizeActivity(save: GameSave): GameSave {
  const a = save.activity
  const evolutionThisHour = a.evolutionThisHour ?? a.devPointsThisHour ?? 0
  return {
    ...save,
    activity: {
      clicks: a.clicks ?? 0,
      keystrokes: a.keystrokes ?? 0,
      evolutionThisHour,
      hourStartedAt: a.hourStartedAt ?? new Date().toISOString()
    }
  }
}

function normalizeCollectionFields(save: GameSave): GameSave {
  return normalizeActivity(
    normalizeMinigameFields({
      ...save,
      collection: save.collection ?? [],
      petSlotLimit: clampSlotLimit(
        typeof save.petSlotLimit === 'number' ? save.petSlotLimit : PET_SLOT_BASE
      ),
      quickItemSlots: normalizeQuickItemSlots(save.quickItemSlots),
      missions: ensureAllMissions(save.missions),
      gems: typeof save.gems === 'number' && Number.isFinite(save.gems) ? Math.max(0, save.gems) : 0
    })
  )
}

/** One-time save upgrades (test mode egg rewind on v2; dino characters on v3; collection on v4; quick slots on v5). */
export function migrateSave(save: GameSave): GameSave {
  let next = normalizeCollectionFields(save)

  if (next.version < SAVE_VERSION) {
    if (next.version < 4) {
      next = { ...next, collection: next.collection ?? [], petSlotLimit: PET_SLOT_BASE }
    }
    if (next.version < 5) {
      next = { ...next, quickItemSlots: getDefaultQuickItemSlots(next.inventory) }
    }
    if (next.version < 6) {
      next = { ...next, minigame: createDefaultMinigameState() }
    }
    if (TEST_FAST_EVO && save.version < 2 && next.pet?.stage !== 'egg') {
      next = { ...next, pet: resetPetToEggStage(next.pet!) }
    }
    next = { ...next, version: SAVE_VERSION }
  }

  if (next.pet) {
    next = { ...next, pet: migratePet(next.pet) }
  }
  if (next.collection.length > 0) {
    next = { ...next, collection: next.collection.map(migratePet) }
  }

  return next
}

export function createDefaultSave(): GameSave {
  const now = new Date().toISOString()
  return {
    version: SAVE_VERSION,
    pet: createEggPet(),
    collection: [],
    petSlotLimit: PET_SLOT_BASE,
    gems: 0,
    inventory: getDefaultInventory(),
    quickItemSlots: getDefaultQuickItemSlots(),
    missions: createDefaultMissions(),
    activity: {
      clicks: 0,
      keystrokes: 0,
      evolutionThisHour: 0,
      hourStartedAt: now
    },
    sessionStartedAt: now,
    lastSaved: now,
    totalPlaySeconds: 0,
    dailyMissionsCompletedDays: 0,
    lastDailyMissionDay: null,
    minigame: createDefaultMinigameState()
  }
}
