import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BattleCommand, BattleSession, BattleTurn } from '../../shared/battle/types'
import type { BattleConsumableCounts, BotDifficulty } from '../../shared/battle/bot'
import { TP_MAX } from '../../shared/battle/constants'
import type { PetData } from '../../shared/types'
import { DinoSprite } from '../../components/DinoSprite'
import { getSkillDef, skillPower } from '../../shared/battle/skillTrees'
import { deriveCombatStats } from '../../shared/combatStats'

type MenuView = 'commands' | 'items'

interface Props {
  session: BattleSession
  turns: BattleTurn[]
  userId: string
  challengerName?: string
  defenderName?: string
  challengerPet?: PetData | null
  defenderPet?: PetData | null
  shieldCount?: number
  battleItemCounts?: BattleConsumableCounts
  mode?: 'pvp' | 'bot'
  wave?: number
  totalWaves?: number
  difficulty?: BotDifficulty
  paused?: boolean
  auto?: boolean
  speed?: 1 | 1.5
  onTogglePause?: () => void
  onToggleAuto?: () => void
  onToggleSpeed?: () => void
  rewardPreview?: { gems: number; evolution: number; dropChance: number }
  announcement?: string | null
  onAction: (command: BattleCommand, extra?: { skillId?: string; itemType?: string }) => Promise<void>
}

