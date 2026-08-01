import type { BattleActionType, BattleCombatant, BattleSessionState } from './types'
import {
  AVOID_DODGE_CHANCE,
  TP_GAIN_ATTACK_MAX,
  TP_GAIN_ATTACK_MIN,
  TP_GAIN_DEFEND_MAX,
  TP_GAIN_DEFEND_MIN,
  TP_GAIN_SKILL_MAX,
  TP_GAIN_SKILL_MIN,
  TP_MAX,
  BATTLE_HEALTH_POTION_HEAL,
  BATTLE_MANA_POTION_RESTORE
} from './constants'
import { calcDamage } from './damage'
import {
  formatActionMessage,
  formatDefendMessage,
  formatDodgeMessage,
  formatFleeMessage,
  formatItemShieldMessage,
  formatBattleConsumableMessage,
  formatSkillMessage,
  formatWinnerMessage
} from './formatLog'
import { deriveCombatStats } from '../combatStats'
import { normalizeElementId } from '../elements'
import { getSkillDef } from './skillTrees'

/**
 * TP gain kinds mirror the three RPG command families that build the
 * technique gauge each turn.
 */
type TpGainKind = 'attack' | 'skill' | 'defend'

const TP_GAIN_RANGE: Record<TpGainKind, readonly [number, number]> = {
  attack: [TP_GAIN_ATTACK_MIN, TP_GAIN_ATTACK_MAX],
  skill: [TP_GAIN_SKILL_MIN, TP_GAIN_SKILL_MAX],
  defend: [TP_GAIN_DEFEND_MIN, TP_GAIN_DEFEND_MAX]
}

export interface ApplyActionOptions {
  skillId?: string
  itemType?: string
  skillRank?: number
  randomFactor?: number
  /** true when the opponent used battle_shield last turn (applies extra reduction) */
  shieldItem?: boolean
}

export interface ApplyActionResultInternal {
  state: BattleSessionState
  damage: number
  logMessage: string
  finished: boolean
}

export function isChallenger(state: BattleSessionState, userId: string): boolean {
  return state.challenger.userId === userId
}

export function getActor(state: BattleSessionState, userId: string): BattleCombatant {
  return isChallenger(state, userId) ? state.challenger : state.defender
}

export function getOpponent(state: BattleSessionState, userId: string): BattleCombatant {
  return isChallenger(state, userId) ? state.defender : state.challenger
}

export function canUseUltimateTp(state: BattleSessionState, userId: string): boolean {
  return getActor(state, userId).tp >= TP_MAX
}

/** @deprecated use canUseUltimateTp */
export const canUseUltimate = canUseUltimateTp

export function rollTpGain(kind: TpGainKind, randomFactor?: number): number {
  const roll = randomFactor ?? Math.random()
  const [min, max] = TP_GAIN_RANGE[kind]
  const span = max - min + 1
  return min + Math.floor(Math.max(0, Math.min(0.9999, roll)) * span)
}

/** @deprecated use rollTpGain */
export function rollEnergyGain(
  kind: 'bite' | 'jump' | 'tailwhip' | 'shield' | 'avoid' | TpGainKind,
  randomFactor?: number
): number {
  if (kind === 'shield' || kind === 'avoid' || kind === 'defend') {
    return rollTpGain('defend', randomFactor)
  }
  if (kind === 'skill') return rollTpGain('skill', randomFactor)
  return rollTpGain('attack', randomFactor)
}

export function addTp(current: number, gain: number): number {
  return Math.min(TP_MAX, Math.max(0, current + gain))
}

/** @deprecated use addTp */
export const addEnergy = addTp

export function checkWinner(state: BattleSessionState): string | null {
  if (state.challenger.hp <= 0 && state.defender.hp <= 0) return null
  if (state.defender.hp <= 0) return state.challenger.userId
  if (state.challenger.hp <= 0) return state.defender.userId
  return null
}

export function nextTurnUserId(state: BattleSessionState): string {
  return state.turnUserId === state.challenger.userId
    ? state.defender.userId
    : state.challenger.userId
}

function rollEvaMiss(defender: BattleCombatant, randomFactor?: number): boolean {
  const roll = randomFactor ?? Math.random()
  const derived = deriveCombatStats({
    str: defender.str,
    dex: defender.dex,
    int: defender.int,
    con: defender.con
  })
  const missChance = defender.avoiding
    ? Math.min(0.9, derived.eva + AVOID_DODGE_CHANCE)
    : derived.eva
  return roll < missChance
}

