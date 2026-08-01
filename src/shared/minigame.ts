import type { GameSave, InventoryItem, ItemType, MinigameId, MinigameSaveState } from './types'
import { localDayKey } from './missions'

export const MINIGAME_DAILY_ITEM_LIMIT = 3
export const ROCK_DODGE_EGG_GOAL = 100

export const MINIGAME_REWARD_POOL: ItemType[] = ['food_basic', 'water', 'medicine', 'toy']

export interface MinigameDefinition {
  id: MinigameId
  titleKey: string
  descriptionKey: string
  scoreThreshold: number
  rewardPool: ItemType[]
}

export const MINIGAME_REGISTRY: MinigameDefinition[] = [
  {
    id: 'dino_jump',
    titleKey: 'minigame.dinoJump.title',
    descriptionKey: 'minigame.dinoJump.description',
    scoreThreshold: 1000,
    rewardPool: MINIGAME_REWARD_POOL
  },
  {
    id: 'rock_dodge',
    titleKey: 'minigame.rockDodge.title',
    descriptionKey: 'minigame.rockDodge.description',
    scoreThreshold: ROCK_DODGE_EGG_GOAL,
    rewardPool: MINIGAME_REWARD_POOL
  }
]

export type MinigameFinishReason = 'earned' | 'below_threshold' | 'quota'

export interface MinigameFinishResult {
  rewarded: boolean
  reward?: InventoryItem
  reason: MinigameFinishReason
  score: number
  bestScore: number
  itemsLeft: number
}

export function getMinigameDefinition(gameId: MinigameId): MinigameDefinition | undefined {
  return MINIGAME_REGISTRY.find((g) => g.id === gameId)
}

export function createDefaultMinigameState(): MinigameSaveState {
  return {
    day: null,
    itemsEarnedToday: {},
    bestScores: {}
  }
}

export function normalizeMinigameState(save: GameSave, now = new Date()): GameSave {
  const today = localDayKey(now)
  const minigame = save.minigame ?? createDefaultMinigameState()
  if (minigame.day === today) return { ...save, minigame }
  return {
    ...save,
    minigame: {
      day: today,
      itemsEarnedToday: {},
      bestScores: { ...minigame.bestScores }
    }
  }
}

/** Persist minigame daily quota reset when the local calendar day changes. */
export function applyMinigameDailyReset(save: GameSave, now = new Date()): GameSave {
  const today = localDayKey(now)
  const minigame = save.minigame ?? createDefaultMinigameState()
  if (minigame.day === today) return save
  return normalizeMinigameState(save, now)
}

export function minigameItemsEarnedToday(save: GameSave, gameId: MinigameId, now = new Date()): number {
  const normalized = normalizeMinigameState(save, now)
  return normalized.minigame.itemsEarnedToday[gameId] ?? 0
}

export function minigameItemsLeft(save: GameSave, gameId: MinigameId, now = new Date()): number {
  return Math.max(0, MINIGAME_DAILY_ITEM_LIMIT - minigameItemsEarnedToday(save, gameId, now))
}

export function canEarnItemReward(
  save: GameSave,
  gameId: MinigameId,
  score: number,
  now = new Date()
): boolean {
  const def = getMinigameDefinition(gameId)
  if (!def) return false
  const normalized = normalizeMinigameState(save, now)
  const earned = normalized.minigame.itemsEarnedToday[gameId] ?? 0
  return score >= def.scoreThreshold && earned < MINIGAME_DAILY_ITEM_LIMIT
}

export function rollRandomReward(gameId: MinigameId): InventoryItem {
  const def = getMinigameDefinition(gameId)
  const pool = def?.rewardPool ?? MINIGAME_REWARD_POOL
  const type = pool[Math.floor(Math.random() * pool.length)]
  return { type, quantity: 1 }
}

function addInventoryItem(inventory: InventoryItem[], item: InventoryItem): InventoryItem[] {
  const next = [...inventory]
  const existing = next.find((i) => i.type === item.type)
  if (existing) existing.quantity += item.quantity
  else next.push({ ...item })
  return next
}

export function applyFinishMinigame(
  save: GameSave,
  gameId: MinigameId,
  score: number,
  now = new Date()
): { save: GameSave; result: MinigameFinishResult } {
  const def = getMinigameDefinition(gameId)
  if (!def) {
    return {
      save,
      result: {
        rewarded: false,
        reason: 'below_threshold',
        score,
        bestScore: save.minigame?.bestScores[gameId] ?? 0,
        itemsLeft: minigameItemsLeft(save, gameId, now)
      }
    }
  }

  let next = normalizeMinigameState(save, now)
  const prevBest = next.minigame.bestScores[gameId] ?? 0
  const bestScore = Math.max(prevBest, score)
  const itemsLeftBefore = minigameItemsLeft(next, gameId, now)

  next = {
    ...next,
    minigame: {
      ...next.minigame,
      bestScores: { ...next.minigame.bestScores, [gameId]: bestScore }
    }
  }

  if (!canEarnItemReward(next, gameId, score, now)) {
    const earned = next.minigame.itemsEarnedToday[gameId] ?? 0
    const reason: MinigameFinishReason =
      earned >= MINIGAME_DAILY_ITEM_LIMIT ? 'quota' : 'below_threshold'
    return {
      save: next,
      result: {
        rewarded: false,
        reason,
        score,
        bestScore,
        itemsLeft: itemsLeftBefore
      }
    }
  }

  const reward = rollRandomReward(gameId)
  const earned = (next.minigame.itemsEarnedToday[gameId] ?? 0) + 1
  next = {
    ...next,
    inventory: addInventoryItem(next.inventory, reward),
    minigame: {
      ...next.minigame,
      itemsEarnedToday: { ...next.minigame.itemsEarnedToday, [gameId]: earned }
    }
  }

  return {
    save: next,
    result: {
      rewarded: true,
      reward,
      reason: 'earned',
      score,
      bestScore,
      itemsLeft: Math.max(0, MINIGAME_DAILY_ITEM_LIMIT - earned)
    }
  }
}

export interface MinigameLeaderboardRow {
  rank: number
  userId: string
  username: string
  bestScore: number
  achievedAt: string
}
