import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave, MinigameId } from '../../shared/types'
import {
  MINIGAME_DAILY_ITEM_LIMIT,
  MINIGAME_REGISTRY,
  getMinigameDefinition,
  minigameItemsLeft
} from '../../shared/minigame'
import { ITEM_ICON_SRC } from '../../shared/itemIcons'
import { tItemLabel } from '../../i18n/labels'
import { DinoJumpGame } from './dino-jump/DinoJumpGame'
import { RockDodgeGame } from './rock-dodge/RockDodgeGame'
import { MiniGameRanking } from './MiniGameRanking'

interface Props {
  save: GameSave
  onUpdated: () => void
  onClose: () => void
}

type MinigameView = 'games' | 'ranking'

export function MiniGameHub({ save, onUpdated, onClose }: Props) {
  const { t } = useTranslation()
  const [activeGame, setActiveGame] = useState<MinigameId | null>(null)
  const [view, setView] = useState<MinigameView>('games')

  const activeDef = activeGame ? getMinigameDefinition(activeGame) : undefined
  const headTitle =
    activeDef != null
      ? t(activeDef.titleKey)
      : view === 'ranking'
        ? t('ranking.title')
        : t('minigame.title')

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-modal hub-modal--lg minigame-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="hub-modal-head">
          <h2>{headTitle}</h2>
          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        {activeGame === 'dino_jump' ? (
          <DinoJumpGame save={save} onUpdated={onUpdated} onBack={() => setActiveGame(null)} />
        ) : activeGame === 'rock_dodge' ? (
          <RockDodgeGame save={save} onUpdated={onUpdated} onBack={() => setActiveGame(null)} />
        ) : view === 'ranking' ? (
          <MiniGameRanking onBack={() => setView('games')} />
        ) : (
          <div className="minigame-hub">
            <div className="card minigame-hub-header">
              <p className="pixel-muted-text">{t('minigame.subtitle')}</p>
              <button type="button" className="secondary" onClick={() => setView('ranking')}>
                {t('tabs.ranking')}
              </button>
            </div>

            <div className="minigame-grid">
              {MINIGAME_REGISTRY.map((game) => {
                const def = getMinigameDefinition(game.id)
                const itemsLeft = minigameItemsLeft(save, game.id)
                const best = save.minigame?.bestScores[game.id] ?? 0
                return (
                  <article key={game.id} className="card minigame-card">
                    <h3>{t(game.titleKey)}</h3>
                    <p className="pixel-muted-text">{t(game.descriptionKey)}</p>
                    <div className="minigame-card-reward">
                      {(def?.rewardPool ?? []).map((type) => (
                        <img
                          key={type}
                          className="hud-icon minigame-card-reward-icon"
                          src={ITEM_ICON_SRC[type]}
                          alt={tItemLabel(type)}
                          title={tItemLabel(type)}
                          draggable={false}
                        />
                      ))}
                      <span>
                        {t('minigame.rewardItems', {
                          items: (def?.rewardPool ?? []).map((type) => tItemLabel(type)).join(', ')
                        })}
                      </span>
                    </div>
                    <ul className="minigame-card-stats">
                      <li>{t('minigame.itemsLeft', { left: itemsLeft, total: MINIGAME_DAILY_ITEM_LIMIT })}</li>
                      <li>
                        {game.id === 'rock_dodge'
                          ? t('minigame.rockDodge.goal', { count: def?.scoreThreshold ?? 100 })
                          : t('minigame.scoreThreshold1000', { score: def?.scoreThreshold ?? 1000 })}
                      </li>
                      <li>
                        {game.id === 'rock_dodge'
                          ? t('minigame.rockDodge.bestEggs', { count: best })
                          : t('minigame.yourBest', { score: best })}
                      </li>
                    </ul>
                    <button type="button" className="primary" onClick={() => setActiveGame(game.id)}>
                      {t('minigame.start')}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
