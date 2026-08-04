import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '../shared/formatError'

interface FriendRow {
  id: string
  friend_id: string
  profiles?: { username: string; friend_code: string }
}

interface PendingRow {
  id: string
  user_id: string
  profiles?: { username: string }
}

interface Props {
  onViewProfile: (userId: string) => void
  onPendingChange?: () => void
}

export function Friends({ onViewProfile, onPendingChange }: Props) {
  const { t } = useTranslation()
  const [friendCode, setFriendCode] = useState('')
  const [friends, setFriends] = useState<FriendRow[]>([])
  const [pending, setPending] = useState<PendingRow[]>([])
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [myFriendCode, setMyFriendCode] = useState('')

  const load = async () => {
    const session = (await window.electronAPI.getSession()) as { user: { id: string } } | null
    if (!session?.user?.id) return
    setUserId(session.user.id)
    const profile = (await window.electronAPI.getProfile(session.user.id)) as {
      friend_code?: string
    } | null
    setMyFriendCode(profile?.friend_code ?? '')
    setFriends((await window.electronAPI.listFriends(session.user.id)) as FriendRow[])
    setPending((await window.electronAPI.listPending(session.user.id)) as PendingRow[])
    onPendingChange?.()
  }

  useEffect(() => {
    load()
  }, [])

  const addFriend = async () => {
    if (!userId) {
      setMessage(t('friends.loginFirst'))
      return
    }
    try {
      const profile = (await window.electronAPI.searchFriend(friendCode)) as { id: string; username: string } | null
      if (!profile) {
        setMessage(t('friends.friendCodeNotFound'))
        return
      }
      if (profile.id === userId) {
        setMessage(t('friends.cannotAddSelf'))
        return
      }
      const result = (await window.electronAPI.sendFriendRequest(userId, profile.id)) as { status: string }
      setFriendCode('')
      setMessage(
        result.status === 'accepted'
          ? t('friends.requestAccepted', { username: profile.username })
          : t('friends.requestSent', { username: profile.username })
      )
      load()
    } catch (e) {
      const text = formatApiError(e)
      if (text.includes('Already friends')) {
        setMessage(t('friends.alreadyFriends'))
      } else if (text.includes('Request already sent')) {
        setMessage(t('friends.requestAlreadySent'))
      } else if (text.includes('duplicate') || text.includes('unique')) {
        setMessage(t('friends.requestSentOrAlreadyFriends'))
      } else if (text.includes('violates') || text.includes('foreign key')) {
        setMessage(t('friends.requestCannotSendCheckCode'))
      } else {
        setMessage(text)
      }
    }
  }

  const respond = async (requestId: string, accept: boolean) => {
    await window.electronAPI.respondFriend(requestId, accept)
    setMessage(accept ? t('friends.respondAccepted') : t('friends.respondDeclined'))
    load()
  }

  return (
    <div className="card">
      <h2>{t('friends.title')}</h2>
      {myFriendCode && (
        <div className="community-friend-code">
          <div>
            <span>{t('friends.yourFriendCode')}</span>
            <strong>{myFriendCode}</strong>
          </div>
          <p>{t('friends.yourFriendCodeHint')}</p>
        </div>
      )}
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 0 }}>
        {t('friends.hint')}
      </p>
      {message && <p>{message}</p>}
      <div className="form-row">
        <label>{t('friends.addByCode')}</label>
        <input
          value={friendCode}
          onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
          placeholder={t('common.placeholderFriendCode')}
        />
      </div>
      <button className="primary" onClick={addFriend}>{t('friends.sendRequest')}</button>

      <h3 style={{ marginTop: 24 }}>{t('friends.pendingTitle')}</h3>
      {pending.length === 0 && <p>{t('friends.nonePending')}</p>}
      {pending.map((p) => (
        <div key={p.id} className="friend-item">
          <span>{p.profiles?.username ?? p.user_id}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={() => respond(p.id, true)}>{t('friends.accept')}</button>
            <button className="secondary" onClick={() => respond(p.id, false)}>{t('friends.decline')}</button>
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>{t('friends.friendListTitle')}</h3>
      {friends.length === 0 && <p>{t('friends.noneFriends')}</p>}
      {friends.map((f) => (
        <div key={f.id} className="friend-item">
          <span>{f.profiles?.username ?? f.friend_id}</span>
          <button className="secondary" onClick={() => onViewProfile(f.friend_id)}>{t('friends.viewProfile')}</button>
        </div>
      ))}
    </div>
  )
}
