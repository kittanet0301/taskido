import {
  CREATURE_SPECIES,
  defaultPetName,
  elementForCreatureSpecies,
  isBotOnlyCreatureSpecies,
  type CreatureSpecies
} from '../creatureCharacters'
import { deriveCombatStats, ELEMENT_BASE_STATS } from '../combatStats'
import type { PetData } from '../types'
import { baseSkillsFor, getSkillDef, ultimateFor } from './skillTrees'
import { TP_MAX } from './constants'
import type { BattleActionPayload, BattleCombatant, BattleSessionState } from './types'
import type { ItemType } from '../types'

/** Hard-mode final-wave boss (KMUTNB Engineer). */
export const HARD_FINAL_WAVE_BOSS: CreatureSpecies = 'kmutnb'

export const LOCAL_PLAYER_USER_ID = 'local-player'
export const BOT_USER_ID = 'taskino-bot'

export type BattleConsumableType = 'health_potion' | 'mana_potion'
export type BattleConsumableCounts = Record<BattleConsumableType, number>

export const DEFAULT_BATTLE_CONSUMABLES: BattleConsumableCounts = {
  health_potion: 3,
  mana_potion: 3
}

export type BotDifficulty = 'easy' | 'normal' | 'hard'

export interface BotBattleReward {
  gems: number
  evolution: number
  dropChance: number
  drop: ItemType | null
}

export const BOT_DIFFICULTY_RULES: Record<BotDifficulty, {
  waves: number
  statScale: number
  gems: number
  evolution: number
  dropChance: number
}> = {
  easy: { waves: 2, statScale: 0.82, gems: 4, evolution: 2, dropChance: 0.25 },
  normal: { waves: 3, statScale: 1, gems: 7, evolution: 4, dropChance: 0.4 },
  hard: { waves: 4, statScale: 1.18, gems: 12, evolution: 7, dropChance: 0.6 }
}

const BOT_DROPS: ItemType[] = ['battle_shield', 'food_premium', 'dev_vitamin', 'skill_forget']

export function calculateBotBattleReward(
  difficulty: BotDifficulty,
  dropRoll: number
): BotBattleReward {
  const rule = BOT_DIFFICULTY_RULES[difficulty]
  const normalized = Math.max(0, Math.min(0.999999, dropRoll))
  return {
    gems: rule.gems,
    evolution: rule.evolution,
    dropChance: rule.dropChance,
    drop: normalized < rule.dropChance
      ? BOT_DROPS[Math.floor((normalized / rule.dropChance) * BOT_DROPS.length)]!
      : null
  }
}

function scaledBotPrimaries(player: PetData, botElement: PetData['elementPrimary'], multiplier: number) {
  const base = ELEMENT_BASE_STATS[botElement]
  const playerTotal = Object.values(player.primaries).reduce((sum, value) => sum + value, 0)
  const baseTotal = Object.values(base).reduce((sum, value) => sum + value, 0)
  const scale = Math.max(0.65, Math.min(1.45, (playerTotal / Math.max(1, baseTotal)) * multiplier))
  return {
    str: Math.max(1, Math.round(base.str * scale)),
    dex: Math.max(1, Math.round(base.dex * scale)),
    int: Math.max(1, Math.round(base.int * scale)),
    con: Math.max(1, Math.round(base.con * scale))
  }
}

interface CreateBotPetOptions {
  difficulty?: BotDifficulty
  wave?: number
  rng?: () => number
  excludeCharacters?: readonly CreatureSpecies[]
  name?: string
}

export function isHardFinalBossWave(difficulty: BotDifficulty, wave: number): boolean {
  return difficulty === 'hard' && wave === BOT_DIFFICULTY_RULES.hard.waves
}

function botWaveStatMultiplier(difficulty: BotDifficulty, wave: number): number {
  if (isHardFinalBossWave(difficulty, wave)) return 1.28
  return wave === 1 ? 0.94 : 1.06
}

function randomBotSpecies(
  player: PetData,
  excludeCharacters: readonly CreatureSpecies[],
  rng: () => number
): CreatureSpecies {
  const pool = CREATURE_SPECIES.filter((species) => (
    !isBotOnlyCreatureSpecies(species)
    && species !== player.character
    && !excludeCharacters.includes(species)
  ))
  const candidates = pool.length > 0
    ? pool
    : CREATURE_SPECIES.filter((species) => (
      !isBotOnlyCreatureSpecies(species) && species !== player.character
    ))
  const roll = Math.max(0, Math.min(0.999999, rng()))
  return candidates[Math.floor(roll * candidates.length)]!
}

