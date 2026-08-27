import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave, PetData } from '../../shared/types'
import type { BattleCommand, BattleSession } from '../../shared/battle/types'
import { BATTLE_EMOTION_MIN, BATTLE_HEALTH_MIN, battleEntryBlock } from '../../shared/elements'
import { mapBattleSession, mapBattleTurn, mapPetRowToPetData } from '../../shared/battle/mappers'
import { BattleContext } from './BattleContext'
import { RoomLobby } from './RoomLobby'
import { BattleRoom } from './BattleRoom'
import { BattleArena } from './BattleArena'
import { BattleHistory } from './BattleHistory'
import { BattleEndModal } from './BattleEndModal'
import { BotBattle } from './BotBattle'
import { useBattleSession } from './useBattleSession'
import { useBattleGuard } from './useBattleGuard'

type HubTab = 'bot' | 'room' | 'active' | 'history'

interface EndedBattle {
  session: BattleSession
  turns: ReturnType<typeof mapBattleTurn>[]
}

interface Props {
  save: GameSave
  variant?: 'desktop' | 'web'
  onUpdated?: () => void | Promise<void>
  onBack?: () => void
  backDisabled?: boolean
}

export function BattleHub({ save, variant = 'desktop', onUpdated, onBack, backDisabled = false }: Props) {
  const { t } = useTranslation()
  const ctx = useContext(BattleContext)
  const { isInRoom } = useBattleGuard()
  const [hubTab, setHubTab] = useState<HubTab>('bot')
  const [botBattleStarted, setBotBattleStarted] = useState(false)
  const [endedBattle, setEndedBattle] = useState<EndedBattle | null>(null)
  const handledEndRef = useRef<string | null>(null)
  const dismissedEndRef = useRef<Set<string>>(new Set())
  const userId = ctx?.userId ?? null
  const sessionId = ctx?.activeSessionId ?? null
  const { session, turns, reload } = useBattleSession(userId, sessionId)
  const [fighters, setFighters] = useState<{
    challengerName: string
    defenderName: string
    challengerPet: PetData | null
    defenderPet: PetData | null
  } | null>(null)

  const goToActiveBattle = useCallback(async () => {
    if (!ctx?.roomId) {
      setHubTab('active')
      return
    }
    const battles = (await window.electronAPI.listBattles()) as Record<string, unknown>[]
    const active = battles.find(
      (b) => String(b.room_id) === ctx.roomId && b.status === 'active'
    )
    if (active) {
      ctx.setActiveSessionId(String(active.id))
      ctx.setMemberStatus('in_battle')
      setHubTab('active')
      return
    }
    ctx.setMemberStatus('waiting')
    setHubTab('active')
  }, [ctx])

  const refreshMemberStatus = useCallback(async () => {
    if (!ctx?.roomId || !userId) return
    try {
      const memberRows = (await window.electronAPI.getRoomMembers(ctx.roomId)) as Record<
        string,
        unknown
      >[]
      const me = memberRows.find((m) => String(m.user_id) === userId)
      if (me) {
        ctx.setMemberStatus(me.status as 'waiting' | 'in_battle' | 'left')
      }
    } catch {
      /* optional */
    }
  }, [ctx, userId])

  const discoverRoomSession = useCallback(async () => {
    if (!ctx?.roomId || ctx.activeSessionId) return
    const battles = (await window.electronAPI.listBattles()) as Record<string, unknown>[]
    const active = battles.find(
      (b) => String(b.room_id) === ctx.roomId && b.status === 'active'
    )
    if (active) {
      ctx.setActiveSessionId(String(active.id))
      setHubTab('active')
    }
  }, [ctx])

  const handleBattleEnd = useCallback(
    async (endedSession: BattleSession) => {
      if (
        handledEndRef.current === endedSession.id ||
        dismissedEndRef.current.has(endedSession.id)
      ) {
        return
      }
      handledEndRef.current = endedSession.id

      ctx?.setActiveSessionId(null)
      ctx?.setMemberStatus('waiting')
      setHubTab('room')
      void refreshMemberStatus()

      if (userId && endedSession.winnerUserId === userId) {
        try {
          await window.electronAPI.patchGame('recordBattleWin', [])
          await onUpdated?.()
        } catch {
          /* mission progress is best-effort */
        }
      }

      try {
        const turnRows = (await window.electronAPI.getBattleTurns(endedSession.id)) as Record<
          string,
          unknown
        >[]
        setEndedBattle({
          session: endedSession,
          turns: turnRows.map(mapBattleTurn)
        })
      } catch {
        setEndedBattle({ session: endedSession, turns: [] })
      }
    },
    [ctx, refreshMemberStatus, userId, onUpdated]
  )

  useEffect(() => {
    if (!userId) return
    void window.electronAPI.subscribeBattles(userId)

    return window.electronAPI.onBattleUpdate((payload) => {
      const row = (payload as { new?: Record<string, unknown> })?.new
      if (!row) return
      const mapped = mapBattleSession(row)
      if (mapped.status === 'active') {
        ctx?.setActiveSessionId(mapped.id)
        if (mapped.roomId) {
          ctx?.setRoomId(mapped.roomId)
          ctx?.setMemberStatus('in_battle')
        }
        setHubTab('active')
      }
      if (['completed', 'fled'].includes(mapped.status)) {
        if (
          !dismissedEndRef.current.has(mapped.id) &&
          (ctx?.activeSessionId === mapped.id || sessionId === mapped.id)
        ) {
          void handleBattleEnd(mapped)
        }
      } else {
        void reload()
      }
    })
  }, [userId, ctx, reload, sessionId, handleBattleEnd])

  useEffect(() => {
    if (!session || !userId || !sessionId) return
    if (!['completed', 'fled'].includes(session.status)) return
    void handleBattleEnd(session)
  }, [session, sessionId, userId, handleBattleEnd])

  useEffect(() => {
    if (ctx?.memberStatus === 'in_battle' && sessionId) {
      setHubTab('active')
    }
  }, [ctx?.memberStatus, sessionId])

  useEffect(() => {
    if (!session || session.status !== 'active') return
    let cancelled = false
    void (async () => {
      try {
        const [challengerProfile, defenderProfile, challengerPetRow, defenderPetRow] = await Promise.all([
          window.electronAPI.getProfile(session.challengerUserId) as Promise<{ username: string } | null>,
          window.electronAPI.getProfile(session.defenderUserId) as Promise<{ username: string } | null>,
          window.electronAPI.getFriendPet(session.challengerUserId) as Promise<Record<string, unknown> | null>,
          window.electronAPI.getFriendPet(session.defenderUserId) as Promise<Record<string, unknown> | null>
        ])
        if (cancelled) return
        setFighters({
          challengerName: challengerProfile?.username ?? t('battle.challenger'),
          defenderName: defenderProfile?.username ?? t('battle.defender'),
          challengerPet: challengerPetRow ? mapPetRowToPetData(challengerPetRow) : null,
          defenderPet: defenderPetRow ? mapPetRowToPetData(defenderPetRow) : null
        })
      } catch {
        if (!cancelled) setFighters(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session?.id, session?.status, session?.challengerUserId, session?.defenderUserId, t])

  useEffect(() => {
    if (ctx?.memberStatus !== 'in_battle' || ctx?.activeSessionId || !ctx?.roomId) return
    void discoverRoomSession()
    const id = setInterval(() => void discoverRoomSession(), 2500)
    return () => clearInterval(id)
  }, [ctx?.memberStatus, ctx?.activeSessionId, ctx?.roomId, discoverRoomSession])

  useEffect(() => {
    if (variant !== 'web' || !isInRoom || !ctx?.roomId) return

    const handler = () => {
      void window.electronAPI.forfeitBattleRoom(ctx.roomId!)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [variant, isInRoom, ctx?.roomId])

  const submitAction = async (
    command: BattleCommand,
    extra?: { skillId?: string; itemType?: string }
  ) => {
    if (!sessionId) return
    const payload =
      command === 'skill' && extra?.skillId
        ? `skill:${extra.skillId}`
        : command === 'item' && extra?.itemType
          ? `item:${extra.itemType}`
          : command
    await window.electronAPI.submitBattleAction(sessionId, payload)
    if (command === 'item' && extra?.itemType === 'battle_shield') {
      await window.electronAPI.patchGame('consumeBattleShield', [])
      await onUpdated?.()
    }
    await reload()
  }

  const shieldCount = save.inventory.find((i) => i.type === 'battle_shield')?.quantity ?? 0
  const battleBlock = battleEntryBlock(save.pet)
  const canBattle = battleBlock === null
  const blockedCopy =
    battleBlock === 'egg'
      ? t('pet.needRaiseBeforeBattleHp')
      : battleBlock
        ? t('pet.needRaiseBeforeBattleCare', {
            minHealth: BATTLE_HEALTH_MIN,
            minEmotion: BATTLE_EMOTION_MIN,
            health: Math.round(save.pet?.stats.health ?? 0),
            emotion: Math.round(save.pet?.stats.emotion ?? 0)
          })
        : null
  const blockedPanel = blockedCopy ? (
    <div className="battle-blocked-empty" role="status">
      <p>{blockedCopy}</p>
    </div>
  ) : null

  const hubTabs: { id: HubTab; label: string }[] = [
    { id: 'bot', label: t('battle.tabs.bot') },
    { id: 'room', label: t('battle.tabs.room') },
    { id: 'history', label: t('battle.tabs.history') }
  ]

  const handleBotBattleStartedChange = useCallback((started: boolean) => {
    setBotBattleStarted(started)
  }, [])

  const activeBattleStarted =
    hubTab === 'active' && session?.status === 'active' && Boolean(userId)
  const immersiveBattle = botBattleStarted || activeBattleStarted

  return (
    <div className={`battle-page${immersiveBattle ? ' battle-page--immersive' : ''}`}>
      {!immersiveBattle && <div className="battle-page-nav">
        {onBack && (
          <button
            type="button"
            className="hub-back-btn battle-page-back"
            onClick={onBack}
            disabled={backDisabled}
          >
            ‹ {t('tabs.home')}
          </button>
        )}
        <nav className="battle-hub-tabs" aria-label={t('battle.title')}>
          {hubTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`battle-mode-tab ${hubTab === t.id ? 'active' : ''}`}
              onClick={() => setHubTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>}

      <div className="battle-hub-panel">
        <div className={`battle-hub-body battle-hub-body--${hubTab}`}>
          {hubTab === 'bot' && battleBlock && blockedPanel}
          {hubTab === 'bot' && canBattle && save.pet && (
            <BotBattle
              pet={save.pet}
              onStartedChange={handleBotBattleStartedChange}
              onComplete={async (difficulty, dropRoll) => {
                await window.electronAPI.patchGame('completeBotBattle', [difficulty, dropRoll])
                await onUpdated?.()
              }}
            />
          )}
          {hubTab === 'room' && battleBlock && !ctx?.roomId && blockedPanel}
          {hubTab === 'room' && (!battleBlock || ctx?.roomId) && (
            <>
              {ctx?.roomId ? (
                <BattleRoom onDuelStarted={goToActiveBattle} />
              ) : (
                <RoomLobby />
              )}
            </>
          )}
          {hubTab === 'active' && (
            session && session.status === 'active' && userId ? (
              <BattleArena
                session={session}
                turns={turns}
                userId={userId}
                challengerName={fighters?.challengerName}
                defenderName={fighters?.defenderName}
                challengerPet={fighters?.challengerPet}
                defenderPet={fighters?.defenderPet}
                shieldCount={shieldCount}
                onAction={submitAction}
              />
            ) : (
              <div className="battle-active-empty">
                <p>{t('battle.activeNone')}</p>
                {ctx?.memberStatus === 'in_battle' && (
                  <button type="button" className="primary" onClick={() => void discoverRoomSession()}>
                    {t('battle.reloadBattle')}
                  </button>
                )}
              </div>
            )
          )}
          {hubTab === 'history' && <BattleHistory />}
        </div>
      </div>

      {endedBattle && userId && (
        <BattleEndModal
          session={endedBattle.session}
          turns={endedBattle.turns}
          userId={userId}
          onClose={() => {
            if (endedBattle) dismissedEndRef.current.add(endedBattle.session.id)
            setEndedBattle(null)
            ctx?.setMemberStatus('waiting')
            setHubTab('room')
            void refreshMemberStatus()
          }}
        />
      )}
    </div>
  )
}
