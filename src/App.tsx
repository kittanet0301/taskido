import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave, ItemType } from './shared/types'
import { getActivityScore, isOnboardingComplete, ONBOARDING_KEY } from './shared/activityScore'
import {
  markEggNotificationRead,
  reconcileEggNotifications,
  type EggNotificationState
} from './shared/eggNotifications'
import { setSessionIsAdmin } from './shared/sessionFlags'
import { isAdminRole } from './shared/userRole'
import { setGameSpeedMultiplier, type GameSpeedMultiplier } from './shared/gameSpeed'
import './i18n'
import { GetStarted } from './hub/GetStarted'
import { LoginGate } from './hub/LoginGate'
import { TitleScreen } from './hub/TitleScreen'
import { PixelCoverShell } from './hub/PixelCoverShell'
import { HomeDashboard } from './hub/HomeDashboard'
import { AuthPanel } from './hub/AuthPanel'
import { Community } from './hub/Community'
import { BattleProvider, BattleContext } from './hub/battle/BattleContext'
import { BattleHub } from './hub/battle/BattleHub'
import { useBattleGuard } from './hub/battle/useBattleGuard'
import { UserProfile } from './hub/UserProfile'
import { PetCollection } from './hub/PetCollection'
import { ChangePasswordForm } from './hub/ChangePasswordForm'
import { LanguageSwitcher } from './hub/LanguageSwitcher'
import { MiniGameHub } from './hub/minigame/MiniGameHub'
import { HubSidebar, type HubSidebarTarget } from './hub/HubSidebar'
import { HubTopBar } from './hub/HubTopBar'
import { Inventory } from './hub/Inventory'
import { SkillForgetModal } from './components/SkillForgetModal'
import { Market } from './hub/Market'
import { AdminPanel } from './hub/AdminPanel'

type MainView = 'home' | 'battle'

type Session = { user: { id: string; email?: string } } | null
type UserProfile = { username: string; friend_code: string; role?: string }

interface Props {
  variant?: 'desktop' | 'web'
}

const PASSWORD_RECOVERY_FLAG = 'taskino-password-recovery'
const EGG_NOTIFICATIONS_KEY = 'taskino-egg-notifications'

function isPasswordRecoveryPending(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false
  return window.sessionStorage.getItem(PASSWORD_RECOVERY_FLAG) === '1'
}

export default function App({ variant = 'desktop' }: Props) {
  return (
    <BattleProvider>
      <AppContent variant={variant} />
    </BattleProvider>
  )
}

