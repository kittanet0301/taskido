import { describe, expect, it } from 'vitest'
import { applyGamePatch } from './gameMutators'
import { createDefaultSave, createEggPet, hatchPet } from './growth'

describe('completeBotBattle mutator', () => {
  it('persists gems, evolution, mission progress and a deterministic drop', () => {
    const pet = hatchPet({ ...createEggPet('grass'), stats: { health: 100, emotion: 100, evolution: 100 } })
    const save = { ...createDefaultSave(), pet, gems: 3 }
    const beforeMission = save.missions.find((m) => m.missionId === 'weekly_battle_win_3')?.progress ?? 0
    const next = applyGamePatch(save, 'completeBotBattle', ['hard', 0])

    expect(next.gems).toBe(15)
    expect(next.pet?.stats.evolution).toBe(107)
    expect(next.inventory.find((item) => item.type === 'battle_shield')?.quantity).toBe(1)
    expect(next.missions.find((m) => m.missionId === 'weekly_battle_win_3')?.progress).toBe(beforeMission + 1)
  })

  it('rejects malformed reward requests', () => {
    const save = createDefaultSave()
    expect(applyGamePatch(save, 'completeBotBattle', ['nightmare', 0])).toBe(save)
  })
})
