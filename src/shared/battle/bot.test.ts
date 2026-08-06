import { describe, expect, it } from 'vitest'
import { ELEMENT_BASE_STATS } from '../combatStats'
import type { PetData } from '../types'
import {
  BOT_DIFFICULTY_RULES,
  BOT_USER_ID,
  calculateBotBattleReward,
  createBotBattleState,
  createBotPet,
  createNextWaveState,
  DEFAULT_BATTLE_CONSUMABLES,
  chooseBotAction
} from './bot'

const player: PetData = {
  id: 'pet-1',
  name: 'Sprout',
  character: 'grass',
  gender: 'female',
  stage: 'adult',
  stats: { health: 100, emotion: 100, evolution: 100 },
  primaries: ELEMENT_BASE_STATS.grass,
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

describe('bot battle', () => {
  it('uses a different wave count for each difficulty', () => {
    expect(BOT_DIFFICULTY_RULES.easy.waves).toBe(2)
    expect(BOT_DIFFICULTY_RULES.normal.waves).toBe(3)
    expect(BOT_DIFFICULTY_RULES.hard.waves).toBe(4)
  })

  it('builds an equally scaled local opponent and lets the player move first', () => {
    const bot = createBotPet(player, { rng: () => 0 })
    const state = createBotBattleState(player, bot)
    expect(bot.character).not.toBe(player.character)
    expect(bot.skillLoadout?.slots).toHaveLength(4)
    expect(state.turnUserId).toBe('local-player')
    expect(state.defender.userId).toBe(BOT_USER_ID)
  })

  it('uses a session health potion when the bot is low', () => {
    const bot = createBotPet(player)
    const state = createBotBattleState(player, bot)
    state.defender.hp = 1
    state.turnUserId = BOT_USER_ID
    expect(chooseBotAction(state, bot, DEFAULT_BATTLE_CONSUMABLES, () => 0.99)).toEqual({
      command: 'item',
      itemType: 'health_potion'
    })
  })

  it('scales hard opponents above easy opponents', () => {
    const easy = createBotPet(player, { name: 'Easy', difficulty: 'easy', wave: 1, rng: () => 0 })
    const hard = createBotPet(player, { name: 'Hard', difficulty: 'hard', wave: 2, rng: () => 0 })
    expect(hard.primaries.con).toBeGreaterThan(easy.primaries.con)
    expect(hard.primaries.str).toBeGreaterThan(easy.primaries.str)
  })

  it('carries player resources into wave two with bounded recovery', () => {
    const bot = createBotPet(player)
    const state = createBotBattleState(player, bot)
    state.challenger.hp = 10
    state.challenger.mp = 0
    const next = createNextWaveState(state, bot)
    expect(next.challenger.hp).toBeGreaterThan(10)
    expect(next.challenger.hp).toBeLessThanOrEqual(state.challenger.hpStart)
    expect(next.challenger.mp).toBeGreaterThan(0)
    expect(next.turnUserId).toBe('local-player')
  })

  it('randomizes across available species and can exclude the previous wave opponent', () => {
    const first = createBotPet(player, { rng: () => 0 })
    const last = createBotPet(player, { rng: () => 0.999999 })
    const nextWave = createBotPet(player, { rng: () => 0, excludeCharacters: [first.character] })

    expect(first.character).not.toBe(player.character)
    expect(last.character).not.toBe(player.character)
    expect(last.character).not.toBe(first.character)
    expect(nextWave.character).not.toBe(player.character)
    expect(nextWave.character).not.toBe(first.character)
    expect(first.name).not.toBe(last.name)
  })

  it('spawns the KMUTNB boss on the final hard wave only', () => {
    const early = createBotPet(player, { difficulty: 'hard', wave: 3, rng: () => 0 })
    const boss = createBotPet(player, { difficulty: 'hard', wave: 4, rng: () => 0 })
    const normalFinal = createBotPet(player, { difficulty: 'normal', wave: 3, rng: () => 0 })

    expect(early.character).not.toBe('kmutnb')
    expect(boss.character).toBe('kmutnb')
    expect(boss.elementPrimary).toBe('electric')
    expect(normalFinal.character).not.toBe('kmutnb')
    expect(boss.primaries.str).toBeGreaterThan(early.primaries.str)
  })

  it('keeps the KMUTNB boss out of the random bot pool', () => {
    for (let i = 0; i < 40; i++) {
      const bot = createBotPet(player, { difficulty: 'hard', wave: 1, rng: () => i / 40 })
      expect(bot.character).not.toBe('kmutnb')
    }
  })

  it('calculates deterministic difficulty rewards and drops', () => {
    expect(calculateBotBattleReward('easy', 0.9)).toMatchObject({ gems: 4, evolution: 2, drop: null })
    expect(calculateBotBattleReward('hard', 0)).toMatchObject({ gems: 12, evolution: 7, drop: 'battle_shield' })
  })
})
