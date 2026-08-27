import { useEffect, useState } from 'react'
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
  /** Phone shell: avatar + menu dropdown instead of a full icon rail. */
  compactMenu?: boolean
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
  compactMenu = false,
  showAdmin = false,
  badges,
  onNavigate,
  onAvatarClick
}: Props) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

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

  useEffect(() => {
    if (!compactMenu || focusMode) setMenuOpen(false)
  }, [compactMenu, focusMode])

  const avatarLabel = focusMode ? t('home.showMenus') : t('home.hideMenus')
  const badgeTotal = items.reduce((sum, item) => sum + (badges?.[item.id] ?? 0), 0)
  const hasAlert = items.some(
    (item) => (badges?.[item.id] ?? 0) > 0 && (item.id === 'collection' || item.id === 'community')
  )

  const itemAriaLabel = (item: { id: HubSidebarTarget; label: string }, badgeCount: number) => {
    if (item.id === 'inventory' && badgeCount > 0) return t('gift.sidebarPending', { count: badgeCount })
    if (item.id === 'collection' && badgeCount > 0) return t('collection.sidebarNewEggs', { count: badgeCount })
    if (item.id === 'community' && badgeCount > 0) return t('friends.sidebarPending')
    return item.label
  }

  const openTarget = (target: HubSidebarTarget) => {
    setMenuOpen(false)
    onNavigate(target)
  }

  return (
    <aside
      className={`hub-sidebar${compactMenu ? ' hub-sidebar--menu' : ''}${menuOpen ? ' hub-sidebar--menu-open' : ''}`}
      aria-label="Main navigation"
    >
      {compactMenu && menuOpen && (
        <button
          type="button"
          className="hub-nav-menu-backdrop"
          aria-label={t('tabs.closeMenu')}
          onClick={() => setMenuOpen(false)}
        />
      )}
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
      {compactMenu ? (
        <>
          <button
            type="button"
            className={`hub-nav-menu-btn${badgeTotal > 0 ? ' dash-hud-nav-btn--badge' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            disabled={disabled}
            aria-expanded={menuOpen}
            aria-controls="hub-nav-menu"
            aria-label={t('tabs.menu')}
          >
            <span>{t('tabs.menu')}</span>
            {badgeTotal > 0 && (
              <span className={`dash-hud-nav-badge${hasAlert ? ' dash-hud-nav-badge--alert' : ''}`} aria-hidden>
                {hasAlert ? '!' : badgeTotal > 9 ? '9+' : badgeTotal}
              </span>
            )}
          </button>
          {menuOpen && (
            <div className="hub-nav-menu" id="hub-nav-menu" role="menu">
              {items.map((item) => {
                const badgeCount = badges?.[item.id] ?? 0
                const showAlert =
                  badgeCount > 0 && (item.id === 'collection' || item.id === 'community')
                const label = itemAriaLabel(item, badgeCount)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`hub-nav-menu-item${activeTarget === item.id ? ' active' : ''}${
                      badgeCount > 0 ? ' dash-hud-nav-btn--badge' : ''
                    }`}
                    onClick={() => openTarget(item.id)}
                    disabled={disabled}
                    aria-label={label}
                  >
                    <img className="hud-icon" src={NAV_ICON_SRC[item.id]} alt="" draggable={false} />
                    <span>{item.label}</span>
                    {badgeCount > 0 && (
                      <span
                        className={`dash-hud-nav-badge${showAlert ? ' dash-hud-nav-badge--alert' : ''}`}
                        aria-hidden
                      >
                        {showAlert ? '!' : badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        items.map((item) => {
          const badgeCount = badges?.[item.id] ?? 0
          const showAlert =
            badgeCount > 0 && (item.id === 'collection' || item.id === 'community')
          const label = itemAriaLabel(item, badgeCount)
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
        })
      )}
    </aside>
  )
}
