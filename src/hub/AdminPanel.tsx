import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ItemType } from '../shared/types'
import { ALL_ITEM_TYPES } from '../shared/itemIcons'
import { tItemLabel } from '../i18n/labels'
import { formatApiError } from '../shared/formatError'
import { GAME_SPEED_MULTIPLIERS, type GameSpeedMultiplier } from '../shared/gameSpeed'

interface AdminPlayer {
  id: string
  username: string
  friend_code: string
  role: string
  gems: number
}

interface Props {
  currentUserId?: string
  onClose: () => void
}

export function AdminPanel({ currentUserId, onClose }: Props) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [gemAmount, setGemAmount] = useState(10)
  const [itemType, setItemType] = useState<ItemType>('food_basic')
  const [itemQty, setItemQty] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<AdminPlayer | null>(null)
  const [gameSpeed, setGameSpeed] = useState<GameSpeedMultiplier>(1)
  const [gameSpeedLoading, setGameSpeedLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const rows = await window.electronAPI.adminListPlayers()
      setPlayers(rows)
    } catch (e) {
      setPlayers([])
      setMessage(formatApiError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let active = true
    void window.electronAPI.getGameSpeed().then((multiplier) => {
      if (active) setGameSpeed(multiplier)
    }).catch((error) => {
      if (active) setMessage(formatApiError(error))
    })
    const unsubscribe = window.electronAPI.onGameSpeedUpdated((multiplier) => {
      if (active) setGameSpeed(multiplier)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const updateGameSpeed = async (multiplier: GameSpeedMultiplier) => {
    if (multiplier === gameSpeed || gameSpeedLoading) return
    setGameSpeedLoading(true)
    setMessage('')
    try {
      const next = await window.electronAPI.setGameSpeed(multiplier)
      setGameSpeed(next)
      setMessage(t('admin.gameSpeedDone', { multiplier: next }))
    } catch (error) {
      setMessage(formatApiError(error))
    } finally {
      setGameSpeedLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return players
    return players.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.friend_code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    )
  }, [players, query])

  const refreshSelfIfNeeded = async (playerId: string) => {
    if (currentUserId && playerId === currentUserId) {
      await window.electronAPI.reloadFromCloud()
    }
  }

  const grantGems = async (player: AdminPlayer) => {
    setBusyId(player.id)
    setMessage('')
    try {
      const next = await window.electronAPI.adminGrantGems(player.id, gemAmount)
      setMessage(t('admin.grantGemsDone', { name: player.username, gems: next }))
      await refreshSelfIfNeeded(player.id)
      await load()
    } catch (e) {
      setMessage(formatApiError(e))
    } finally {
      setBusyId(null)
    }
  }

  const grantItem = async (player: AdminPlayer) => {
    setBusyId(player.id)
    setMessage('')
    try {
      const next = await window.electronAPI.adminGrantItem(player.id, itemType, itemQty)
      setMessage(
        t('admin.grantItemDone', {
          name: player.username,
          item: tItemLabel(itemType),
          qty: next
        })
      )
      await refreshSelfIfNeeded(player.id)
      await load()
    } catch (e) {
      setMessage(formatApiError(e))
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    setMessage('')
    try {
      await window.electronAPI.adminDeleteUser(pendingDelete.id)
      setMessage(t('admin.deleteDone', { name: pendingDelete.username }))
      setPendingDelete(null)
      await load()
    } catch (e) {
      setMessage(formatApiError(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-modal admin-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="hub-modal-head">
          <h2>
            {t('admin.title')}
            <span className="admin-badge">{t('admin.badge')}</span>
          </h2>
          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="admin-panel">
          <p className="admin-panel-desc">{t('admin.description')}</p>

          <div className="admin-toolbar">
            <input
              className="admin-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.searchPlaceholder')}
              aria-label={t('admin.searchPlaceholder')}
            />
            <button type="button" className="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? t('common.loading') : t('common.refresh')}
            </button>
          </div>

          <section className="admin-game-speed" aria-label={t('admin.gameSpeedTitle')}>
            <div>
              <strong>{t('admin.gameSpeedTitle')}</strong>
              <p>{t('admin.gameSpeedDescription')}</p>
            </div>
            <div className="admin-game-speed-actions">
              {GAME_SPEED_MULTIPLIERS.map((multiplier) => (
                <button
                  key={multiplier}
                  type="button"
                  className={`admin-game-speed-button${multiplier === gameSpeed ? ' is-active' : ''}`}
                  disabled={gameSpeedLoading}
                  onClick={() => void updateGameSpeed(multiplier)}
                >
                  X{multiplier}
                </button>
              ))}
            </div>
          </section>

          <div className="admin-grant-defaults">
            <label>
              {t('admin.gemAmount')}
              <input
                type="number"
                min={1}
                value={gemAmount}
                onChange={(e) => setGemAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              />
            </label>
            <label>
              {t('admin.itemType')}
              <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)}>
                {ALL_ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {tItemLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('admin.itemQty')}
              <input
                type="number"
                min={1}
                value={itemQty}
                onChange={(e) => setItemQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              />
            </label>
          </div>

          {message && <p className="admin-message">{message}</p>}

          {pendingDelete && (
            <div className="admin-confirm">
              <p>{t('admin.deleteConfirm', { name: pendingDelete.username })}</p>
              <div className="admin-confirm-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPendingDelete(null)}
                  disabled={busyId !== null}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => void confirmDelete()}
                  disabled={busyId !== null}
                >
                  {busyId ? t('common.loading') : t('admin.deleteAccount')}
                </button>
              </div>
            </div>
          )}

          <ul className="admin-player-list">
            {filtered.map((player) => {
              const isSelf = player.id === currentUserId
              const busy = busyId === player.id
              return (
                <li key={player.id} className="admin-player-row">
                  <div className="admin-player-info">
                    <strong>
                      {player.username}
                      {player.role === 'admin' ? ` · ${t('admin.badge')}` : ''}
                    </strong>
                    <span>
                      {player.friend_code} · {t('home.gems')} {player.gems}
                    </span>
                  </div>
                  <div className="admin-player-actions">
                    <button
                      type="button"
                      className="dash-hud-action dash-hud-action--inline"
                      disabled={busy}
                      onClick={() => void grantGems(player)}
                    >
                      {t('admin.grantGems')}
                    </button>
                    <button
                      type="button"
                      className="dash-hud-action dash-hud-action--inline"
                      disabled={busy}
                      onClick={() => void grantItem(player)}
                    >
                      {t('admin.grantItem')}
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      disabled={busy || isSelf}
                      title={isSelf ? t('admin.deleteSelfBlocked') : t('admin.deleteAccount')}
                      onClick={() => setPendingDelete(player)}
                    >
                      {t('admin.deleteAccount')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {!loading && filtered.length === 0 && <p className="pixel-muted-text">{t('admin.empty')}</p>}
        </div>
      </div>
    </div>
  )
}
