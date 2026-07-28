import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { applyGamePatch, setSessionIsAdmin } from './gameMutators'
import { createDefaultSave, createEggPet } from './growth'
import { TEST_FAST_EVO } from './constants'

describe('TEST debug buttons', () => {
  beforeEach(() => {
    setSessionIsAdmin(true)
  })
  afterEach(() => {
    setSessionIsAdmin(false)
  })

  it('is enabled in test-fast mode', () => {
    expect(TEST_FAST_EVO).toBe(true)
  })

  it('debugSetSpecies switches species and assigns its fixed element', () => {
    const save = createDefaultSave()
    const before = save.pet!
    const next = applyGamePatch(save, 'debugSetSpecies', ['neutral'])
    expect(next.pet?.character).toBe('neutral')
    expect(next.pet?.name.toLowerCase()).toContain('stego')
    expect(next.pet?.elementPrimary).toBe('neutral')
    expect(next.pet?.elementSecondary).toBeNull()
    expect(next.pet?.primaries.str).toBeGreaterThan(0)
    expect(next.pet).not.toBe(before)
  })

  it('debugSetSpecies on hatched pet also re-rolls skill loadout', () => {
    let save = { ...createDefaultSave(), pet: createEggPet('neutral') }
    save = applyGamePatch(save, 'debugSetStage', ['baby'])
    const loadoutBefore = save.pet!.skillLoadout
    expect(loadoutBefore?.slots.length).toBe(4)

    save = applyGamePatch(save, 'debugSetSpecies', ['neutral'])
    expect(save.pet?.character).toBe('neutral')
    expect(save.pet?.skillLoadout?.slots.length).toBe(4)
    expect(save.pet?.skillLoadout?.slots.every((s) => s.rank === 1)).toBe(true)
  })

  it('debugSetStage egg→baby rolls a skill loadout', () => {
    const save = { ...createDefaultSave(), pet: createEggPet('neutral') }
    expect(save.pet?.stage).toBe('egg')
    expect(save.pet?.skillLoadout).toBeNull()

    const baby = applyGamePatch(save, 'debugSetStage', ['baby'])
    expect(baby.pet?.stage).toBe('baby')
    expect(baby.pet?.skillLoadout?.slots.length).toBe(4)

    const adult = applyGamePatch(save, 'debugSetStage', ['adult'])
    expect(adult.pet?.stage).toBe('adult')
    expect(adult.pet?.skillLoadout?.slots.length).toBe(4)
  })

  it('debugSetStage adult→egg clears skills', () => {
    let save = { ...createDefaultSave(), pet: createEggPet('neutral') }
    save = applyGamePatch(save, 'debugSetStage', ['adult'])
    save = applyGamePatch(save, 'debugSetStage', ['egg'])
    expect(save.pet?.stage).toBe('egg')
    expect(save.pet?.skillLoadout).toBeNull()
  })

  it('debugBoostDev grants skill points / growth offers on level-up', () => {
    let save = { ...createDefaultSave(), pet: createEggPet('neutral') }
    save = applyGamePatch(save, 'debugSetStage', ['baby'])
    const before = save.pet!
    expect(before.skillUpgradePoints).toBe(0)

    // Baby level = 2 + floor(evolution/80). +80 evolution → +1 level.
    save = applyGamePatch(save, 'debugBoostDev', [80])
    expect(save.pet?.stats.evolution).toBe(80)
    expect(save.pet!.skillUpgradePoints).toBeGreaterThan(before.skillUpgradePoints)
    expect(save.pet?.pendingGrowthOffers?.length).toBeGreaterThan(0)
  })

  it('newEgg adds a species-specific egg into collection', () => {
    const save = createDefaultSave()
    const used = 1 + save.collection.length
    const next = applyGamePatch(save, 'newEgg', ['neutral'])
    expect(next.collection.length).toBe(save.collection.length + 1)
    const egg = next.collection[next.collection.length - 1]!
    expect(egg.stage).toBe('egg')
    expect(egg.character).toBe('neutral')
    expect(egg.elementPrimary).toBe('neutral')
    expect(used + 1).toBe(1 + next.collection.length)
  })

  it('debugGrantItem adds breed_nest to inventory', () => {
    const save = createDefaultSave()
    const before = save.inventory.find((i) => i.type === 'breed_nest')?.quantity ?? 0
    const next = applyGamePatch(save, 'debugGrantItem', ['breed_nest', 2])
    expect(next.inventory.find((i) => i.type === 'breed_nest')?.quantity).toBe(before + 2)
  })

  it('debugSetGender flips active pet gender', () => {
    const save = createDefaultSave()
    expect(save.pet).toBeTruthy()
    const flipped = applyGamePatch(save, 'debugSetGender', [
      save.pet!.gender === 'female' ? 'male' : 'female'
    ])
    expect(flipped.pet?.gender).not.toBe(save.pet!.gender)
  })

  it('debugAdjustCare changes health and emotion within 0–100', () => {
    let save = createDefaultSave()
    save = {
      ...save,
      pet: { ...save.pet!, stats: { health: 50, emotion: 50, evolution: 0 } }
    }
    save = applyGamePatch(save, 'debugAdjustCare', ['health', 10])
    expect(save.pet?.stats.health).toBe(60)
    save = applyGamePatch(save, 'debugAdjustCare', ['emotion', -20])
    expect(save.pet?.stats.emotion).toBe(30)
    save = applyGamePatch(save, 'debugAdjustCare', ['health', 999])
    expect(save.pet?.stats.health).toBe(100)
    save = applyGamePatch(save, 'debugAdjustCare', ['emotion', -999])
    expect(save.pet?.stats.emotion).toBe(0)
  })
})
