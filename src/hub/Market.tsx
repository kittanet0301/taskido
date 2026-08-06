import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave } from '../shared/types'
import { playSfx } from '../shared/audio'
import { ITEM_ICON_SRC } from '../shared/itemIcons'
import { PET_SLOT_MAX } from '../shared/constants'
import { canAddPet } from '../shared/petCollection'
import {
  MARKET_OFFERS,
  type MarketOffer,
  type MarketOfferKind
} from '../shared/market'
import { tItemLabel } from '../i18n/labels'

interface Props {
  save: GameSave
  onClose: () => void
  onUpdated?: () => void | Promise<void>
}

const GEM_ICON = '/ui/hud-stat-gems.png'
const EGG_ICON = '/ui/hud-icon-collection.png'
const SLOT_ICON = '/ui/hud-icon-collection.png'
const BUNDLE_ICON = '/ui/item-food-basic.png'

const SECTION_ORDER: Array<{ kind: MarketOfferKind; titleKey: string }> = [
  { kind: 'egg', titleKey: 'market.sectionEgg' },
  { kind: 'slots', titleKey: 'market.sectionSlots' },
  { kind: 'bundle', titleKey: 'market.sectionBundles' },
  { kind: 'item', titleKey: 'market.sectionItems' }
]

function offerIcon(offer: MarketOffer): string {
  if (offer.kind === 'egg') return EGG_ICON
  if (offer.kind === 'slots') return SLOT_ICON
  if (offer.kind === 'bundle') return BUNDLE_ICON
  return ITEM_ICON_SRC[offer.itemType]
}

function offerTitle(offer: MarketOffer, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (offer.kind === 'egg') return t('market.offerEgg')
  if (offer.kind === 'slots') return t('market.offerSlots', { count: offer.slots })
  if (offer.kind === 'bundle') return t('market.offerCareBundle')
  return tItemLabel(offer.itemType)
}

function offerSubtitle(offer: MarketOffer, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (offer.kind === 'egg') return t('market.offerEggHint')
  if (offer.kind === 'slots') return t('market.offerSlotsHint')
  if (offer.kind === 'bundle') {
    return offer.items.map((i) => `${tItemLabel(i.type)} ×${i.quantity}`).join(' · ')
  }
  if (offer.quantity > 1) return `×${offer.quantity}`
  return null
}

function disableReason(
  offer: MarketOffer,
  save: GameSave,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  const gems = save.gems ?? 0
  if (gems < offer.cost) return t('market.notEnoughGems')
  if (offer.kind === 'egg' && !canAddPet(save)) return t('market.slotsFull')
  if (offer.kind === 'slots' && save.petSlotLimit >= PET_SLOT_MAX) return t('market.slotsMax')
  return null
}

export function Market({ save, onClose, onUpdated }: Props) {
  const { t } = useTranslation()
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gems = save.gems ?? 0

  const buy = async (offerId: string) => {
    if (buyingId) return
    setBuyingId(offerId)
    setError(null)
    try {
      await window.electronAPI.patchGame('buyMarket', [offerId])
      playSfx('market_buy')
      await onUpdated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-modal market-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="hub-modal-head">
          <h2>{t('market.title')}</h2>
          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="market-balance" aria-label={t('home.gems')}>
          <img className="hud-icon" src={GEM_ICON} alt="" draggable={false} />
          <strong>{gems}</strong>
          <span>{t('home.gems')}</span>
          <span className="market-balance-slots">
            {t('market.slotStatus', { used: save.petSlotLimit, max: PET_SLOT_MAX })}
          </span>
        </div>

        {error && <p className="gift-error">{error}</p>}

        <div className="market-sections">
          {SECTION_ORDER.map((section) => {
            const offers = MARKET_OFFERS.filter((o) => o.kind === section.kind)
            if (offers.length === 0) return null
            return (
              <section key={section.kind} className="market-section">
                <h3 className="market-section-title">{t(section.titleKey)}</h3>
                <ul className="market-list">
                  {offers.map((offer) => {
                    const reason = disableReason(offer, save, t)
                    const busy = buyingId === offer.id
                    const disabled = buyingId !== null || reason !== null
                    const subtitle = offerSubtitle(offer, t)
                    return (
                      <li key={offer.id} className="market-row">
                        <img className="hud-icon market-row-icon" src={offerIcon(offer)} alt="" draggable={false} />
                        <div className="market-row-info">
                          <strong>{offerTitle(offer, t)}</strong>
                          {subtitle && <span className="market-row-sub">{subtitle}</span>}
                          {reason && <span className="market-row-warn">{reason}</span>}
                        </div>
                        <button
                          type="button"
                          className="dash-hud-action dash-hud-action--inline market-buy-btn"
                          disabled={disabled}
                          title={reason ?? undefined}
                          onClick={() => void buy(offer.id)}
                        >
                          <img className="hud-icon market-buy-gem" src={GEM_ICON} alt="" draggable={false} />
                          {busy ? '…' : offer.cost}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
