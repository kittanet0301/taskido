import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioMuteButton } from '../components/AudioMuteButton'
import type { GameSpeedMultiplier } from '../shared/gameSpeed'

interface Props {
  displayName?: string
  gems: number
  clicks: number
  keystrokes: number
  activityScore: number
  gameSpeed: GameSpeedMultiplier
  syncing: boolean
  children?: ReactNode
}

const STAT_ICON_SRC = {
  gems: '/ui/hud-stat-gems.png',
  clicks: '/ui/hud-stat-clicks.png',
  typing: '/ui/hud-stat-typing.png',
  activity: '/ui/hud-stat-activity.png'
} as const

export function HubTopBar({
  displayName,
  gems,
  clicks,
  keystrokes,
  activityScore,
  gameSpeed,
  syncing,
  children
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="hub-topbar" aria-label={t('home.todayActivity')}>
      <img
        className="hub-topbar-logo"
        src="/ui/taskino-logo.png"
        alt={t('app.appName')}
        draggable={false}
      />
      <div className="hub-topbar-stats">
        <div className="dash-hud-counter dash-hud-counter--gem">
          <img className="dash-hud-counter-icon" src={STAT_ICON_SRC.gems} alt="" draggable={false} />
          <span>{t('home.gems')}</span>
          <strong>{gems.toLocaleString()}</strong>
        </div>
        <div className="dash-hud-counter">
          <img className="dash-hud-counter-icon" src={STAT_ICON_SRC.clicks} alt="" draggable={false} />
          <span>{t('home.clicks')}</span>
          <strong>{clicks.toLocaleString()}</strong>
        </div>
        <div className="dash-hud-counter">
          <img className="dash-hud-counter-icon" src={STAT_ICON_SRC.typing} alt="" draggable={false} />
          <span>{t('home.typing')}</span>
          <strong>{keystrokes.toLocaleString()}</strong>
        </div>
        <div className="dash-hud-counter">
          <img className="dash-hud-counter-icon" src={STAT_ICON_SRC.activity} alt="" draggable={false} />
          <span>{t('home.activityScore')}</span>
          <strong>{activityScore.toLocaleString()}</strong>
        </div>
        {gameSpeed > 1 && (
          <div className="hub-topbar-speed" aria-label={`${t('admin.gameSpeedTitle')} X${gameSpeed}`}>
            <span>{t('admin.gameSpeedTitle')}</span>
            <strong>X{gameSpeed}</strong>
          </div>
        )}
      </div>
      {syncing && <div className="hub-topbar-sync">{t('app.syncing')}</div>}
      <div className="hub-topbar-extra">
        {displayName ? (
          <div className="hub-topbar-player" title={displayName}>
            <span>{displayName}</span>
          </div>
        ) : null}
        {children}
        <AudioMuteButton variant="hub" />
      </div>
    </div>
  )
}
