import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { BattleSession, BattleTurn } from '../../shared/battle/types'
import { playBattleOutcome } from '../../shared/audio/battleSfx'

interface Props {
  session: BattleSession
  turns: BattleTurn[]
  userId: string
  onClose: () => void
}

function getWinnerName(turns: BattleTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const msg = turns[i].message
    const winner = msg.match(/^[^:]+:\s*(.+)$/)
    if (winner?.[1]) return winner[1].trim()
  }
  return null
}

export function BattleEndModal({ session, turns, userId, onClose }: Props) {
  const { t } = useTranslation()
  const winnerName = getWinnerName(turns)
  const isWinner = session.winnerUserId === userId
  const fledSelf = session.status === 'fled' && session.fledUserId === userId

  useEffect(() => {
    if (session.status === 'fled' && fledSelf) return
    playBattleOutcome(isWinner)
  }, [session.status, fledSelf, isWinner])

  let title: string
  let subtitle: string

  if (session.status === 'fled') {
    if (fledSelf) {
      title = t('battle.modal.titleFledSelf')
      subtitle = t('battle.modal.subtitleFledSelf')
    } else {
      title = t('battle.modal.titleWin')
      subtitle = t('battle.modal.subtitleEnemyFled')
    }
  } else if (isWinner) {
    title = t('battle.modal.titleWin')
    subtitle = t('battle.modal.subtitleWin')
  } else {
    title = t('battle.modal.titleLose')
    subtitle = winnerName ? t('battle.modal.subtitleWinnerNamed', { winnerName }) : t('battle.modal.subtitleRetry')
  }

  return (
    <div className="battle-end-overlay" role="dialog" aria-modal="true">
      <div className="battle-end-modal card">
        <h3 className={`battle-end-title ${isWinner && !fledSelf ? 'win' : fledSelf || !isWinner ? 'lose' : ''}`}>
          {title}
        </h3>
        <p className="battle-end-subtitle">{subtitle}</p>

        {turns.length > 0 && (
          <div className="battle-log battle-end-log">
            {turns.slice(-5).map((t) => (
              <div key={t.id}>{t.message}</div>
            ))}
          </div>
        )}

        <button type="button" className="primary" onClick={onClose} style={{ marginTop: 16, width: '100%' }}>
          {t('battle.modal.backToRoom')}
        </button>
      </div>
    </div>
  )
}