function parseAction(action: string): {
  base: string
  skillId?: string
  itemType?: string
} {
  if (action.startsWith('skill:')) return { base: 'skill', skillId: action.slice(6) }
  if (action.startsWith('item:')) return { base: 'item', itemType: action.slice(5) }
  return { base: action }
}

function normalizeBase(base: string): string {
  if (base === 'shield') return 'defend'
  if (base === 'bite' || base === 'jump' || base === 'tailwhip') return 'attack'
  if (base === 'ultimate') return 'skill'
  return base
}

function attackerIsPure(actor: BattleCombatant): boolean {
  return actor.elementSecondary == null
}

function damageInputFrom(
  actor: BattleCombatant,
  opponent: BattleCombatant,
  opts: ApplyActionOptions,
  skillId?: string
) {
  return {
    mode: skillId ? ('skill' as const) : ('attack' as const),
    skillId,
    skillRank: opts.skillRank ?? 1,
    attackerStr: actor.str,
    attackerInt: actor.int,
    defenderDef: Math.max(1, opponent.con),
    attackerElement: normalizeElementId(actor.elementPrimary),
    defenderElementPrimary: normalizeElementId(opponent.elementPrimary),
    defenderElementSecondary: opponent.elementSecondary
      ? normalizeElementId(opponent.elementSecondary)
      : null,
    attackerPure: attackerIsPure(actor),
    defenderDefending: opponent.defending,
    shieldItem: opts.shieldItem === true,
    randomFactor: opts.randomFactor
  }
}

/**
 * Apply an RPG battle command to the session state.
 *
 * `action` accepts either a plain command (`attack` | `defend` | `flee` |
 * `skill` | `item`) or a compound form (`skill:<pathId>`, `item:<type>`) for
 * callers that want to serialize a full move in one string. Options may also
 * be passed as an object; passing a bare number keeps the legacy
 * `randomFactor` positional signature working.
 */