export function createBotPet(
  player: PetData,
  options: CreateBotPetOptions = {}
): PetData {
  const {
    difficulty = 'normal',
    wave = 1,
    rng = Math.random,
    excludeCharacters = [],
    name
  } = options
  const character = isHardFinalBossWave(difficulty, wave)
    ? HARD_FINAL_WAVE_BOSS
    : randomBotSpecies(player, excludeCharacters, rng)
  const elementPrimary = elementForCreatureSpecies(character)
  const bases = baseSkillsFor(elementPrimary).filter((skill) => skill.power > 0).slice(0, 3)
  const ultimate = ultimateFor(elementPrimary)

  return {
    ...player,
    id: `bot-${character}`,
    name: name ?? defaultPetName(character),
    character,
    gender: 'male',
    stage: player.stage === 'egg' ? 'baby' : player.stage,
    primaries: scaledBotPrimaries(
      player,
      elementPrimary,
      BOT_DIFFICULTY_RULES[difficulty].statScale * botWaveStatMultiplier(difficulty, wave)
    ),
    elementPrimary,
    elementSecondary: null,
    skillLoadout: {
      mode: 'pure',
      ultimateElement: elementPrimary,
      slots: [
        ...bases.map((skill) => ({
          pathId: skill.pathId,
          element: elementPrimary,
          rank: 1,
          kind: 'skill' as const
        })),
        {
          pathId: ultimate.pathId,
          element: elementPrimary,
          rank: 1,
          kind: 'ultimate' as const
        }
      ]
    },
    animationState: 'idle'
  }
}

export function petToBattleCombatant(
  pet: PetData,
  userId: string
): BattleCombatant {
  const derived = deriveCombatStats(pet.primaries)
  return {
    userId,
    petId: pet.id,
    name: pet.name,
    character: pet.character,
    hp: derived.maxHp,
    hpStart: derived.maxHp,
    mp: derived.maxMp,
    mpStart: derived.maxMp,
    tp: 0,
    defending: false,
    avoiding: false,
    ...pet.primaries,
    elementPrimary: pet.elementPrimary,
    elementSecondary: pet.elementSecondary
  }
}

export function createBotBattleState(player: PetData, bot: PetData): BattleSessionState {
  return {
    sessionId: `bot-${Date.now()}`,
    challenger: petToBattleCombatant(player, LOCAL_PLAYER_USER_ID),
    defender: petToBattleCombatant(bot, BOT_USER_ID),
    turnUserId: LOCAL_PLAYER_USER_ID,
    status: 'active',
    winnerUserId: null,
    fledUserId: null
  }
}

export function createNextWaveState(
  previous: BattleSessionState,
  bot: PetData
): BattleSessionState {
  const challenger = previous.challenger
  return {
    sessionId: `bot-${Date.now()}`,
    challenger: {
      ...challenger,
      hp: Math.min(challenger.hpStart, challenger.hp + Math.ceil(challenger.hpStart * 0.15)),
      mp: Math.min(challenger.mpStart, challenger.mp + Math.ceil(challenger.mpStart * 0.2)),
      defending: false,
      avoiding: false
    },
    defender: petToBattleCombatant(bot, BOT_USER_ID),
    turnUserId: LOCAL_PLAYER_USER_ID,
    status: 'active',
    winnerUserId: null,
    fledUserId: null
  }
}

export function chooseBotAction(
  state: BattleSessionState,
  bot: PetData,
  items: BattleConsumableCounts,
  rng: () => number = Math.random
): BattleActionPayload {
  const actor = state.defender.userId === BOT_USER_ID ? state.defender : state.challenger
  const hpRatio = actor.hp / Math.max(1, actor.hpStart)
  const mpRatio = actor.mp / Math.max(1, actor.mpStart)

  if (hpRatio <= 0.35 && items.health_potion > 0) {
    return { command: 'item', itemType: 'health_potion' }
  }
  if (mpRatio <= 0.25 && items.mana_potion > 0) {
    return { command: 'item', itemType: 'mana_potion' }
  }

  const loadout = bot.skillLoadout?.slots ?? []
  const ultimate = loadout.find((slot) => slot.kind === 'ultimate')
  if (ultimate && actor.tp >= TP_MAX) {
    return { command: 'skill', skillId: ultimate.pathId }
  }

  const affordable = loadout.filter((slot) => {
    const def = getSkillDef(slot.pathId)
    return slot.kind === 'skill' && def != null && def.power > 0 && actor.mp >= def.mpCost
  })
  if (affordable.length > 0 && rng() < 0.62) {
    const slot = affordable[Math.floor(rng() * affordable.length)]!
    return { command: 'skill', skillId: slot.pathId }
  }
  if (rng() < 0.16) return { command: 'defend' }
  return { command: 'attack' }
}
