import type { Gender, HatchResult, PetSpecies, Stage } from './types'
import type { ElementId } from './elements'
import { tDefaultPetName } from '../i18n/labels'

export const CREATURE_SPECIES = [
  'neutral',
  'fire',
  'grass',
  'ground',
  'electric',
  'water',
  'ice',
  'dragon',
  'dark'
] as const

export type CreatureSpecies = (typeof CREATURE_SPECIES)[number]

/** Default species for new eggs and saves while creature art is the POC focus. */
export const DEFAULT_CREATURE_SPECIES: CreatureSpecies = 'neutral'

/** Each creature species has one fixed, pure element. */
export const CREATURE_SPECIES_ELEMENTS: Record<CreatureSpecies, ElementId> = {
  neutral: 'neutral',
  fire: 'fire',
  grass: 'grass',
  ground: 'ground',
  electric: 'electric',
  water: 'water',
  ice: 'ice',
  dragon: 'dragon',
  dark: 'dark'
}

export function elementForCreatureSpecies(species: CreatureSpecies): ElementId {
  return CREATURE_SPECIES_ELEMENTS[species]
}

export const CREATURE_FRAME_SIZE = 192

/** Shared source-to-display scale used by creature renderers. */
export const CREATURE_PIXEL_SCALE = 2

/** Target on-screen sprite size (px) for creature UI — egg/baby share one size. */
export const CREATURE_DISPLAY_SIZE = {
  egg: 250,
  baby: 250,
  adult: 500
} as const

export function creatureDisplaySize(stage: Stage): number {
  return stage === 'adult' ? CREATURE_DISPLAY_SIZE.adult : CREATURE_DISPLAY_SIZE.egg
}

export type CreatureStageFolder = 'egg' | 'baby' | 'adult'

export const CREATURE_PREVIEW_COLORS: Record<CreatureSpecies, string> = {
  neutral: '#a9a38f',
  fire: '#e85d3f',
  grass: '#55a85b',
  ground: '#9a724e',
  electric: '#f2cf42',
  water: '#3d8ed0',
  ice: '#82d6e8',
  dragon: '#8c65c5',
  dark: '#4b405f'
}

export function isCreatureSpecies(value: string): value is CreatureSpecies {
  return (CREATURE_SPECIES as readonly string[]).includes(value)
}

const LEGACY_SPECIES_MIGRATIONS: Record<string, CreatureSpecies> = {
  garden: 'grass',
  'blaze-crest': 'fire',
  'crag-shell': 'ground',
  'tide-fin': 'water',
  'volt-wing': 'electric'
}

/** Unknown species use the default; the five previous POC ids retain their elements. */
export function normalizePetSpecies(value: string): PetSpecies {
  if (isCreatureSpecies(value)) return value
  return LEGACY_SPECIES_MIGRATIONS[value] ?? DEFAULT_CREATURE_SPECIES
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function rollGender(): Gender {
  return Math.random() < 0.5 ? 'male' : 'female'
}

export function rollPetSpecies(): PetSpecies {
  return pickRandom(CREATURE_SPECIES)
}

/** New eggs use an explicit live species, or a random creature from the live pool. */
export function hatchEgg(species?: PetSpecies): HatchResult {
  return {
    character: species && isCreatureSpecies(species) ? species : rollPetSpecies(),
    gender: rollGender()
  }
}

export function defaultPetName(character: PetSpecies): string {
  return tDefaultPetName(character)
}

export function creatureStageFolder(stage: Stage): CreatureStageFolder {
  if (stage === 'egg') return 'egg'
  if (stage === 'baby') return 'baby'
  return 'adult'
}

export function creatureRenderStage(stage: Stage): CreatureStageFolder {
  return creatureStageFolder(stage)
}

export function creatureAssetBase(
  species: CreatureSpecies,
  stageFolder: CreatureStageFolder,
  clip: string
): string {
  return `/creatures/${species}/${stageFolder}/${clip}.png`
}
