import type { PetData, PetStats } from './types'
import { normalizeElementId } from './elements'
import { primariesForElements, GROWTH_CARDS, type PrimaryStats, type GrowthCardId } from './combatStats'
import { rollSkillLoadout, type SkillLoadout } from './battle/skillTrees'
import {
  DEFAULT_CREATURE_SPECIES,
  defaultPetName,
  elementForCreatureSpecies,
  normalizePetSpecies
} from './creatureCharacters'

export function normalizeCareStats(raw: Partial<PetStats> & Record<string, unknown>): PetStats {
  const health = num(raw.health ?? raw.hp, 100)
  const emotion = num(raw.emotion ?? raw.mood, 80)
  const evolution = num(raw.evolution ?? raw.devPoints ?? raw.dev_points, 0)
  return { health, emotion, evolution }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function normalizePrimaries(raw: unknown, elementPrimary: string, elementSecondary: string | null): PrimaryStats {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (o.str != null || o.dex != null) {
      return {
        str: num(o.str, 20),
        dex: num(o.dex, 20),
        int: num(o.int, 20),
        con: num(o.con, 20)
      }
    }
  }
  return primariesForElements(
    normalizeElementId(elementPrimary),
    elementSecondary ? normalizeElementId(elementSecondary) : null
  )
}

export function normalizeSkillLoadout(raw: unknown): SkillLoadout | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as SkillLoadout
  if (!Array.isArray(o.slots) || o.slots.length === 0) return null
  return o
}

const GROWTH_CARD_IDS = new Set<string>(GROWTH_CARDS.map((c) => c.id))

export function normalizePendingGrowthOffers(raw: unknown): GrowthCardId[] | null {
  if (!Array.isArray(raw)) return null
  const ids = raw
    .map((v) => (typeof v === 'string' ? v : ''))
    .filter((v) => GROWTH_CARD_IDS.has(v)) as GrowthCardId[]
  return ids.length > 0 ? ids : null
}

/** Migrate / fill missing RPG fields on a pet. */
export function normalizePetData(pet: PetData & Record<string, unknown>): PetData {
  const character = pet.character
    ? normalizePetSpecies(String(pet.character))
    : pet.species
      ? normalizePetSpecies(String(pet.species))
      : DEFAULT_CREATURE_SPECIES

  const elementPrimary = elementForCreatureSpecies(character)
  const elementSecondary = null

  const stats = normalizeCareStats(pet.stats as PetStats & Record<string, unknown>)
  const primaries = normalizePrimaries(pet.primaries ?? {
    str: pet.str,
    dex: pet.dex,
    int: pet.int,
    con: pet.con
  }, elementPrimary, elementSecondary)

  let skillLoadout = normalizeSkillLoadout(pet.skillLoadout)
  if (!skillLoadout && pet.stage !== 'egg') {
    skillLoadout = rollSkillLoadout(elementPrimary, elementSecondary)
  }

  return {
    id: String(pet.id),
    name: String(pet.name || defaultPetName(character)),
    character,
    gender: pet.gender === 'female' ? 'female' : 'male',
    stage: pet.stage === 'baby' || pet.stage === 'adult' ? pet.stage : 'egg',
    stats,
    primaries,
    elementPrimary,
    elementSecondary,
    skillLoadout: pet.stage === 'egg' ? null : skillLoadout,
    skillUpgradePoints: num(pet.skillUpgradePoints, 0),
    pendingGrowthOffers: normalizePendingGrowthOffers(pet.pendingGrowthOffers),
    lastBredAt: pet.lastBredAt ? String(pet.lastBredAt) : null,
    hatchedAt: pet.hatchedAt ? String(pet.hatchedAt) : null,
    createdAt: pet.createdAt ? String(pet.createdAt) : new Date().toISOString(),
    animationState: (pet.animationState as PetData['animationState']) || 'idle',
    feedCount: num(pet.feedCount, 0)
  }
}
