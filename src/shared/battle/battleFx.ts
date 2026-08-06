import { getSkillDef, type SkillDef } from './skillTrees'
import type { AnimationState } from '../types'
import type { BattleTurn } from './types'

export type BattleFxSide = 'challenger' | 'defender'
export type BattleFxRole = SkillDef['role'] | 'attack'
export type BattleFxPhase = 'windup' | 'travel' | 'impact' | 'recover'

export interface BattleFxDescriptor {
  eventId: string
  actorSide: BattleFxSide
  targetSide: BattleFxSide
  element: SkillDef['element']
  role: BattleFxRole
  phases: BattleFxPhase[]
  damage: number
  durationMs: number
  assetPaths: {
    projectile: string
    impact: string
    aura: string
  }
}

const SELF_ROLES = new Set<BattleFxRole>(['guard', 'dodge', 'support'])

export function battleFxAssets(element: SkillDef['element']): BattleFxDescriptor['assetPaths'] {
  const root = `/battle/fx/${element}`
  return {
    projectile: `${root}/projectile/animation.gif`,
    impact: `${root}/impact/animation.gif`,
    aura: `${root}/aura/animation.gif`
  }
}

export function resolveBattleFx(
  turn: BattleTurn,
  challengerUserId: string,
  defenderUserId: string
): BattleFxDescriptor | null {
  if (turn.action === 'item' || turn.action === 'flee') return null

  const actorSide: BattleFxSide = turn.actorUserId === defenderUserId ? 'defender' : 'challenger'
  const opponentSide: BattleFxSide = actorSide === 'challenger' ? 'defender' : 'challenger'
  const skill = turn.skillId ? getSkillDef(turn.skillId) : undefined
  const role: BattleFxRole = skill?.role
    ?? (turn.action === 'defend' || turn.action === 'shield' ? 'guard'
      : turn.action === 'avoid' ? 'dodge'
        : 'attack')
  const element = skill?.element ?? 'neutral'
  const targetSide = SELF_ROLES.has(role)
    ? actorSide
    : opponentSide

  const phases: BattleFxPhase[] = role === 'pierce'
    ? ['windup', 'travel', 'impact', 'recover']
    : SELF_ROLES.has(role)
      ? ['windup', 'impact', 'recover']
      : ['windup', 'impact', 'recover']

  const durationMs = role === 'ultimate' ? 1100 : role === 'pierce' ? 850 : role === 'heavy' || role === 'burst' ? 800 : 680

  return {
    eventId: turn.id,
    actorSide,
    targetSide,
    element,
    role,
    phases,
    damage: Math.max(0, turn.damage),
    durationMs,
    assetPaths: battleFxAssets(element)
  }
}

export function isSelfBattleFx(fx: BattleFxDescriptor): boolean {
  return fx.actorSide === fx.targetSide
}

export function usesProjectile(fx: BattleFxDescriptor): boolean {
  return fx.role === 'pierce'
}

export function usesAura(fx: BattleFxDescriptor): boolean {
  return isSelfBattleFx(fx) || fx.role === 'mark'
}

export function resolveBattleFighterAnim(
  side: BattleFxSide,
  options: {
    defeated: boolean
    activeFx: BattleFxDescriptor | null
    hit: boolean
  }
): AnimationState {
  if (options.defeated) return 'battle_hurt'
  if (options.activeFx?.actorSide === side && !isSelfBattleFx(options.activeFx)) return 'battle_attack'
  if (options.hit) return 'battle_hurt'
  return 'idle'
}

/** Collect confirmed turns once, preserving server order for the playback queue. */
export function collectUnseenBattleFx(
  turns: BattleTurn[],
  seenTurnIds: Set<string>,
  challengerUserId: string,
  defenderUserId: string
): BattleFxDescriptor[] {
  const descriptors: BattleFxDescriptor[] = []
  for (const turn of turns) {
    if (seenTurnIds.has(turn.id)) continue
    seenTurnIds.add(turn.id)
    const descriptor = resolveBattleFx(turn, challengerUserId, defenderUserId)
    if (descriptor) descriptors.push(descriptor)
  }
  return descriptors
}
