import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DinoSprite } from '../../components/DinoSprite'
import type { PetData } from '../../shared/types'
import type { BattleRoom, BattleRoomMember } from '../../shared/battle/types'
import {
  mapBattleRoom,
  mapBattleRoomMember,
  mapBattleSession,
  mapPetRowToPetData
} from '../../shared/battle/mappers'
import { formatApiError } from '../../shared/formatError'
import { BattleContext } from './BattleContext'
import { useBattleGuard } from './useBattleGuard'

interface Props {
  onDuelStarted?: () => void
}

export function BattleRoom({ onDuelStarted }: Props) {
  const { t } = useTranslation()
  const ctx = useContext(BattleContext)
  const { requestLeave } = useBattleGuard()
  const [room, setRoom] = useState<BattleRoom | null>(null)
  const [members, setMembers] = useState<BattleRoomMember[]>([])
  const [memberPets, setMemberPets] = useState<Record<string, PetData | null>>({})
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectingOpponent, setSelectingOpponent] = useState(false)
  const originalHostIdRef = useRef<string | null>(null)
  const hasLoadedRoomRef = useRef(false)

  const roomId = ctx?.roomId ?? null
  const userId = ctx?.userId ?? null

  const exitClosedRoom = useCallback(() => {
    originalHostIdRef.current = null
    hasLoadedRoomRef.current = false
    setRoom(null)
    setMembers([])
    setSelectedOpponentId(null)
    ctx?.setRoomId(null)
    ctx?.setHostUserId(null)
    ctx?.setMyRole(null)
    ctx?.setMemberStatus(null)
    ctx?.setActiveSessionId(null)
  }, [ctx])

  const syncActiveSession = useCallback(
    async (sessionId?: string | null) => {
      if (!ctx || !roomId) return
      const battles = (await window.electronAPI.listBattles()) as Record<string, unknown>[]
      const resolveActive = (id: string) => {
        const row = battles.find((battle) => String(battle.id) === id)
        return row && row.status === 'active' ? row : null
      }

      if (sessionId && resolveActive(sessionId)) {
        ctx.setActiveSessionId(sessionId)
        ctx.setMemberStatus('in_battle')
        onDuelStarted?.()
        return
      }

      const active = battles.find(
        (battle) => String(battle.room_id) === roomId && battle.status === 'active'
      )
      if (active) {
        ctx.setActiveSessionId(String(active.id))
        ctx.setMemberStatus('in_battle')
        onDuelStarted?.()
        return
      }

      ctx.setMemberStatus('waiting')
    },
    [ctx, roomId, onDuelStarted]
  )

  const loadRoomState = useCallback(async () => {
    if (!roomId) return
    try {
      const row = (await window.electronAPI.getBattleRoom(roomId)) as Record<string, unknown> | null
      if (!row) {
        if (hasLoadedRoomRef.current) exitClosedRoom()
        return
      }

      const mapped = mapBattleRoom(row)
      if (
        mapped.status !== 'open' ||
        (originalHostIdRef.current != null && mapped.hostUserId !== originalHostIdRef.current)
      ) {
        exitClosedRoom()
        return
      }

      if (!originalHostIdRef.current) originalHostIdRef.current = mapped.hostUserId
      setRoom(mapped)
      ctx?.setHostUserId(mapped.hostUserId)
      if (mapped.activeSessionId) void syncActiveSession(mapped.activeSessionId)
    } catch (error) {
      // Realtime/member polling can still keep the room usable during a transient fetch failure.
      if (!hasLoadedRoomRef.current) setMessage(formatApiError(error))
    }
  }, [roomId, ctx, syncActiveSession, exitClosedRoom])

  const loadRoom = useCallback(async () => {
    if (!roomId) return
    try {
      const rows = (await window.electronAPI.getRoomMembers(roomId)) as Record<string, unknown>[]
      const mapped = rows.map(mapBattleRoomMember)

      const host = mapped.find((member) => member.role === 'host')
      if (!originalHostIdRef.current && host) originalHostIdRef.current = host.userId
      if (
        hasLoadedRoomRef.current &&
        originalHostIdRef.current &&
        !mapped.some((member) => member.userId === originalHostIdRef.current)
      ) {
        exitClosedRoom()
        return
      }

      hasLoadedRoomRef.current = true
      setMembers(mapped)
      if (host) ctx?.setHostUserId(originalHostIdRef.current ?? host.userId)

      const me = mapped.find((member) => member.userId === userId)
      if (me) {
        ctx?.setMyRole(me.role)
        if (me.status === 'in_battle') await syncActiveSession(room?.activeSessionId)
        else ctx?.setMemberStatus(me.status)
      }
    } catch (error) {
      if (hasLoadedRoomRef.current) {
        exitClosedRoom()
        return
      }
      setMessage(formatApiError(error))
    }
  }, [roomId, userId, ctx, room?.activeSessionId, syncActiveSession, exitClosedRoom])

  useEffect(() => {
    if (!roomId) return
    void loadRoom()
    void loadRoomState()
    void window.electronAPI.subscribeBattleRoom(roomId)
    const pollId = window.setInterval(() => {
      void loadRoom()
      void loadRoomState()
    }, 1200)

    const unsubscribe = window.electronAPI.onBattleUpdate((payload) => {
      const table = (payload as { table?: string }).table
      const row = (payload as { new?: Record<string, unknown> })?.new

      if (table === 'battle_room_members' || table === 'battle_rooms') {
        void loadRoom()
        void loadRoomState()
        if (table === 'battle_rooms' && row) {
          const mapped = mapBattleRoom(row)
          if (
            mapped.status !== 'open' ||
            (ctx?.hostUserId != null && mapped.hostUserId !== ctx.hostUserId)
          ) {
            exitClosedRoom()
            return
          }
          setRoom(mapped)
          ctx?.setHostUserId(mapped.hostUserId)
          if (row.active_session_id) void syncActiveSession(String(row.active_session_id))
        }
        if (
          table === 'battle_room_members' &&
          row &&
          String(row.user_id) === ctx?.hostUserId &&
          row.status === 'left'
        ) {
          exitClosedRoom()
          return
        }
      }

      if (table === 'battle_sessions' && row) {
        const session = mapBattleSession(row)
        if (session.roomId === roomId && session.status === 'active') {
          void syncActiveSession(session.id)
        }
        if (session.roomId === roomId && ['completed', 'fled'].includes(session.status)) {
          ctx?.setActiveSessionId(null)
          ctx?.setMemberStatus('waiting')
          void loadRoom()
        }
      }
    })

    return () => {
      window.clearInterval(pollId)
      unsubscribe()
    }
  }, [roomId, loadRoom, loadRoomState, ctx, syncActiveSession, exitClosedRoom])

  useEffect(() => {
    if (!roomId || room) return
    void (async () => {
      try {
        const publicRooms = (await window.electronAPI.listPublicRooms()) as Record<string, unknown>[]
        const found = publicRooms.find((candidate) => String(candidate.id) === roomId)
        if (!found) return
        setRoom({
          id: String(found.id),
          hostUserId: ctx?.hostUserId ?? '',
          roomCode: String(found.room_code),
          name: String(found.name),
          visibility: 'public',
          status: 'open',
          maxMembers: 8,
          activeSessionId: null,
          selectedOpponentUserId: null,
          createdAt: String(found.created_at),
          expiresAt: null
        })
      } catch {
        /* Room metadata is optional; member realtime remains authoritative. */
      }
    })()
  }, [roomId, room, ctx?.hostUserId])

  const memberIdsKey = members.map((member) => member.userId).sort().join('|')

  useEffect(() => {
    if (!memberIdsKey) {
      setMemberPets({})
      return
    }

    let cancelled = false
    void Promise.all(
      memberIdsKey.split('|').map(async (memberId) => {
        try {
          const row = (await window.electronAPI.getFriendPet(memberId)) as Record<string, unknown> | null
          return [memberId, row ? mapPetRowToPetData(row) : null] as const
        } catch {
          return [memberId, null] as const
        }
      })
    ).then((entries) => {
      if (!cancelled) setMemberPets(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [memberIdsKey])

  useEffect(() => {
    setSelectedOpponentId(room?.selectedOpponentUserId ?? null)
  }, [room?.selectedOpponentUserId])

  useEffect(() => {
    if (!selectedOpponentId) return
    const opponentCanFight = members.some(
      (member) =>
        member.userId === selectedOpponentId &&
        member.role !== 'host' &&
        member.status === 'waiting'
    )
    if (!opponentCanFight) setSelectedOpponentId(null)
  }, [members, selectedOpponentId])

  const startDuel = async (opponentUserId: string) => {
    if (!roomId || !ctx || loading) return
    setLoading(true)
    setMessage('')
    try {
      const row = (await window.electronAPI.startRoomDuel(roomId, opponentUserId)) as Record<string, unknown>
      const session = mapBattleSession(row)
      ctx.setActiveSessionId(session.id)
      ctx.setMemberStatus('in_battle')
      onDuelStarted?.()
    } catch (error) {
      setMessage(formatApiError(error))
    } finally {
      setLoading(false)
    }
  }

  const toggleOpponent = async (opponentUserId: string) => {
    if (!roomId || !isHost || selectingOpponent || loading) return
    const nextOpponentId = selectedOpponentId === opponentUserId ? null : opponentUserId
    setSelectingOpponent(true)
    setMessage('')
    try {
      const row = (await window.electronAPI.selectRoomOpponent(
        roomId,
        nextOpponentId
      )) as Record<string, unknown> | null
      setSelectedOpponentId(nextOpponentId)
      if (row) setRoom(mapBattleRoom(row))
    } catch (error) {
      setMessage(formatApiError(error))
    } finally {
      setSelectingOpponent(false)
    }
  }

  const leave = async () => {
    const ok = await requestLeave()
    if (ok) setMessage(t('battle.leftRoom'))
  }

  if (!roomId) return null

  const isHost =
    ctx?.myRole === 'host' ||
    (userId != null && ctx?.hostUserId === userId) ||
    members.some((member) => member.userId === userId && member.role === 'host')
  const myMember = members.find((member) => member.userId === userId)
  const inBattle =
    (ctx?.memberStatus === 'in_battle' || myMember?.status === 'in_battle') &&
    Boolean(ctx?.activeSessionId)
  const waitingOpponents = members.filter(
    (member) => member.status === 'waiting' && member.userId !== userId
  )
  const hostMember = members.find((member) => member.role === 'host') ?? null
  const selectedOpponent = members.find(
    (member) =>
      member.userId === selectedOpponentId &&
      member.userId !== hostMember?.userId &&
      member.status === 'waiting'
  ) ?? null

  const fighterCard = (member: BattleRoomMember | null, side: 'host' | 'opponent') => {
    const pet = member ? memberPets[member.userId] : null
    return (
      <div className={`battle-room-fighter battle-room-fighter--${side}${member ? '' : ' is-empty'}`}>
        <div className="battle-room-fighter__role">
          {side === 'host' ? t('battle.roomHostSide') : t('battle.roomOpponentSide')}
        </div>
        <div className="battle-room-fighter__sprite">
          {pet ? (
            <DinoSprite pet={pet} size={190} movementAnim="idle" />
          ) : (
            <div className="battle-room-pet-placeholder" aria-hidden>?</div>
          )}
        </div>
        <div className="battle-room-fighter__details">
          <strong>{member?.username ?? t('battle.roomChooseOpponent')}</strong>
          <span>{pet?.name ?? (member ? t('battle.roomPetUnavailable') : t('battle.roomChooseOpponentHint'))}</span>
          {pet && (
            <div className="battle-room-pet-stats">
              <span className={`battle-room-element battle-room-element--${pet.elementPrimary}`}>
                {String(pet.elementPrimary).toUpperCase()}
              </span>
              <span>HP {pet.stats.health}/100</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="battle-room battle-room--staging">
      <header className="battle-room-header">
        <div>
          <span className="battle-room-header__eyebrow">{t('battle.roomTitle')}</span>
          <h3>{room?.name ?? t('battle.roomTitle')}</h3>
        </div>
        <div className="battle-room-header__meta">
          <span>{t('battle.roomCode')}</span>
          <code>{room?.roomCode ?? '------'}</code>
          <span>{t('battle.roomMemberCount', { count: members.length, max: room?.maxMembers ?? 8 })}</span>
          <span className="battle-room-open-status">{t('battle.roomOpen')}</span>
        </div>
      </header>

      {message && <p className="notice">{message}</p>}
      {inBattle && (
        <div className="notice battle-room-live-notice">
          <p>{t('battle.duelInProgress')}</p>
          <button type="button" className="primary" onClick={() => void syncActiveSession()}>
            {t('battle.roomReturnToBattle')}
          </button>
        </div>
      )}

      <section className="battle-room-versus" aria-label={t('battle.roomReadyArena')}>
        {fighterCard(hostMember, 'host')}
        <div className="battle-room-versus__center">
          <span className="battle-room-vs">VS</span>
          <p>
            {inBattle
              ? t('battle.duelInProgress')
              : isHost
                ? selectedOpponent
                  ? t('battle.roomOpponentSelected', { username: selectedOpponent.username })
                  : t('battle.roomSelectFromRoster')
                : t('battle.waitForHost')}
          </p>
          {isHost && !inBattle && (
            <button
              type="button"
              className="primary battle-room-start"
              disabled={!selectedOpponent || loading || selectingOpponent}
              onClick={() => selectedOpponent && void startDuel(selectedOpponent.userId)}
            >
              {loading ? t('battle.roomStartingDuel') : t('battle.startDuel')}
            </button>
          )}
        </div>
        {fighterCard(selectedOpponent, 'opponent')}
      </section>

      <section className="battle-room-roster">
        <div className="battle-room-section-heading">
          <div>
            <h4>{t('battle.membersInRoom')}</h4>
            <p>{isHost ? t('battle.pickOpponentHint') : t('battle.roomRosterHint')}</p>
          </div>
          <span>{members.length}/{room?.maxMembers ?? 8}</span>
        </div>
        <ul className="room-list battle-room-member-grid">
          {members.map((member) => {
            const pet = memberPets[member.userId]
            return (
              <li key={member.userId}>
                <button
                  type="button"
                  className={`battle-room-member-card${selectedOpponentId === member.userId ? ' is-selected' : ''}${member.userId === userId ? ' is-you' : ''}`}
                  disabled={!isHost || inBattle || loading || selectingOpponent || member.userId === userId || member.status !== 'waiting'}
                  onClick={() => void toggleOpponent(member.userId)}
                >
                  <span className="battle-room-member-card__avatar">
                    {pet ? <DinoSprite pet={pet} size={76} movementAnim="idle" /> : <span>?</span>}
                  </span>
                  <span className="battle-room-member-card__body">
                    <strong>{member.username}{member.userId === userId ? ` (${t('battle.roomYou')})` : ''}</strong>
                    <span>{pet?.name ?? t('battle.roomPetUnavailable')}</span>
                  </span>
                  <span className="battle-room-member-card__tags">
                    {member.role === 'host' && <span className="tag">{t('battle.hostTag')}</span>}
                    <span className={`tag battle-room-status battle-room-status--${member.status}`}>
                      {member.status === 'waiting'
                        ? t('battle.memberWaiting')
                        : member.status === 'in_battle'
                          ? t('battle.memberFighting')
                          : member.status}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="battle-room-footer">
        <span>{isHost && waitingOpponents.length === 0 ? t('battle.waitForOthers') : t('battle.roomStayReady')}</span>
        <button type="button" className="battle-room-leave" onClick={() => void leave()}>
          {t('battle.leaveRoom')}
        </button>
      </footer>
    </div>
  )
}
