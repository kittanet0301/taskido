import type { BattleActionType } from './types'
import i18n from '../../i18n'
import { tCharacter } from '../../i18n/labels'

const ATTACK_VERB_KEY: Record<string, string> = {
  bite: 'battle.bite',
  jump: 'battle.jump',
  tailwhip: 'battle.tailwhip',
  attack: 'battle.bite'
}

export function formatActionMessage(
  actorName: string,
  targetName: string,
  action: BattleActionType,
  damage: number,
  actorCharacter?: string
): string {
  if (action === 'ultimate' && actorCharacter) {
    return formatUltimateMessage(actorName, targetName, actorCharacter, damage)
  }
  const verbKey = ATTACK_VERB_KEY[action] ?? 'battle.bite'
  return `${actorName} ${i18n.t(verbKey)} ${targetName} -${damage} HP`
}

export function formatAttackMessage(
  actorName: string,
  targetName: string,
  damage: number
): string {
  return `${actorName} ${i18n.t('battle.bite')} ${targetName} -${damage} HP`
}

export function formatSkillMessage(
  actorName: string,
  skillPathId: string,
  damage: number,
  targetName?: string
): string {
  const label = i18n.t(`skills.${skillPathId}`, {
    defaultValue: skillPathId.replace(/_/g, ' ')
  })
  if (damage <= 0) {
    return `${actorName} → ${label}`
  }
  if (targetName) {
    return `${actorName} → ${label} · ${targetName} -${damage} HP`
  }
  return `${actorName} → ${label} -${damage} HP`
}

export function formatItemShieldMessage(actorName: string): string {
  const label = i18n.t('items.battle_shield.label', { defaultValue: 'Battle Shield' })
  return `${actorName} → ${label}`
}

export function formatBattleConsumableMessage(
  actorName: string,
  itemType: 'health_potion' | 'mana_potion',
  amount: number
): string {
  const label = i18n.t(`battle.bot.items.${itemType}.label`, {
    defaultValue: itemType === 'health_potion' ? 'Health Potion' : 'Mana Potion'
  })
  const resource = itemType === 'health_potion' ? 'HP' : 'MP'
  return `${actorName} → ${label} +${amount} ${resource}`
}

export function formatUltimateMessage(
  actorName: string,
  targetName: string,
  character: string,
  damage: number
): string {
  const move = `${tCharacter(character)} ${i18n.t('battle.ultimate')}`
  return `${actorName} ${i18n.t('battle.ultimate')} "${move}" ${targetName} -${damage} HP`
}

export function formatUltimateFallbackMessage(
  actorName: string,
  targetName: string,
  damage: number
): string {
  return `${actorName} ${i18n.t('battle.bite')} ${targetName} -${damage} HP`
}

export function formatShieldMessage(actorName: string): string {
  return `${actorName} ${i18n.t('battle.shield')}`
}

export function formatDefendMessage(actorName: string): string {
  return `${actorName} ${i18n.t('battle.defend')}`
}

export function formatAvoidMessage(actorName: string): string {
  return `${actorName} ${i18n.t('battle.avoid')}`
}

export function formatDodgeMessage(dodgerName: string, attackerName: string): string {
  return i18n.t('battle.dodged', { dodgerName, attackerName })
}

export function formatFleeMessage(actorName: string): string {
  return `${actorName} ${i18n.t('battle.flee')}`
}

export function formatWinnerMessage(winnerName: string): string {
  return i18n.t('battle.modal.subtitleWinnerNamed', { winnerName })
}