export function applyAction(
  state: BattleSessionState,
  actorUserId: string,
  action: BattleActionType | string,
  optsOrRandom?: ApplyActionOptions | number
): ApplyActionResultInternal {
  if (state.status !== 'active') throw new Error('Battle is not active')
  if (state.turnUserId !== actorUserId) throw new Error('Not your turn')

  const opts: ApplyActionOptions =
    typeof optsOrRandom === 'number'
      ? { randomFactor: optsOrRandom }
      : { ...(optsOrRandom ?? {}) }

  const parsed = parseAction(String(action))
  const skillId = opts.skillId ?? parsed.skillId
  const itemType = opts.itemType ?? parsed.itemType
  const base = normalizeBase(parsed.base)

  const actor = getActor(state, actorUserId)
  const opponent = getOpponent(state, actorUserId)
  const next: BattleSessionState = {
    ...state,
    challenger: { ...state.challenger },
    defender: { ...state.defender }
  }
  const actorRef = getActor(next, actorUserId)
  const opponentRef = getOpponent(next, actorUserId)

  if (base === 'flee') {
    next.status = 'fled'
    next.fledUserId = actorUserId
    next.winnerUserId = opponent.userId
    next.turnUserId = actorUserId
    return {
      state: next,
      damage: 0,
      logMessage: formatFleeMessage(actor.name),
      finished: true
    }
  }

  if (base === 'defend') {
    const gain = rollTpGain('defend', opts.randomFactor)
    actorRef.defending = true
    actorRef.avoiding = false
    actorRef.tp = addTp(actorRef.tp, gain)
    next.turnUserId = nextTurnUserId(next)
    return {
      state: next,
      damage: 0,
      logMessage: formatDefendMessage(actor.name),
      finished: false
    }
  }

  if (base === 'item') {
    if (itemType === 'health_potion') {
      const restored = Math.min(BATTLE_HEALTH_POTION_HEAL, actorRef.hpStart - actorRef.hp)
      actorRef.hp += restored
      next.turnUserId = nextTurnUserId(next)
      return {
        state: next,
        damage: 0,
        logMessage: formatBattleConsumableMessage(actor.name, itemType, restored),
        finished: false
      }
    }
    if (itemType === 'mana_potion') {
      const restored = Math.min(BATTLE_MANA_POTION_RESTORE, actorRef.mpStart - actorRef.mp)
      actorRef.mp += restored
      next.turnUserId = nextTurnUserId(next)
      return {
        state: next,
        damage: 0,
        logMessage: formatBattleConsumableMessage(actor.name, itemType, restored),
        finished: false
      }
    }

    // Persistent PvP battle shield keeps its existing guarded-stance behavior.
    actorRef.defending = true
    actorRef.avoiding = false
    next.turnUserId = nextTurnUserId(next)
    return {
      state: next,
      damage: 0,
      logMessage: formatItemShieldMessage(actor.name),
      finished: false
    }
  }

  if (base === 'skill') {
    if (!skillId) throw new Error('Skill id required')
    const def = getSkillDef(skillId)
    if (!def) throw new Error(`Unknown skill: ${skillId}`)

    if (def.mpCost > 0 && actorRef.mp < def.mpCost) {
      throw new Error('Not enough MP')
    }
    if (def.tpCost > 0 && actorRef.tp < def.tpCost) {
      throw new Error('Not enough TP')
    }

    actorRef.mp = Math.max(0, actorRef.mp - def.mpCost)
    if (def.tpCost > 0) actorRef.tp = 0

    // Non-damaging role skills apply a stance and pass the turn.
    if (def.role === 'guard' || def.role === 'dodge' || def.role === 'support') {
      if (def.role === 'guard') {
        actorRef.defending = true
        actorRef.avoiding = false
      } else if (def.role === 'dodge') {
        actorRef.avoiding = true
        actorRef.defending = false
      }
      if (def.tpCost === 0) {
        actorRef.tp = addTp(actorRef.tp, rollTpGain('skill', opts.randomFactor))
      }
      next.turnUserId = nextTurnUserId(next)
      return {
        state: next,
        damage: 0,
        logMessage: formatSkillMessage(actor.name, def.pathId, 0),
        finished: false
      }
    }

    const evaMissed = rollEvaMiss(opponentRef, opts.randomFactor)
    const damage = evaMissed
      ? 0
      : calcDamage(damageInputFrom(actorRef, opponentRef, opts, def.pathId))

    if (def.tpCost === 0) {
      actorRef.tp = addTp(actorRef.tp, rollTpGain('skill', opts.randomFactor))
    }

    opponentRef.hp = Math.max(0, opponentRef.hp - damage)
    opponentRef.defending = false
    opponentRef.avoiding = false

    const logMessage = evaMissed
      ? formatDodgeMessage(opponentRef.name, actorRef.name)
      : formatSkillMessage(actor.name, def.pathId, damage, opponent.name)

    const winnerUserId = checkWinner(next)
    if (winnerUserId) {
      next.status = 'completed'
      next.winnerUserId = winnerUserId
      next.turnUserId = actorUserId
      const winnerName = winnerUserId === actor.userId ? actor.name : opponent.name
      return {
        state: next,
        damage,
        logMessage: `${logMessage} ${formatWinnerMessage(winnerName)}`,
        finished: true
      }
    }
    next.turnUserId = nextTurnUserId(next)
    return { state: next, damage, logMessage, finished: false }
  }

  // Default: basic attack
  const evaMissed = rollEvaMiss(opponentRef, opts.randomFactor)
  const damage = evaMissed ? 0 : calcDamage(damageInputFrom(actorRef, opponentRef, opts))

  actorRef.tp = addTp(actorRef.tp, rollTpGain('attack', opts.randomFactor))
  opponentRef.hp = Math.max(0, opponentRef.hp - damage)
  opponentRef.defending = false
  opponentRef.avoiding = false

  const logMessage = evaMissed
    ? formatDodgeMessage(opponentRef.name, actorRef.name)
    : formatActionMessage(actor.name, opponent.name, 'attack', damage)

  const winnerUserId = checkWinner(next)
  if (winnerUserId) {
    next.status = 'completed'
    next.winnerUserId = winnerUserId
    next.turnUserId = actorUserId
    const winnerName = winnerUserId === actor.userId ? actor.name : opponent.name
    return {
      state: next,
      damage,
      logMessage: `${logMessage} ${formatWinnerMessage(winnerName)}`,
      finished: true
    }
  }
  next.turnUserId = nextTurnUserId(next)
  return { state: next, damage, logMessage, finished: false }
}
