import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave, ItemType } from '../shared/types'
import { careItemSfx } from '../shared/audio/careSfx'
import { playSfx } from '../shared/audio'
import { getCareFeedback } from '../shared/careFeedback'
import { ITEM_ICON_SRC } from '../shared/itemIcons'
import { tItemDescription, tItemLabel } from '../i18n/labels'

interface PendingGift {
  id: string
  senderId: string
  senderName: string
  itemType: string
  quantity: number
  createdAt: string
}

interface Props {
  save: GameSave
  onClose: () => void
  onUpdated?: () => void | Promise<void>
  /** Called after a care item is used successfully (before close). */
  onCareUsed?: (type: ItemType) => void
  /** Open skill-forget picker instead of consuming via useItem. */
  onSkillForget?: () => void
}

type InventoryTab = 'items' | 'gifts'

export function Inventory({ save, onClose, onUpdated, onCareUsed, onSkillForget }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<InventoryTab>('items')
  const [pending, setPending] = useState<PendingGift[]>([])
  const [loadingGifts, setLoadingGifts] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [usingType, setUsingType] = useState<ItemType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = save.inventory.filter((item) => item.quantity > 0)
  const canUseCareItems = Boolean(save.pet && save.pet.stage !== 'egg')

  const useItem = async (type: ItemType) => {
    if (type === 'skill_forget') {
      onSkillForget?.()
      return
    }
    if (!getCareFeedback(type) || !canUseCareItems || usingType) return
    setUsingType(type)
    setError(null)
    try {
      await window.electronAPI.patchGame('useItem', [type])
      playSfx(getCareFeedback(type) ? careItemSfx(type) : 'item_use', {
        element: save.pet?.elementPrimary
      })
      await onUpdated?.()
      onCareUsed?.(type)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setUsingType(null)
    }
  }

  const loadPending = useCallback(async () => {
    setLoadingGifts(true)
    setError(null)
    try {
      const rows = await window.electronAPI.listPendingGifts()
      setPending(rows)
      if (rows.length > 0) setTab('gifts')
    } catch (e) {
      setPending([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingGifts(false)
    }
  }, [])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const claimOne = async (giftId: string) => {
    setClaiming(true)
    setError(null)
    try {
      await window.electronAPI.claimPendingGifts(giftId)
      await onUpdated?.()
      await loadPending()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setClaiming(false)
    }
  }

  const claimAll = async () => {
    setClaiming(true)
    setError(null)
    try {
      await window.electronAPI.claimPendingGifts(null)
      await onUpdated?.()
      await loadPending()
      setTab('items')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-modal inventory-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="hub-modal-head">
          <h2>{t('inventory.title')}</h2>
          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="inventory-tabs">
          <button
            type="button"
            className={`inventory-tab${tab === 'items' ? ' inventory-tab--active' : ''}`}
            onClick={() => setTab('items')}
          >
            {t('inventory.itemsTab')}
          </button>
          <button
            type="button"
            className={`inventory-tab${tab === 'gifts' ? ' inventory-tab--active' : ''}`}
            onClick={() => setTab('gifts')}
          >
            {t('inventory.giftsTab')}
            {pending.length > 0 && <span className="inventory-tab-badge">{pending.length}</span>}
          </button>
        </div>

        {error && <p className="gift-error">{error}</p>}

        {tab === 'items' ? (
          items.length === 0 ? (
            <p>{t('inventory.empty')}</p>
          ) : (
            <div className="inventory-grid">
              {items.map((item) => {
                const isSkillForget = item.type === 'skill_forget'
                const usable =
                  (Boolean(getCareFeedback(item.type)) && canUseCareItems) ||
                  (isSkillForget && Boolean(onSkillForget))
                const busy = usingType === item.type
                const title = usable
                  ? `${tItemLabel(item.type)} · ${t('inventory.use')} · ${tItemDescription(item.type)}`
                  : tItemDescription(item.type)
                const body = (
                  <>
                    <img className="hud-icon" src={ITEM_ICON_SRC[item.type]} alt="" draggable={false} />
                    <span className="inventory-grid-item-name">{tItemLabel(item.type)}</span>
                    <strong className="inventory-grid-item-qty">×{item.quantity}</strong>
                  </>
                )
                if (!usable) {
                  return (
                    <div key={item.type} className="inventory-grid-item" title={title}>
                      {body}
                    </div>
                  )
                }
                return (
                  <button
                    key={item.type}
                    type="button"
                    className={`inventory-grid-item inventory-grid-item--usable${busy ? ' inventory-grid-item--busy' : ''}`}
                    title={title}
                    disabled={usingType !== null}
                    onClick={() => void useItem(item.type)}
                  >
                    {body}
                  </button>
                )
              })}
            </div>
          )
        ) : loadingGifts ? (
          <p className="pixel-muted-text">{t('common.loading')}</p>
        ) : pending.length === 0 ? (
          <p>{t('gift.noPending')}</p>
        ) : (
          <div className="inventory-gifts">
            <ul className="inventory-gift-list">
              {pending.map((gift) => {
                const type = gift.itemType as ItemType
                return (
                  <li key={gift.id} className="inventory-gift-row">
                    <img
                      className="hud-icon"
                      src={ITEM_ICON_SRC[type] ?? ITEM_ICON_SRC.food_basic}
                      alt=""
                      draggable={false}
                    />
                    <div className="inventory-gift-info">
                      <strong>
                        {tItemLabel(type)} ×{gift.quantity}
                      </strong>
                      <span>{t('gift.from', { name: gift.senderName })}</span>
                    </div>
                    <button
                      type="button"
                      className="dash-hud-action dash-hud-action--inline"
                      onClick={() => void claimOne(gift.id)}
                      disabled={claiming}
                    >
                      {t('gift.claim')}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="dash-hud-action dash-hud-action--inline gift-send-btn"
              onClick={() => void claimAll()}
              disabled={claiming}
            >
              {claiming ? t('gift.claiming') : t('gift.claimAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
