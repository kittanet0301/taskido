import { useTranslation } from 'react-i18next'

export type HubSidebarTarget =
  | 'collection'
  | 'inventory'
  | 'market'
  | 'community'
  | 'minigame'
  | 'battle'
  | 'admin'
  | 'settings'

interface Props {
  activeTarget: HubSidebarTarget | null
  displayName: string
  disabled?: boolean
  focusMode?: boolean
  /** Show Admin sidebar entry (admin accounts only). */
  showAdmin?: boolean
  badges?: Partial<Record<HubSidebarTarget, number>>
  onNavigate: (target: HubSidebarTarget) => void
  onAvatarClick?: () => void
}

const AVATAR_ICON_SRC = '/ui/hud-icon-dino.png'

const NAV_ICON_SRC: Record<HubSidebarTarget, string> = {
  collection: '/ui/hud-icon-collection.png',
  inventory: '/ui/hud-icon-inventory.png',
  market: '/ui/hud-icon-market.png',
  community: '/ui/hud-icon-community.png',
  minigame: '/ui/hud-icon-minigame.png',
  battle: '/ui/hud-icon-battle.png',
  admin: '/ui/hud-icon-missions.png',
  settings: '/ui/hud-icon-settings.png'
}

export function HubSidebar({
  activeTarget,
  displayName,
  disabled,
  focusMode = false,
  showAdmin = false,
  badges,
  onNavigate,
  onAvatarClick
}: Props) {
  const { t } = useTranslation()

  const items: Array<{ id: HubSidebarTarget; label: string }> = [
    { id: 'collection', label: t('tabs.collection') },
    { id: 'inventory', label: t('inventory.title') },
    { id: 'market', label: t('tabs.market') },
    { id: 'community', label: t('tabs.friends') },
    { id: 'minigame', label: t('tabs.minigame') },
    { id: 'battle', label: t('tabs.battle') },
    ...(showAdmin ? [{ id: 'admin' as const, label: t('tabs.admin') }] : []),
    { id: 'settings', label: t('tabs.settings') }
  ]

  const avatarLabel = focusMode ? t('home.showMenus') : t('home.hideMenus')

  return (
    <aside className="hub-sidebar" aria-label="Main navigation">
      <button
        type="button"
        className={`dash-hud-avatar${onAvatarClick ? ' dash-hud-avatar--btn' : ''}`}
        onClick={onAvatarClick}
        disabled={!onAvatarClick || disabled}
        title={onAvatarClick ? avatarLabel : displayName}
        aria-label={onAvatarClick ? avatarLabel : displayName}
        aria-pressed={onAvatarClick ? focusMode : undefined}
      >
        <img className="hud-icon hud-icon--large" src={AVATAR_ICON_SRC} alt="" draggable={false} />
      </button>
      {items.map((item) => {
        const badgeCount = badges?.[item.id] ?? 0
        const showAlert =
          badgeCount > 0 && (item.id === 'collection' || item.id === 'community')
        const label =
          item.id === 'inventory' && badgeCount > 0
            ? t('gift.sidebarPending', { count: badgeCount })
            : item.id === 'collection' && badgeCount > 0
              ? t('collection.sidebarNewEggs', { count: badgeCount })
              : item.id === 'community' && badgeCount > 0
                ? t('friends.sidebarPending')
                : item.label
        return (
          <button
            key={item.id}
            type="button"
            className={`dash-hud-nav-btn${activeTarget === item.id ? ' active' : ''}${
              badgeCount > 0 ? ' dash-hud-nav-btn--badge' : ''
            }`}
            onClick={() => onNavigate(item.id)}
            disabled={disabled}
            title={label}
            aria-label={label}
          >
            <img className="hud-icon" src={NAV_ICON_SRC[item.id]} alt="" draggable={false} />
            {badgeCount > 0 && (
              <span className={`dash-hud-nav-badge${showAlert ? ' dash-hud-nav-badge--alert' : ''}`} aria-hidden>
                {showAlert ? '!' : badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </button>
        )
      })}
    </aside>
  )
}
