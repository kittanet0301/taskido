import { describe, expect, it } from 'vitest'
import type { PetData } from './types'
import { resolvePetClip } from './dinoAnim'

const adultPet: PetData = {
  id: 'pet-1',
  name: 'Sprout',
  character: 'grass',
  gender: 'female',
  stage: 'adult',
  stats: { health: 100, emotion: 100, evolution: 100 },
  primaries: { strength: 10, agility: 10, vitality: 10, intelligence: 10, luck: 10 },
  elementPrimary: 'grass',
  elementSecondary: null,
  skillLoadout: null,
  skillUpgradePoints: 0,
  pendingGrowthOffers: null,
  lastBredAt: null,
  hatchedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  animationState: 'idle',
  feedCount: 0
}

describe('resolvePetClip', () => {
  it('uses battle movement clips even when pet animationState is idle', () => {
    expect(resolvePetClip(adultPet, 0, 'battle_hurt')).toEqual({
      folder: 'adult',
      clip: 'hurt',
      flipX: true
    })
    expect(resolvePetClip(adultPet, 0, 'battle_attack')).toEqual({
      folder: 'adult',
      clip: 'bite',
      flipX: true
    })
  })
})