function ResourceBar({
  label,
  value,
  max,
  className
}: {
  label: string
  value: number
  max: number
  className: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={`rpg-bar ${className}`}>
      <div className="rpg-bar-label"><span>{label}</span><span>{value}/{max}</span></div>
      <div className="rpg-bar-track"><div className="rpg-bar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function ElementBadges({ pet }: { pet: PetData | null | undefined }) {
  if (!pet) return null
  return (
    <div className="rpg-elements" aria-hidden>
      <span className={`rpg-element rpg-element--${pet.elementPrimary}`}>{pet.elementPrimary}</span>
      {pet.elementSecondary && <span className={`rpg-element rpg-element--${pet.elementSecondary}`}>{pet.elementSecondary}</span>}
    </div>
  )
}

export function BattleArena({
  session,
  turns,
  userId,
  challengerName,
  defenderName,
  challengerPet,
  defenderPet,
  shieldCount = 0,
  battleItemCounts,
  mode = 'pvp',
  wave = 1,
  totalWaves = 1,
  difficulty,
  paused = false,
  auto = false,
  speed = 1,
  onTogglePause,
  onToggleAuto,
  onToggleSpeed,
  rewardPreview,
  announcement,
  onAction
}: Props) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [menu, setMenu] = useState<MenuView>('commands')
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    if (!logOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLogOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [logOpen])

  const isChallenger = session.challengerUserId === userId
  const myTurn = session.turnUserId === userId && session.status === 'active'
  const myPet = isChallenger ? challengerPet : defenderPet
  const myHp = isChallenger ? session.challengerHp : session.defenderHp
  const myHpStart = isChallenger ? session.challengerHpStart : session.defenderHpStart
  const myMp = isChallenger ? session.challengerMp : session.defenderMp
  const myTp = isChallenger ? session.challengerTp : session.defenderTp
  const myMpMax = myPet ? deriveCombatStats(myPet.primaries).maxMp : Math.max(myMp, 1)
  const challengerMpMax = challengerPet
    ? deriveCombatStats(challengerPet.primaries).maxMp
    : Math.max(session.challengerMp, 1)
  const defenderMpMax = defenderPet
    ? deriveCombatStats(defenderPet.primaries).maxMp
    : Math.max(session.defenderMp, 1)
  const loadout = myPet?.skillLoadout?.slots ?? []
  const latestTurn = turns[turns.length - 1]
  const latestHasDamage = (latestTurn?.damage ?? 0) > 0
  const challengerActing = latestTurn?.actorUserId === session.challengerUserId
  const challengerHit = latestHasDamage && !challengerActing
  const defenderHit = latestHasDamage && challengerActing

  const act = async (command: BattleCommand, extra?: { skillId?: string; itemType?: string }) => {
    if (!myTurn || submitting) return
    setSubmitting(true)
    try {
      await onAction(command, extra)
      setMenu('commands')
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = (() => {
    switch (session.status) {
      case 'active':
        return myTurn && !submitting ? t('battle.statusYourTurn') : t('battle.statusWaitingOpponent')
      case 'completed':
        return t('battle.statusCompleted')
      case 'fled':
        return t('battle.statusFled')
      case 'declined':
        return t('battle.statusDeclined')
      case 'expired':
        return t('battle.statusExpired')
      case 'pending':
        return t('battle.statusPending')
    }
  })()

  return (
    <div className="battle-arena rpg-arena">
      <div className="rpg-battle-bar">
        <strong>⚔ {t('battle.title')} {mode === 'bot' && <small>{t('battle.bot.wave', { current: wave, total: totalWaves })}</small>}</strong>
        <span>{mode === 'bot' ? t('battle.bot.modeLabel') : t('battle.tabs.active')}</span>
        <span>{t('battle.bot.turnNumber', { count: Math.floor(turns.length / 2) + 1 })}</span>
        <div className="rpg-play-controls">
          {mode === 'bot' && <>
            <button type="button" onClick={onToggleSpeed}><img className="rpg-control-icon" src="/battle/control-icons/speed.png" alt="" />×{speed}</button>
            <button
              type="button"
              className={paused ? 'active' : ''}
              onClick={onTogglePause}
              aria-label={paused ? t('battle.bot.resume') : t('battle.bot.pause')}
              title={paused ? t('battle.bot.resume') : t('battle.bot.pause')}
            ><img className="rpg-control-icon" src="/battle/control-icons/pause.png" alt="" />{paused ? t('battle.bot.resume') : t('battle.bot.pause')}</button>
            <button type="button" className={auto ? 'active' : ''} onClick={onToggleAuto}>{t('battle.bot.auto')}</button>
          </>}
          <button type="button" className="rpg-log-button" onClick={() => setLogOpen(true)}>
            <img className="rpg-control-icon" src="/battle/control-icons/log.png" alt="" />{t('battle.logButton')}
            {turns.length > 0 && <span className="rpg-log-count">{turns.length}</span>}
          </button>
        </div>
      </div>

      <div className="rpg-scene">
        {announcement && <div className="rpg-wave-notice" role="status">{announcement}</div>}
        <div className="rpg-scene-statuses">
          <div className={`rpg-status${session.status === 'active' && session.turnUserId === session.challengerUserId ? ' is-active-turn' : ''}`}>
            <div className="rpg-status-head"><strong>{challengerPet?.name ?? challengerName}</strong><ElementBadges pet={challengerPet} /></div>
            <ResourceBar label="HP" value={session.challengerHp} max={session.challengerHpStart || 1} className="rpg-bar--hp" />
            <ResourceBar label="MP" value={session.challengerMp} max={challengerMpMax} className="rpg-bar--mp" />
          </div>
          <div className={`rpg-turn-status${myTurn && !submitting ? ' rpg-turn-status--yours' : ' rpg-turn-status--waiting'}`} role="status" aria-live="polite">
            <span className="rpg-turn-status__spark" aria-hidden />
            <strong>{statusLabel}</strong>
          </div>
          <div className={`rpg-status rpg-status--enemy${session.status === 'active' && session.turnUserId === session.defenderUserId ? ' is-active-turn' : ''}`}>
            <div className="rpg-status-head"><strong>{defenderPet?.name ?? defenderName}</strong><ElementBadges pet={defenderPet} /></div>
            <ResourceBar label="HP" value={session.defenderHp} max={session.defenderHpStart || 1} className="rpg-bar--hp" />
            <ResourceBar label="MP" value={session.defenderMp} max={defenderMpMax} className="rpg-bar--mp" />
          </div>
        </div>

        <div className={`rpg-scene-main${mode === 'bot' && rewardPreview ? ' rpg-scene-main--with-info' : ''}`}>
          <div className="battle-stage rpg-stage">
          <div className={`battle-fighter battle-fighter--player${challengerHit ? ' is-hit' : ''}${latestHasDamage && challengerActing ? ' is-attacking' : ''}`}>
            <div className="battle-fighter-sprite">
              {challengerPet ? <DinoSprite pet={challengerPet} size={176} movementAnim="idle" /> : <div className="battle-fighter-placeholder" aria-hidden />}
              {session.challengerDefending && <span className="battle-fighter-badge">{t('battle.defend')}</span>}
            </div>
            {challengerHit && latestHasDamage && latestTurn && <span
              key={latestTurn.id}
              className="rpg-floating-damage"
              aria-hidden
            >-{latestTurn.damage}</span>}
            <div className="rpg-mini-hp">{challengerName ?? t('battle.challenger')}</div>
          </div>
          <div className="battle-vs">VS</div>
          <div className={`battle-fighter battle-fighter--enemy${defenderHit ? ' is-hit' : ''}${latestHasDamage && !challengerActing ? ' is-attacking' : ''}`}>
            <div className="battle-fighter-sprite battle-fighter-sprite--flip">
              {defenderPet ? <DinoSprite pet={defenderPet} size={176} movementAnim="idle" /> : <div className="battle-fighter-placeholder" aria-hidden />}
              {session.defenderDefending && <span className="battle-fighter-badge">{t('battle.defend')}</span>}
            </div>
            {defenderHit && latestHasDamage && latestTurn && <span
              key={latestTurn.id}
              className="rpg-floating-damage"
              aria-hidden
            >-{latestTurn.damage}</span>}
            <div className="rpg-mini-hp">{defenderName ?? t('battle.defender')}</div>
          </div>
          </div>

          {mode === 'bot' && rewardPreview && <aside className="rpg-battle-info">
            <h3>{t('battle.bot.battleInfo')}</h3>
            <p><strong>{t('battle.bot.winCondition')}</strong><br />{t('battle.bot.defeatAll')}</p>
            <p><strong>{t('battle.bot.reward')}</strong></p>
            <div className="rpg-reward-preview">
              <span><img src="/ui/hud-stat-gems.png" alt="" />{rewardPreview.gems}</span>
              <span>EXP {rewardPreview.evolution}</span>
            </div>
            <p><img className="rpg-info-chest" src="/battle/generated-icons/battle-icon-4.png" alt="" /> {t('battle.bot.dropChance', { chance: Math.round(rewardPreview.dropChance * 100) })}</p>
            {difficulty && <span className={`rpg-difficulty rpg-difficulty--${difficulty}`}>{t(`battle.bot.difficulties.${difficulty}`)}</span>}
          </aside>}
        </div>

        <div className="rpg-command-dock">
          <ResourceBar label="TP" value={myTp} max={TP_MAX} className="rpg-bar--tp rpg-tp-wide" />

          {session.status === 'active' && (
            <div className="rpg-bottom">
              {menu === 'commands' && (
                <div className="rpg-command-layout">
                  <div className="rpg-quick-skills">
                    {loadout.slice(0, 4).map((slot) => {
                      const def = getSkillDef(slot.pathId)
                      const isUlt = slot.kind === 'ultimate'
                      const needTp = isUlt && myTp < TP_MAX
                      const needMp = !isUlt && def != null && myMp < def.mpCost
                      const label = t(`skills.${slot.pathId}`, { defaultValue: slot.pathId.replace(/_/g, ' ') })
                      const damage = def ? skillPower(def, slot.rank) : 0
                      const effectLabel = damage > 0
                        ? `DMG ${damage}`
                        : def?.role === 'guard'
                          ? 'DEF ↑'
                          : def?.role === 'dodge'
                            ? 'DODGE ↑'
                            : 'BUFF'
                      return (
                        <button key={`${slot.pathId}-${slot.kind}`} type="button" className={`rpg-quick-skill rpg-quick-skill--${slot.element}${isUlt ? ' rpg-quick-skill--ultimate' : ''}`} disabled={!myTurn || submitting || needTp || needMp} title={isUlt ? t('battle.ultimateNeedEnergy', { required: TP_MAX, current: myTp }) : def ? `MP ${def.mpCost} · Lv${slot.rank}` : undefined} onClick={() => void act('skill', { skillId: slot.pathId })}>
                          <span className="rpg-quick-skill__name"><span aria-hidden>{isUlt ? '★' : '✦'}</span>{label}</span>
                          <span className="rpg-quick-skill__stats">
                            <small className="rpg-quick-skill__effect">{effectLabel}</small>
                            <small>{isUlt ? `TP ${TP_MAX}` : def ? `MP ${def.mpCost}` : `Lv ${slot.rank}`}</small>
                          </span>
                        </button>
                      )
                    })}
                    {loadout.length === 0 && <p className="rpg-hint rpg-quick-skills__empty">{t('battle.noSkills')}</p>}
                  </div>
                  <div className="rpg-core-commands">
                    <button type="button" className="primary rpg-attack-command" disabled={!myTurn || submitting} onClick={() => void act('attack')}><img src="/battle/command-icons/attack.png" alt="" />{t('battle.attack')}</button>
                    <button type="button" className="secondary" disabled={!myTurn || submitting} onClick={() => void act('defend')}><img src="/battle/command-icons/defend.png" alt="" />{t('battle.defend')}</button>
                    <button type="button" className="secondary" disabled={!myTurn || submitting} onClick={() => setMenu('items')}><img src="/battle/command-icons/item.png" alt="" />{t('battle.itemMenu')}</button>
                    <button type="button" className="danger-btn" disabled={!myTurn || submitting} onClick={() => void act('flee')}><img src="/battle/command-icons/flee.png" alt="" />{t('battle.flee')}</button>
                  </div>
                </div>
              )}

              {menu === 'items' && (
                <div className="rpg-submenu">
                  <button type="button" className="secondary rpg-back" onClick={() => setMenu('commands')}>{t('battle.back')}</button>
                  <div className="rpg-skill-grid">
                    {battleItemCounts && (
                      <>
                        <button type="button" className="secondary rpg-item-card" disabled={!myTurn || submitting || battleItemCounts.health_potion <= 0 || myHp >= myHpStart} onClick={() => void act('item', { itemType: 'health_potion' })}>
                          <img className="rpg-item-image" src="/battle/generated-icons/battle-icon-1.png" alt="" />{t('battle.bot.items.health_potion.label')} ×{battleItemCounts.health_potion}
                        </button>
                        <button type="button" className="secondary rpg-item-card" disabled={!myTurn || submitting || battleItemCounts.mana_potion <= 0 || myMp >= myMpMax} onClick={() => void act('item', { itemType: 'mana_potion' })}>
                          <img className="rpg-item-image" src="/battle/generated-icons/battle-icon-2.png" alt="" />{t('battle.bot.items.mana_potion.label')} ×{battleItemCounts.mana_potion}
                        </button>
                      </>
                    )}
                    {mode === 'pvp' && <button type="button" className="secondary" disabled={!myTurn || submitting || shieldCount <= 0} onClick={() => void act('item', { itemType: 'battle_shield' })}>{t('items.battle_shield.label')} ×{shieldCount}</button>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {logOpen && <div
        className="rpg-log-overlay"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) setLogOpen(false)
        }}
      >
        <section className="rpg-log-dialog" role="dialog" aria-modal="true" aria-labelledby="battle-log-title">
          <header className="rpg-log-dialog__head">
            <h2 id="battle-log-title"><span aria-hidden>▤</span> {t('battle.logTitle')}</h2>
            <button type="button" className="rpg-log-close" aria-label={t('battle.closeLog')} autoFocus onClick={() => setLogOpen(false)}>×</button>
          </header>
          <div className="battle-log rpg-log rpg-log-dialog__list">
            {turns.length > 0
              ? turns.map((turn) => <div key={turn.id}>{turn.message}</div>)
              : <p className="rpg-log-empty">{t('battle.logEmpty')}</p>}
          </div>
        </section>
      </div>}
    </div>
  )
}
