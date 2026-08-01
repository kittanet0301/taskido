import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BattleSession } from '../../shared/battle/types'
import { mapBattleSession } from '../../shared/battle/mappers'

type HistoryResult = 'win' | 'lose' | 'fled' | 'cancelled'
type HistoryFilter = 'all' | HistoryResult

function battleResult(battle: BattleSession, userId: string): HistoryResult {
  if (battle.status === 'declined' || battle.status === 'expired') return 'cancelled'
  if (battle.fledUserId === userId) return 'fled'
  return battle.winnerUserId === userId ? 'win' : 'lose'
}

export function BattleHistory() {
  const { t, i18n } = useTranslation()
  const [battles, setBattles] = useState<BattleSession[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<HistoryFilter>('all')

  useEffect(() => {
    ;(async () => {
      const session = (await window.electronAPI.getSession()) as { user: { id: string } } | null
      if (!session?.user?.id) return
      const currentUserId = session.user.id
      setUserId(currentUserId)
      const rows = (await window.electronAPI.listBattles()) as Record<string, unknown>[]
      const mapped = rows
        .map(mapBattleSession)
        .filter((battle) => ['completed', 'fled', 'declined', 'expired'].includes(battle.status))
      setBattles(mapped)

      const ids = [...new Set(mapped.map((battle) =>
        battle.challengerUserId === currentUserId ? battle.defenderUserId : battle.challengerUserId
      ))]
      const profiles = await Promise.all(ids.map(async (id) => {
        try {
          const profile = (await window.electronAPI.getProfile(id)) as { username?: string } | null
          return [id, profile?.username || t('battle.historyUnknownOpponent')] as const
        } catch {
          return [id, t('battle.historyUnknownOpponent')] as const
        }
      }))
      setOpponentNames(Object.fromEntries(profiles))
    })()
  }, [t])

  const counts = useMemo(() => {
    const next = { all: battles.length, win: 0, lose: 0, fled: 0, cancelled: 0 }
    if (!userId) return next
    battles.forEach((battle) => { next[battleResult(battle, userId)] += 1 })
    return next
  }, [battles, userId])

  const visibleBattles = useMemo(() => {
    if (!userId || filter === 'all') return battles
    return battles.filter((battle) => battleResult(battle, userId) === filter)
  }, [battles, filter, userId])

  if (!userId) return null

  const filters: HistoryFilter[] = ['all', 'win', 'lose', 'fled', 'cancelled']

  return (
    <div className="battle-history">
      <header className="battle-history__header">
        <div>
          <span className="battle-history__eyebrow">{t('battle.historyEyebrow')}</span>
          <h3>{t('battle.historyTitle')}</h3>
          <p>{t('battle.historySubtitle')}</p>
        </div>
        <div className="battle-history__total">
          <strong>{counts.all}</strong>
          <span>{t('battle.historyTotalBattles')}</span>
        </div>
      </header>

      <div className="battle-history__stats" aria-label={t('battle.historySummary')}>
        {(['win', 'lose', 'fled', 'cancelled'] as HistoryResult[]).map((result) => (
          <div key={result} className={`battle-history-stat battle-history-stat--${result}`}>
            <span>{t(`battle.historyFilter.${result}`)}</span>
            <strong>{counts[result]}</strong>
          </div>
        ))}
      </div>

      <div className="battle-history__toolbar">
        <strong>{t('battle.historyRecent')}</strong>
        <div className="battle-history__filters">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'is-active' : ''}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {t(`battle.historyFilter.${item}`)} <span>{counts[item]}</span>
            </button>
          ))}
        </div>
      </div>

      {visibleBattles.length === 0 ? (
        <div className="battle-history__empty">
          <span aria-hidden>⚔</span>
          <strong>{t('battle.historyEmpty')}</strong>
          <p>{t('battle.historyEmptyHint')}</p>
        </div>
      ) : (
        <ol className="battle-history__list">
          {visibleBattles.map((battle) => {
            const result = battleResult(battle, userId)
            const isChallenger = battle.challengerUserId === userId
            const opponentId = isChallenger ? battle.defenderUserId : battle.challengerUserId
            const myHp = isChallenger ? battle.challengerHp : battle.defenderHp
            const opponentHp = isChallenger ? battle.defenderHp : battle.challengerHp
            const myHpStart = isChallenger ? battle.challengerHpStart : battle.defenderHpStart
            const opponentHpStart = isChallenger ? battle.defenderHpStart : battle.challengerHpStart
            const label = battle.status === 'declined'
              ? t('battle.resultDeclined')
              : battle.status === 'expired'
                ? t('battle.resultExpired')
                : battle.status === 'fled'
                  ? battle.fledUserId === userId
                    ? t('battle.resultFledSelf')
                    : t('battle.resultFledEnemy')
                  : result === 'win' ? t('battle.resultWin') : t('battle.resultLose')
            const date = new Date(battle.createdAt)

            return (
              <li key={battle.id} className={`battle-history-card battle-history-card--${result}`}>
                <div className="battle-history-card__result">
                  <span>{label}</span>
                  <small>{isChallenger ? t('battle.historyChallenger') : t('battle.historyDefender')}</small>
                </div>
                <div className="battle-history-card__opponent">
                  <span className="battle-history-card__avatar" aria-hidden>⚔</span>
                  <div>
                    <small>{t('battle.historyOpponent')}</small>
                    <strong>{opponentNames[opponentId] ?? t('battle.historyUnknownOpponent')}</strong>
                  </div>
                </div>
                <div className="battle-history-card__hp">
                  <small>{t('battle.historyRemainingHp')}</small>
                  <div>
                    <span>{t('battle.historyYou')} <strong>{myHp}</strong>/{myHpStart}</span>
                    <i aria-hidden>VS</i>
                    <span>{t('battle.historyEnemy')} <strong>{opponentHp}</strong>/{opponentHpStart}</span>
                  </div>
                </div>
                <time dateTime={battle.createdAt}>
                  <strong>{date.toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                  <span>{date.toLocaleTimeString(i18n.language === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </time>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
