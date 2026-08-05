import type { PetData, PetStats, Stage } from './types'
import { getAdultMinHours, getDevPointsAdult, getDevPointsHatch } from './constants'
import { normalizeCareStats } from './petNormalize'

export function clampStat(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function applyMoodDecay(stats: PetStats, hoursAway: number): PetStats {
  const s = normalizeCareStats(stats)
  const emotionLoss = Math.floor(hoursAway * 2)
  const healthLoss = Math.floor(hoursAway * 0.5)
  return {
    health: clampStat(s.health - healthLoss),
    emotion: clampStat(s.emotion - emotionLoss),
    evolution: s.evolution
  }
}

export function getMoodLabel(emotion: number): 'happy' | 'neutral' | 'sad' {
  if (emotion >= 70) return 'happy'
  if (emotion >= 40) return 'neutral'
  return 'sad'
}

export function shouldBeSick(stats: PetStats): boolean {
  return normalizeCareStats(stats).health < 30
}

export function canHatchEgg(pet: PetData): boolean {
  return pet.stage === 'egg' && normalizeCareStats(pet.stats).evolution >= getDevPointsHatch()
}

export function canEvolveToAdult(pet: PetData): boolean {
  if (pet.stage !== 'baby' || !pet.hatchedAt) return false
  const hoursSinceHatch = (Date.now() - new Date(pet.hatchedAt).getTime()) / 3_600_000
  return (
    normalizeCareStats(pet.stats).evolution >= getDevPointsAdult() &&
    hoursSinceHatch >= getAdultMinHours()
  )
}

export function getNextStage(pet: PetData): Stage {
  if (pet.stage === 'egg') return 'baby'
  if (pet.stage === 'baby' && canEvolveToAdult(pet)) return 'adult'
  return pet.stage
}

export function feedPet(stats: PetStats, amount: number): PetStats {
  const s = normalizeCareStats(stats)
  return { ...s, emotion: clampStat(s.emotion + amount) }
}

export function healPet(stats: PetStats, amount: number): PetStats {
  const s = normalizeCareStats(stats)
  return { ...s, health: clampStat(s.health + amount) }
}

export function addDevPoints(stats: PetStats, amount: number): PetStats {
  const s = normalizeCareStats(stats)
  return { ...s, evolution: Math.max(0, s.evolution + amount) }
}

/** @deprecated alias */
export const addEvolutionPoints = addDevPoints
