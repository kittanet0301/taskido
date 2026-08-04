import { useTranslation } from 'react-i18next'
import type { SkillSlot } from '../shared/battle/skillTrees'
import { getSkillDef, skillPower, SKILL_RANK_MAX } from '../shared/battle/skillTrees'
import { SkillIcon } from './SkillIcon'

interface Props {
  slot: SkillSlot
}

/** Name + kind/element/rank + power/MP (or TP for ultimates). */
export function SkillSlotSummary({ slot }: Props) {
  const { t } = useTranslation()
  const def = getSkillDef(slot.pathId)
  const power = def ? skillPower(def, slot.rank) : 0

  const effectLine = (() => {
    if (!def) return null
    const parts: string[] = []
    if (power > 0) {
      parts.push(t('skills.statPower', { power }))
    } else {
      parts.push(t(`skills.role.${def.role}`, { defaultValue: def.role }))
    }
    if (def.kind === 'ultimate' || def.tpCost > 0) {
      parts.push(t('skills.statTp', { tp: def.tpCost }))
    } else {
      parts.push(t('skills.statMp', { mp: def.mpCost }))
    }
    return parts.join(' · ')
  })()

  return (
    <div className="pet-profile-skill-summary">
      <SkillIcon pathId={slot.pathId} className="pet-profile-skill-icon" />
      <div className="pet-profile-skill-info">
        <strong>{t(`skills.${slot.pathId}`, { defaultValue: def?.pathId ?? slot.pathId })}</strong>
        <span>
          {slot.kind === 'ultimate' ? t('battle.ultimate') : t('battle.skillMenu')} ·{' '}
          {t(`elements.${slot.element}`)} ·{' '}
          {t('skills.rankLabel', { rank: slot.rank, max: SKILL_RANK_MAX })}
        </span>
        {effectLine && <span className="pet-profile-skill-stats">{effectLine}</span>}
      </div>
    </div>
  )
}
