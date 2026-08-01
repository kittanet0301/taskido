import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave } from '../../../shared/types'
import type { MinigameFinishResult } from '../../../shared/minigame'
import {
  MINIGAME_DAILY_ITEM_LIMIT,
  getMinigameDefinition,
  minigameItemsLeft
} from '../../../shared/minigame'
import { ITEM_ICON_SRC } from '../../../shared/itemIcons'
import { tItemLabel } from '../../../i18n/labels'
import { RockDodgeCanvas } from './RockDodgeCanvas'

type Phase = 'pregame' | 'playing' | 'gameover'

interface Props {
  save: GameSave
  onUpdated: () => void
  onBack: () => void
}

const GAME_ID = 'rock_dodge' as const

export function RockDodgeGame({ save, onUpdated, onBack }: Props) {
  const { t } = useTranslation()
  const def = getMinigameDefinition(GAME_ID)
  const threshold = def?.scoreThreshold ?? 1000
  const rewardPool = def?.rewardPool ?? []
  const [phase, setPhase] = useState<Phase>('pregame')
  const [finishResult, setFinishResult] = useState<MinigameFinishResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const finishedRef = useRef(false)

  const itemsLeft = minigameItemsLeft(save, GAME_ID)
  const bestScore = save.minigame?.bestScores[GAME_ID] ?? 0

  const handleGameOver = useCallback(
    async (score: number) => {
      if (finishedRef.current) return
      finishedRef.current = true
      setSubmitting(true)
      setPhase('gameover')
      try {
        const { result } = await window.electronAPI.finishMinigame(GAME_ID, score)
        setFinishResult(result)
        onUpdated()
        try {
          await window.electronAPI.submitMinigameScore(GAME_ID, score)
        } catch (e) {
          console.warn('[minigame] submit score failed:', e)
        }
      } finally {
        setSubmitting(false)
      }
    },
    [onUpdated]
  )

  const startRun = () => {
    finishedRef.current = false
    setFinishResult(null)
    setPhase('playing')
  }

  const playAgain = () => {
    finishedRef.current = false
    setFinishResult(null)
    setPhase('playing')
  }

  return (
    <div className="minigame-play card">
      <div className="minigame-play-header">
        <button type="button" className="secondary" onClick={onBack}>
          {t('minigame.backToHub')}
        </button>
        <div className="minigame-play-meta">
          <span>{t('minigame.itemsLeft', { left: itemsLeft, total: MINIGAME_DAILY_ITEM_LIMIT })}</span>
          <span>{t('minigame.rockDodge.goal', { count: threshold })}</span>
          <span>{t('minigame.rockDodge.bestEggs', { count: bestScore })}</span>
        </div>
      </div>

      <div className="minigame-stage">
        <RockDodgeCanvas
          save={save}
          running={phase === 'playing'}
          onScoreChange={() => {}}
          onGameOver={handleGameOver}
        />

        {phase === 'pregame' && (
          <div className="minigame-overlay">
            <div className="minigame-overlay-panel">
              <h3>{t('minigame.rockDodge.title')}</h3>
              <p className="minigame-overlay-text">{t('minigame.rockDodge.description')}</p>
              <p className="minigame-overlay-text">{t('minigame.rockDodge.controlsHint')}</p>
              <p className="minigame-overlay-text">{t('minigame.rockDodge.difficultyHint')}</p>
              {rewardPool.length > 0 && (
                <div className="minigame-overlay-rewards">
                  <span className="minigame-overlay-text">{t('minigame.rewardPoolLabel')}</span>
                  <div className="minigame-overlay-reward-icons">
                    {rewardPool.map((type) => (
                      <img
                        key={type}
                        className="minigame-overlay-reward-icon"
                        src={ITEM_ICON_SRC[type]}
                        alt={tItemLabel(type)}
                        title={tItemLabel(type)}
                        draggable={false}
                      />
                    ))}
                  </div>
                </div>
              )}
              <button type="button" className="primary" onClick={startRun}>
                {t('minigame.start')}
              </button>
            </div>
          </div>
        )}

        {phase === 'gameover' && !finishResult && (
          <div className="minigame-overlay">
            <div className="minigame-overlay-panel">
              <p className="minigame-overlay-text">{t('app.syncing')}</p>
            </div>
          </div>
        )}

        {phase === 'gameover' && finishResult && (
          <div className="minigame-overlay">
            <div className="minigame-overlay-panel">
              <h3>
                {finishResult.score >= threshold
                  ? t('minigame.rockDodge.passed')
                  : t('minigame.gameOver')}
              </h3>
              <p className="minigame-score-line">
                {t('minigame.rockDodge.eggsCollected', { count: finishResult.score })}
              </p>
              <p className="minigame-overlay-text">
                {t('minigame.rockDodge.bestEggs', { count: finishResult.bestScore })}
              </p>

              {finishResult.rewarded && finishResult.reward ? (
                <div className="minigame-reward-line">
                  <img
                    className="minigame-reward-icon"
                    src={ITEM_ICON_SRC[finishResult.reward.type]}
                    alt=""
                    draggable={false}
                  />
                  <span>
                    {t('minigame.randomRewardEarned', {
                      item: tItemLabel(finishResult.reward.type),
                      quantity: finishResult.reward.quantity
                    })}
                  </span>
                </div>
              ) : finishResult.reason === 'below_threshold' ? (
                <p className="minigame-overlay-text">
                  {t('minigame.rockDodge.belowGoal', { count: threshold })}
                </p>
              ) : (
                <p className="minigame-overlay-text">{t('minigame.noRewardsLeft')}</p>
              )}

              <p className="minigame-overlay-text">
                {t('minigame.itemsLeft', {
                  left: finishResult.itemsLeft,
                  total: MINIGAME_DAILY_ITEM_LIMIT
                })}
              </p>

              <div className="minigame-overlay-actions">
                <button type="button" className="primary" onClick={playAgain} disabled={submitting}>
                  {t('minigame.playAgain')}
                </button>
                <button type="button" className="secondary" onClick={onBack}>
                  {t('minigame.backToHub')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