function AppContent({ variant = 'desktop' }: Props) {
  const { t } = useTranslation()
  const battleCtx = useContext(BattleContext)
  const { isInRoom, confirmLeave } = useBattleGuard()
  const [save, setSave] = useState<GameSave | null>(null)
  const [mainView, setMainView] = useState<MainView>('home')
  const [cloudReady, setCloudReady] = useState(false)
  const [viewUserId, setViewUserId] = useState<string | null>(null)
  const [showInventory, setShowInventory] = useState(false)
  const [showSkillForget, setShowSkillForget] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [carePulse, setCarePulse] = useState<{ type: ItemType; key: number } | null>(null)
  const carePulseKeyRef = useRef(0)
  const [showCollection, setShowCollection] = useState(false)
  const [showCommunity, setShowCommunity] = useState(false)
  const [showMinigame, setShowMinigame] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingGiftCount, setPendingGiftCount] = useState(0)
  const [pendingFriendCount, setPendingFriendCount] = useState(0)
  const [eggNotifications, setEggNotifications] = useState<EggNotificationState>({
    knownIds: [],
    unreadIds: []
  })
  const eggNotificationUserRef = useRef<string | null>(null)
  const [showCover, setShowCover] = useState(() => !isOnboardingComplete())
  const [session, setSession] = useState<Session>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showTitle, setShowTitle] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(() => isPasswordRecoveryPending())
  const [homeFocus, setHomeFocus] = useState(false)
  const [gameSpeed, setGameSpeed] = useState<GameSpeedMultiplier>(1)

  const refresh = useCallback(async () => {
    if (!window.electronAPI) return
    const data = await window.electronAPI.getGame()
    setSave(data)
  }, [])

  const refreshPendingGifts = useCallback(async () => {
    if (!window.electronAPI?.listPendingGifts) return
    try {
      const rows = await window.electronAPI.listPendingGifts()
      setPendingGiftCount(rows.length)
    } catch {
      // keep last known count; gift API may be briefly unavailable
    }
  }, [])

  const refreshPendingFriends = useCallback(async (userId?: string) => {
    const id = userId ?? session?.user?.id
    if (!window.electronAPI?.listPending || !id) {
      setPendingFriendCount(0)
      return
    }
    try {
      const rows = (await window.electronAPI.listPending(id)) as unknown[]
      setPendingFriendCount(rows.length)
    } catch {
      // keep last known count
    }
  }, [session?.user?.id])

  const pushThenPull = useCallback(async () => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.forceCloudSave()
    } catch (e) {
      console.warn('[sync] force save failed; keeping local state:', e)
      await refresh()
      return
    }
    await window.electronAPI.reloadFromCloud()
    await refresh()
  }, [refresh])

  const [tabSyncing, setTabSyncing] = useState(false)

  const handleMainViewChange = useCallback(
    async (nextView: MainView) => {
      if (nextView === mainView || tabSyncing) return
      if (mainView === 'battle' && nextView !== 'battle' && isInRoom) {
        const ok = await confirmLeave()
        if (!ok) return
      }
      setTabSyncing(true)
      try {
        // Leaving/entering battle may have local progress worth pushing first.
        await pushThenPull()
        setMainView(nextView)
        if (nextView !== 'home') setHomeFocus(false)
      } catch (e) {
        console.error('[view] sync failed:', e)
        setMainView(nextView)
        if (nextView !== 'home') setHomeFocus(false)
      } finally {
        setTabSyncing(false)
      }
    },
    [mainView, tabSyncing, pushThenPull, isInRoom, confirmLeave]
  )

  useEffect(() => {
    if (!homeFocus) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHomeFocus(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [homeFocus])

  const openPopup = useCallback((setter: (visible: boolean) => void) => {
    if (tabSyncing) return
    // Popup screens consume the live local game state. Mutations are already
    // debounced to cloud storage, while data owned by a popup (gifts/friends)
    // is refreshed by that popup itself. A full push + pull here caused every
    // sidebar click to rewrite the whole save and immediately read it back.
    setter(true)
  }, [tabSyncing])

  const goToProfile = useCallback(
    async (userId: string) => {
      if (tabSyncing) return
      setShowCommunity(false)
      setTabSyncing(true)
      try {
        await pushThenPull()
      } catch (e) {
        console.error('[profile] sync failed:', e)
      } finally {
        setTabSyncing(false)
      }
      setViewUserId(userId)
    },
    [tabSyncing, pushThenPull]
  )

  const handleViewProfile = useCallback((userId: string) => goToProfile(userId), [goToProfile])

  const checkSession = useCallback(async () => {
    if (!window.electronAPI) return
    const s = (await window.electronAPI.getSession()) as Session
    setSession(s)
    setAuthLoading(false)
    if (s?.user?.id) {
      try {
        const p = (await window.electronAPI.getProfile(s.user.id)) as UserProfile
        setProfile(p)
        setSessionIsAdmin(isAdminRole(p.role))
      } catch {
        setProfile(null)
        setSessionIsAdmin(false)
      }
      await window.electronAPI.reloadFromCloud()
      await refresh()
      await refreshPendingGifts()
      await refreshPendingFriends(s.user.id)
    } else {
      setProfile(null)
      setSessionIsAdmin(false)
      setPendingGiftCount(0)
      setPendingFriendCount(0)
    }
  }, [refresh, refreshPendingGifts, refreshPendingFriends])

  useEffect(() => {
    if (!window.electronAPI) return
    refresh()
    window.electronAPI.supabaseConfigured().then(setCloudReady)
    checkSession()
    void window.electronAPI.getGameSpeed().then((multiplier) => {
      setGameSpeedMultiplier(multiplier)
      setGameSpeed(multiplier)
    }).catch(() => undefined)
    const unsubscribe = window.electronAPI.onGameUpdated(setSave)
    const unsubscribeGameSpeed = window.electronAPI.onGameSpeedUpdated((multiplier) => {
      setGameSpeedMultiplier(multiplier)
      setGameSpeed(multiplier)
    })
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      unsubscribe()
      unsubscribeGameSpeed()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh, checkSession])

  useEffect(() => {
    if (!window.electronAPI?.onHubOpened) return
    return window.electronAPI.onHubOpened(() => {
      setShowTitle(true)
    })
  }, [])

  useEffect(() => {
    battleCtx?.syncUserId(session?.user?.id ?? null)
  }, [session?.user?.id, battleCtx])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || !save) return

    const storageKey = `${EGG_NOTIFICATIONS_KEY}:${userId}`
    let previous: EggNotificationState | null = eggNotifications
    if (eggNotificationUserRef.current !== userId) {
      eggNotificationUserRef.current = userId
      try {
        const stored = localStorage.getItem(storageKey)
        previous = stored ? (JSON.parse(stored) as EggNotificationState) : null
      } catch {
        previous = null
      }
    }

    const next = reconcileEggNotifications(save.collection, previous)
    setEggNotifications(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
  }, [session?.user?.id, save?.collection])

  const markEggViewed = useCallback((petId: string) => {
    const userId = session?.user?.id
    if (!userId) return
    setEggNotifications((current) => {
      const next = markEggNotificationRead(current, petId)
      localStorage.setItem(`${EGG_NOTIFICATIONS_KEY}:${userId}`, JSON.stringify(next))
      return next
    })
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id || showCover || !window.electronAPI) return
    void refreshPendingGifts()
    void refreshPendingFriends()
    const id = setInterval(() => {
      refresh()
      void refreshPendingGifts()
      void refreshPendingFriends()
    }, 60_000)
    return () => clearInterval(id)
  }, [session, showCover, refresh, refreshPendingGifts, refreshPendingFriends])

  useEffect(() => {
    if (!window.electronAPI || !session?.user?.id) return
    const onFocus = () => {
      void refreshPendingGifts()
      void refreshPendingFriends()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [session?.user?.id, refreshPendingGifts, refreshPendingFriends])

  const handleGetStarted = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowCover(false)
  }

  const closeAllPopups = () => {
    setShowInventory(false)
    setShowMarket(false)
    setShowAdmin(false)
    setShowCollection(false)
    setShowCommunity(false)
    setShowMinigame(false)
    setShowSettings(false)
    setViewUserId(null)
  }

  const handleLogout = () => {
    setSession(null)
    setProfile(null)
    setSessionIsAdmin(false)
    setPendingGiftCount(0)
    setPendingFriendCount(0)
    setShowTitle(true)
    closeAllPopups()
    refresh()
  }

  const handleDataReset = () => {
    localStorage.removeItem(ONBOARDING_KEY)
    setShowCover(true)
    setMainView('home')
    closeAllPopups()
    refresh()
  }

  const finishPasswordRecovery = useCallback(() => {
    window.sessionStorage.removeItem(PASSWORD_RECOVERY_FLAG)
    setPasswordRecovery(false)
    setSession(null)
    setProfile(null)
    setShowTitle(false)
  }, [])

  if (!window.electronAPI) {
    return <div className="content">{t('common.connectingApp')}</div>
  }

  if (!save || authLoading) {
    return (
      <div className="title-screen-loading">
        <div className="title-screen-bg" aria-hidden />
        <div className="title-screen-loading-inner">
          <img className="title-screen-logo" src="/ui/taskino-logo.png" alt="TASKINO" draggable={false} />
          <p className="title-screen-loading-text">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!cloudReady) {
    return (
      <PixelCoverShell tagline={t('app.supabaseRequiredSubtitle')} showLangSwitcher={false} centered>
        <p className="notice" style={{ textAlign: 'left', margin: 0 }}>
          {t('app.supabaseRequiredBody')}
        </p>
      </PixelCoverShell>
    )
  }

  if (!session?.user?.id) {
    if (showTitle) return <TitleScreen onContinue={() => setShowTitle(false)} />
    return <LoginGate onLoggedIn={checkSession} />
  }

  if (variant === 'web' && passwordRecovery) {
    return (
      <PixelCoverShell tagline={t('auth.passwordRecoveryTitle')} message={t('auth.passwordRecoveryHint')}>
        <ChangePasswordForm
          submitLabel={t('auth.passwordRecoverySubmit')}
          onSubmit={async (password) => {
            await window.electronAPI.updatePassword(password)
            await window.electronAPI.signOut()
            finishPasswordRecovery()
          }}
        />
      </PixelCoverShell>
    )
  }

  if (showCover) {
    return <GetStarted onStart={handleGetStarted} />
  }

  const displayName =
    profile?.username ?? session?.user?.email?.split('@')[0] ?? ''
  const isAdmin = profile?.role === 'admin'

  const sidebarTarget: HubSidebarTarget | null = showCollection
    ? 'collection'
    : showInventory
      ? 'inventory'
      : showMarket
        ? 'market'
        : showAdmin
          ? 'admin'
          : showCommunity
            ? 'community'
            : showMinigame
              ? 'minigame'
              : showSettings
                ? 'settings'
                : mainView === 'battle'
                  ? 'battle'
                  : null

  const handleSidebarNavigate = (target: HubSidebarTarget) => {
    if (target === 'battle') {
      void handleMainViewChange('battle')
      return
    }
    if (target === 'inventory') {
      void openPopup(setShowInventory)
      return
    }
    if (target === 'market') {
      void openPopup(setShowMarket)
      return
    }
    if (target === 'admin') {
      if (!isAdmin) return
      void openPopup(setShowAdmin)
      return
    }
    if (target === 'collection') {
      void openPopup(setShowCollection)
      return
    }
    if (target === 'community') {
      void openPopup(setShowCommunity)
      return
    }
    if (target === 'minigame') {
      void openPopup(setShowMinigame)
      return
    }
    if (target === 'settings') {
      void openPopup(setShowSettings)
      return
    }
  }

  const sidebar = (
    <HubSidebar
      activeTarget={sidebarTarget}
      displayName={displayName}
      disabled={tabSyncing}
      focusMode={mainView === 'home' ? homeFocus : false}
      showAdmin={isAdmin}
      badges={{
        inventory: pendingGiftCount,
        collection: eggNotifications.unreadIds.length,
        community: pendingFriendCount
      }}
      onNavigate={handleSidebarNavigate}
      onAvatarClick={
        mainView === 'home'
          ? () => setHomeFocus((v) => !v)
          : () => {
              setHomeFocus(false)
              void handleMainViewChange('home')
            }
      }
    />
  )

  return (
    <div
      className={`app pixel-hub hub-shell${mainView === 'home' ? ' hub-shell--home' : ''}${mainView === 'battle' ? ' hub-shell--battle' : ''}${
        mainView === 'home' && homeFocus ? ' hub-shell--focus' : ''
      }`}
    >
      <div className="hub-main">
        <HubTopBar
          displayName={displayName}
          gems={save.gems ?? 0}
          clicks={save.activity.clicks}
          keystrokes={save.activity.keystrokes}
          activityScore={getActivityScore(save.activity)}
          gameSpeed={gameSpeed}
          syncing={tabSyncing}
        >
          <LanguageSwitcher variant="pixel" />
        </HubTopBar>

        {mainView === 'home' ? (
          <div className="hub-home-body">
            {sidebar}
            <main className="hub-content hub-content--home">
              <HomeDashboard
                save={save}
                focusMode={homeFocus}
                isAdmin={isAdmin}
                onUpdated={refresh}
                carePulse={carePulse}
                onSkillForget={() => setShowSkillForget(true)}
                newEggCount={eggNotifications.unreadIds.length}
                onOpenCollection={() => void openPopup(setShowCollection)}
              />
            </main>
          </div>
        ) : (
          <div className="hub-battle-body">
            {sidebar}
            <main className="hub-content hub-content--battle">
              {mainView === 'battle' && (
                <BattleHub
                  save={save}
                  variant={variant}
                  onUpdated={refresh}
                  onBack={() => void handleMainViewChange('home')}
                  backDisabled={tabSyncing}
                />
              )}
            </main>
          </div>
        )}
      </div>

      {showInventory && (
        <Inventory
          save={save}
          onClose={() => {
            setShowInventory(false)
            void refreshPendingGifts()
          }}
          onUpdated={async () => {
            await refresh()
            await refreshPendingGifts()
          }}
          onCareUsed={(type) => {
            carePulseKeyRef.current += 1
            setCarePulse({ type, key: carePulseKeyRef.current })
          }}
          onSkillForget={() => {
            setShowInventory(false)
            setShowSkillForget(true)
          }}
        />
      )}
      {showSkillForget && (
        <SkillForgetModal
          save={save}
          onClose={() => setShowSkillForget(false)}
          onUpdated={refresh}
        />
      )}
      {showMarket && (
        <Market save={save} onClose={() => setShowMarket(false)} onUpdated={refresh} />
      )}
      {showAdmin && isAdmin && session?.user?.id && (
        <AdminPanel currentUserId={session.user.id} onClose={() => setShowAdmin(false)} />
      )}
      {showCollection && (
        <PetCollection
          save={save}
          newEggIds={eggNotifications.unreadIds}
          onEggViewed={markEggViewed}
          onUpdated={refresh}
          onSelect={() => setShowCollection(false)}
          onClose={() => setShowCollection(false)}
        />
      )}
      {showCommunity && (
        <Community
          key="community"
          onViewProfile={handleViewProfile}
          onPendingChange={() => {
            void refreshPendingFriends()
          }}
          onClose={() => {
            setShowCommunity(false)
            void refreshPendingFriends()
          }}
        />
      )}
      {showMinigame && (
        <MiniGameHub save={save} onUpdated={refresh} onClose={() => setShowMinigame(false)} />
      )}
      {showSettings && (
        <AuthPanel
          save={save}
          isAdmin={isAdmin}
          onSynced={refresh}
          cloudReady={cloudReady}
          onLogout={handleLogout}
          onDataReset={handleDataReset}
          onClose={() => setShowSettings(false)}
        />
      )}
      {viewUserId && (
        <UserProfile
          key={`profile-${viewUserId}`}
          userId={viewUserId}
          save={save}
          onUpdated={refresh}
          onClose={() => setViewUserId(null)}
        />
      )}
    </div>
  )
}
