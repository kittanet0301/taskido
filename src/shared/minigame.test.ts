import { describe, expect, it } from 'vitest'
import { createDefaultSave } from './growth'
import {
  applyFinishMinigame,
  applyMinigameDailyReset,
  getMinigameDefinition,
  minigameItemsLeft,
  ROCK_DODGE_EGG_GOAL
} from './minigame'
import { localDayKey } from './missions'

describe('minigame rewards', () => {
  it('uses 100 collected eggs as the Rock Dodge pass threshold', () => {
    expect(getMinigameDefinition('rock_dodge')?.scoreThreshold).toBe(ROCK_DODGE_EGG_GOAL)
    expect(applyFinishMinigame(createDefaultSave(), 'rock_dodge', 99).result.rewarded).toBe(false)
    expect(applyFinishMinigame(createDefaultSave(), 'rock_dodge', 100).result.rewarded).toBe(true)
  })

  it('grants random item when score meets threshold', () => {
    const save = createDefaultSave()
    const totalBefore = save.inventory.reduce((sum, item) => sum + item.quantity, 0)
    const { save: next, result } = applyFinishMinigame(save, 'dino_jump', 1200)
    const totalAfter = next.inventory.reduce((sum, item) => sum + item.quantity, 0)
    expect(result.rewarded).toBe(true)
    expect(result.reward?.quantity).toBe(1)
    expect(totalAfter).toBe(totalBefore + 1)
    expect(minigameItemsLeft(next, 'dino_jump')).toBe(2)
  })

  it('does not grant item below threshold', () => {
    const save = createDefaultSave()
    const { save: next, result } = applyFinishMinigame(save, 'dino_jump', 400)
    expect(result.rewarded).toBe(false)
    expect(result.reason).toBe('below_threshold')
    expect(next.inventory).toEqual(save.inventory)
  })

  it('stops granting after daily item limit', () => {
    let save = createDefaultSave()
    for (let i = 0; i < 3; i++) {
      save = applyFinishMinigame(save, 'dino_jump', 1500).save
    }
    const { result } = applyFinishMinigame(save, 'dino_jump', 2000)
    expect(result.rewarded).toBe(false)
    expect(result.reason).toBe('quota')
    expect(minigameItemsLeft(save, 'dino_jump')).toBe(0)
  })

  it('resets daily item quota on a new local calendar day', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = localDayKey(yesterday)

    let save = createDefaultSave()
    save = {
      ...save,
      minigame: {
        day: yesterdayKey,
        itemsEarnedToday: { dino_jump: 3 },
        bestScores: { dino_jump: 1200 }
      }
    }

    const today = new Date()
    const reset = applyMinigameDailyReset(save, today)
    expect(reset.minigame.day).toBe(localDayKey(today))
    expect(reset.minigame.itemsEarnedToday).toEqual({})
    expect(reset.minigame.bestScores.dino_jump).toBe(1200)
    expect(minigameItemsLeft(reset, 'dino_jump', today)).toBe(3)
  })
})
