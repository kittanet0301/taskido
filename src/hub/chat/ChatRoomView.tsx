import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LobbyCanvas } from './LobbyCanvas'
import type { ChatRoomMember, ChatRoomMessage } from './types'
import { parseLobbyAnim } from './types'

interface Props {
  roomId: string
  roomSlug: string
  roomName: string
  userId: string
  onLeave: () => void
}

function parseRealtimePayload(payload: unknown): {
  table?: string
  row?: Record<string, unknown>
} {
  const p = payload as {
    table?: string
    new?: Record<string, unknown>
    old?: Record<string, unknown>
  }
  const row = p.new ?? p.old
  return { table: p.table, row }
}

async function loadSelfMember(userId: string): Promise<ChatRoomMember | null> {
  const [save, profile] = await Promise.all([
    window.electronAPI.getGame(),
    window.electronAPI.getProfile(userId)
  ])
  const pet = save.pet
  const row = profile as { username?: string } | null
  if (!pet || !row?.username) return null
  return {
    user_id: userId,
    username: row.username,
    pet_character: pet.character,
    gender: pet.gender,
    stage: pet.stage,
    x: 0.5,
    y: 0.62,
    facing: 'right',
    anim: 'idle'
  }
}

function mergeSelfIntoMembers(
  members: ChatRoomMember[],
  self: ChatRoomMember
): ChatRoomMember[] {
  const existing = members.find((m) => m.user_id === self.user_id)
  if (existing) {
    return members.map((m) =>
      m.user_id === self.user_id
        ? {
            ...m,
            username: self.username,
            pet_character: self.pet_character,
            gender: self.gender,
            stage: self.stage
          }
        : m
    )
  }
  return [...members, self]
}

export function ChatRoomView({ roomId, roomSlug, roomName, userId, onLeave }: Props) {
  const { t } = useTranslation()
  const [members, setMembers] = useState<ChatRoomMember[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [lastMessage, setLastMessage] = useState<ChatRoomMessage | null>(null)
  const [selfMember, setSelfMember] = useState<ChatRoomMember | null>(null)
  const selfRef = useRef<ChatRoomMember | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const roomIdRef = useRef(roomId)
  const leftRef = useRef(false)

  const refreshSelfMember = useCallback(async () => {
    const member = await loadSelfMember(userId)
    selfRef.current = member
    setSelfMember(member)
    return member
  }, [userId])

  const refreshMembers = useCallback(async () => {
    try {
      const rows = (await window.electronAPI.getChatRoomMembers(roomId)) as ChatRoomMember[]
      const self = selfRef.current ?? (await refreshSelfMember())
      const merged = self ? mergeSelfIntoMembers(rows, self) : rows
      setMembers(merged)
      setError('')
      return merged
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return []
    }
  }, [roomId, refreshSelfMember])

  useEffect(() => {
    void refreshSelfMember()
    return window.electronAPI.onGameUpdated((save) => {
      const prev = selfRef.current
      const pet = save.pet
      if (!pet) return
      if (!prev) {
        void refreshSelfMember()
        return
      }
      const next: ChatRoomMember = {
        user_id: userId,
        username: prev?.username ?? 'player',
        pet_character: pet.character,
        gender: pet.gender,
        stage: pet.stage,
        x: prev?.x ?? 0.5,
        y: prev?.y ?? 0.62,
        facing: prev?.facing ?? 'right',
        anim: prev?.anim ?? 'idle'
      }
      selfRef.current = next
      setSelfMember(next)
      setMembers((current) => (current.length > 0 ? mergeSelfIntoMembers(current, next) : current))
    })
  }, [userId, refreshSelfMember])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing) return
      if (document.activeElement === inputRef.current) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    roomIdRef.current = roomId
    leftRef.current = false
    setReady(false)
    let unsub = () => {}

    unsub = window.electronAPI.onChatRoomUpdate((payload) => {
      const { table, row } = parseRealtimePayload(payload)
      if (!row) return

      if (table === 'chat_room_messages' && row.room_id === roomIdRef.current && row.id) {
        setLastMessage({
          id: String(row.id),
          room_id: String(row.room_id),
          sender_id: String(row.sender_id),
          content: String(row.content),
          created_at: String(row.created_at ?? new Date().toISOString())
        })
        void refreshMembers()
      }

      if (table === 'chat_room_positions' && row.room_id === roomIdRef.current && row.user_id) {
        const uid = String(row.user_id)
        setMembers((prev) => {
          const base = prev.length > 0 ? prev : selfRef.current ? [selfRef.current] : []
          return base.map((m) => {
            if (m.user_id !== uid) return m
            const updated: ChatRoomMember = {
              ...m,
              x: Number(row.x ?? m.x),
              y: Number(row.y ?? m.y),
              facing: row.facing === 'left' ? 'left' : 'right',
              anim: parseLobbyAnim(row.anim)
            }
            if (uid === userId && selfRef.current) {
              return {
                ...updated,
                username: selfRef.current.username,
                pet_character: selfRef.current.pet_character,
                gender: selfRef.current.gender,
                stage: selfRef.current.stage
              }
            }
            return updated
          })
        })
      }

      if (table === 'chat_room_members') {
        void refreshMembers()
      }
    })

    void (async () => {
      try {
        await refreshSelfMember()
        await window.electronAPI.joinChatRoom(roomId)
        await refreshMembers()
        await window.electronAPI.subscribeChatRoom(roomId)
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      unsub()
    }
  }, [roomId, refreshMembers, refreshSelfMember, userId])

  const handleLeave = async () => {
    if (leftRef.current) return
    leftRef.current = true
    setError('')
    try {
      await window.electronAPI.leaveChatRoom(roomId)
      onLeave()
    } catch (e) {
      leftRef.current = false
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError('')
    try {
      const msg = (await window.electronAPI.sendChatRoomMessage(roomId, trimmed)) as ChatRoomMessage
      setLastMessage(msg)
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  const handlePositionSync = useCallback(
    (pos: { x: number; y: number; facing: string; anim: string }) => {
      if (leftRef.current) return
      void window.electronAPI.updateChatRoomPosition(roomId, pos)
    },
    [roomId]
  )

  const displayMembers = members.length > 0 ? members : selfMember ? [selfMember] : []

  return (
    <div className="chat-room-view">
      <div className="chat-room-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{roomName}</h2>
          <p className="chat-room-meta">
            {t('chatLobby.memberCount', { count: displayMembers.length })}
          </p>
        </div>
        <button type="button" className="secondary" onClick={handleLeave}>
          {t('chatLobby.leave')}
        </button>
      </div>

      {error && <p className="notice">{error}</p>}

      {!ready && !error && <p className="dash-activity-hint">{t('chatLobby.joining')}</p>}

      <LobbyCanvas
        roomId={roomId}
        roomSlug={roomSlug}
        userId={userId}
        members={displayMembers}
        onPositionSync={handlePositionSync}
        incomingMessage={lastMessage}
      />

      <p className="dash-activity-hint chat-room-controls chat-room-controls--keys">{t('chatLobby.controls')}</p>
      <p className="dash-activity-hint chat-room-controls chat-room-controls--touch">{t('chatLobby.controlsTouch')}</p>

      <div className="chat-room-input-row">
        <input
          ref={inputRef}
          value={text}
          maxLength={200}
          placeholder={t('chatLobby.inputPlaceholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSend()
          }}
        />
        <button type="button" className="primary" disabled={!text.trim() || sending} onClick={handleSend}>
          {t('chatLobby.send')}
        </button>
      </div>
    </div>
  )
}
