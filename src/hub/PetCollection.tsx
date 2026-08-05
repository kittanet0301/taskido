import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameSave, PetData, Stage } from '../shared/types'
import { petPreviewColor, PET_SLOTS_PER_PAGE, getBreedCooldownMs } from '../shared/constants'
import { DinoSprite } from '../components/DinoSprite'
import { GenderTag } from '../components/GenderTag'
import { displaySizeForPet } from '../shared/petSprites'
import { tCharacter, tStage } from '../i18n/labels'
import { canAddPet, getCollectionPageCount, getUsedSlots } from '../shared/petCollection'
import { getPetLevel, getStageLabel } from '../shared/activityScore'
import { canBreed } from '../shared/growth'
import { CombatStatCheck } from '../components/CombatStatCheck'
import { PetLoadoutPanel } from '../components/PetLoadoutPanel'

const COLLECTION_PREVIEW_SIZE = 88
const DETAIL_PREVIEW_SIZE = 120

type StageFilter = 'all' | Stage

function petSpriteSize(pet: PetData): number {
  return Math.min(displaySizeForPet(pet), COLLECTION_PREVIEW_SIZE)
}

function statPercent(value: number, max: number): string {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`
}

interface Props {
  save: GameSave
  newEggIds?: string[]
  onEggViewed?: (petId: string) => void
  onUpdated: () => void
  onSelect: () => void
  onClose: () => void
}

export function PetCollection({ save, newEggIds = [], onEggViewed, onUpdated, onSelect, onClose }: Props) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<StageFilter>('all')
  const [page, setPage] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<PetData | null>(null)
  const [detailPet, setDetailPet] = useState<PetData | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const skipRenameBlurRef = useRef(false)
  const [breedOpen, setBreedOpen] = useState(false)
  const [breedCelebrating, setBreedCelebrating] = useState(false)
  const [breedA, setBreedA] = useState<string | null>(null)
  const [breedB, setBreedB] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const breedCelebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Keep detail modal in sync after growth/skill mutators. */
  const liveDetailPet = useMemo(() => {
    if (!detailPet) return null
    if (save.pet?.id === detailPet.id) return save.pet
    return save.collection.find((p) => p.id === detailPet.id) ?? detailPet
  }, [detailPet, save.pet, save.collection])

  const forgetInv = useMemo(
    () => save.inventory.find((i) => i.type === 'skill_forget')?.quantity ?? 0,
    [save.inventory]
  )

  const patchDetail = async (mutator: string, args: unknown[] = []) => {
    if (busy) return
    setBusy(true)
    try {
      await window.electronAPI.patchGame(mutator, args)
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!breedOpen) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [breedOpen])

  useEffect(() => () => {
    if (breedCelebrationTimerRef.current) clearTimeout(breedCelebrationTimerRef.current)
  }, [])

  const allPets = useMemo<PetData[]>(
    () => (save.pet ? [save.pet, ...save.collection] : [...save.collection]),
    [save.pet, save.collection]
  )
  const adultPets = useMemo(() => allPets.filter((p) => p.stage === 'adult'), [allPets])

  const breedNestCount = useMemo(
    () => save.inventory.find((i) => i.type === 'breed_nest')?.quantity ?? 0,
    [save.inventory]
  )

  const findPet = (id: string | null): PetData | null =>
    id ? allPets.find((p) => p.id === id) ?? null : null

  const petA = findPet(breedA)
  const petB = findPet(breedB)

  const breedCooldownLeft = (pet: PetData): number => {
    if (!pet.lastBredAt) return 0
    const t = new Date(pet.lastBredAt).getTime()
    if (!Number.isFinite(t)) return 0
    return Math.max(0, getBreedCooldownMs() - (now - t))
  }

  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return '0s'
    const totalSec = Math.ceil(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const canBreedNow =
    petA && petB && petA.id !== petB.id && canBreed(petA, petB, now) && breedNestCount > 0 && canAddPet(save)
  const usedSlots = getUsedSlots(save)
  const freeSlots = Math.max(0, save.petSlotLimit - usedSlots)

  const breedBlockReason = ((): string | null => {
    if (adultPets.length < 2) return t('breed.needAdults')
    if (breedNestCount <= 0) return t('breed.needNest')
    if (!canAddPet(save)) return t('collection.noSlots')
    if (!petA || !petB || petA.id === petB.id) return null
    if (petA.gender === petB.gender) return t('breed.needOppositeGender')
    if (!canBreed(petA, petB, now)) return t('breed.notEligible')
    return null
  })()

  const maxCollectionSlots = save.pet ? save.petSlotLimit - 1 : save.petSlotLimit

  const filteredCollection = useMemo(
    () => (filter === 'all' ? save.collection : save.collection.filter((p) => p.stage === filter)),
    [save.collection, filter]
  )

  const pageCount =
    filter === 'all'
      ? getCollectionPageCount(maxCollectionSlots, PET_SLOTS_PER_PAGE)
      : Math.max(1, Math.ceil(filteredCollection.length / PET_SLOTS_PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const startIdx = safePage * PET_SLOTS_PER_PAGE
  const endIdx = Math.min(startIdx + PET_SLOTS_PER_PAGE, filter === 'all' ? maxCollectionSlots : filteredCollection.length)
  const slotIndices = Array.from({ length: endIdx - startIdx }, (_, i) => startIdx + i)

  const changeFilter = (next: StageFilter) => {
    setFilter(next)
    setPage(0)
  }

  const startRename = () => {
    if (!save.pet) return
    setNameDraft(save.pet.name)
    setEditingName(true)
  }

  const cancelRename = () => {
    skipRenameBlurRef.current = true
    setEditingName(false)
    setNameDraft('')
  }

  const saveRename = async () => {
    if (!save.pet) return
    if (skipRenameBlurRef.current) {
      skipRenameBlurRef.current = false
      return
    }
    const nextName = nameDraft.trim()
    if (!nextName || nextName === save.pet.name) {
      setEditingName(false)
      setNameDraft('')
      return
    }
    setBusy(true)
    try {
      await window.electronAPI.patchGame('rename', [nextName])
      try {
        await window.electronAPI.forceCloudSave()
      } catch (err) {
        console.error('[collection] failed to sync rename:', err)
      }
      setEditingName(false)
      setNameDraft('')
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  const setActive = async (petId: string, navigate: boolean) => {
    setEditingName(false)
    await window.electronAPI.patchGame('setActivePet', [petId])
    try {
      await window.electronAPI.forceCloudSave()
    } catch (err) {
      console.error('[collection] failed to sync full save after main pet switch:', err)
    }
    onUpdated()
    if (navigate) onSelect()
  }

  const selectToPlay = async (pet: PetData) => {
    setBusy(true)
    try {
      await setActive(pet.id, true)
      setDetailPet(null)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    await window.electronAPI.patchGame('releasePet', [pendingDelete.id])
    setPendingDelete(null)
    setDetailPet(null)
    onUpdated()
  }

  const runBreed = async () => {
    if (!petA || !petB || !canBreedNow) return
    setBusy(true)
    try {
      await window.electronAPI.patchGame('breedPets', [petA.id, petB.id])
      setBreedCelebrating(true)
      onUpdated()
      try {
        await window.electronAPI.forceCloudSave()
      } catch (err) {
        console.error('[collection] failed to sync after breed:', err)
      }
      breedCelebrationTimerRef.current = window.setTimeout(() => {
        setBreedCelebrating(false)
        setBreedOpen(false)
        setBreedA(null)
        setBreedB(null)
      }, 1500)
    } finally {
      setBusy(false)
    }
  }

  const stageFilters: StageFilter[] = ['all', 'egg', 'baby', 'adult']

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-modal collection-modal card" onClick={(e) => e.stopPropagation()}>
      <div className="hub-modal-head">
        <h2>{t('collection.title')}</h2>
        <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
          ×
        </button>
      </div>
      <div className="collection-header">
        <div className="collection-capacity">
          <span className="collection-slots">{t('collection.slots', { used: usedSlots, limit: save.petSlotLimit })}</span>
          <span className={`collection-capacity-status ${freeSlots === 0 ? 'collection-capacity-status--full' : ''}`}>
            {t(freeSlots === 0 ? 'collection.full' : 'collection.freeSlots', { count: freeSlots })}
          </span>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setBreedOpen(true)}
          disabled={adultPets.length < 2}
          title={t('breed.open')}
        >
          {t('breed.open')} ({breedNestCount})
        </button>
      </div>
      {freeSlots === 0 && (
        <div className="collection-capacity-alert" role="status">
          <strong>{t('collection.noSlots')}</strong>
          <span>{t('collection.noSlotsHint')}</span>
        </div>
      )}

      {save.pet && (
        <button
          type="button"
          className="collection-active-card collection-active-card--clickable"
          onClick={() => {
            if (editingName) return
            setDetailPet(save.pet)
          }}
          title={t('collection.viewDetails')}
        >
          <span className="collection-active-badge">{t('collection.active')}</span>
          <div
            className="collection-active-preview"
            style={{ background: petPreviewColor(save.pet.character) }}
          >
            <DinoSprite pet={save.pet} size={petSpriteSize(save.pet)} />
          </div>
          <div className="collection-active-meta">
            <div className="collection-active-name-row">
              {editingName ? (
                <input
                  className="collection-active-name-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void saveRename()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  onBlur={() => {
                    void saveRename()
                  }}
                  maxLength={24}
                  disabled={busy}
                  autoFocus
                  aria-label={t('pet.rename')}
                />
              ) : (
                <>
                  <strong>{save.pet.name}</strong>
                  <button
                    type="button"
                    className="collection-rename-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename()
                    }}
                    disabled={busy}
                    title={t('pet.rename')}
                    aria-label={t('pet.rename')}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <span className="collection-slot-info">
              {tCharacter(save.pet.character)} · <GenderTag gender={save.pet.gender} /> · {tStage(save.pet.stage)}
            </span>
          </div>
        </button>
      )}

      <div className="collection-filter-tabs">
        {stageFilters.map((stageKey) => (
          <button
            key={stageKey}
            type="button"
            className={`collection-filter-tab ${filter === stageKey ? 'collection-filter-tab--active' : ''}`}
            onClick={() => changeFilter(stageKey)}
          >
            {stageKey === 'all' ? t('collection.filterAll') : tStage(stageKey)}
          </button>
        ))}
      </div>

      <div className="collection-grid">
        {slotIndices.length === 0 && (
          <div className="collection-slot collection-slot-empty">
            <span className="collection-empty-label">{t('collection.empty')}</span>
          </div>
        )}
        {slotIndices.map((slotIdx) => {
          const pet = filter === 'all' ? save.collection[slotIdx] ?? null : filteredCollection[slotIdx]
          if (!pet) {
            return (
              <div key={`empty-${slotIdx}`} className="collection-slot collection-slot-empty">
                <span className="collection-empty-label">{t('collection.empty')}</span>
              </div>
            )
          }
          const isNewEgg = newEggIds.includes(pet.id)
          return (
            <div key={pet.id} className={`collection-slot${isNewEgg ? ' collection-slot--new' : ''}`}>
              <button
                type="button"
                className="collection-slot-btn"
                onClick={() => {
                  setDetailPet(pet)
                  if (isNewEgg) onEggViewed?.(pet.id)
                }}
                title={t('collection.select')}
              >
                <div
                  className="collection-slot-preview"
                  style={{ background: petPreviewColor(pet.character) }}
                >
                  <DinoSprite pet={pet} size={petSpriteSize(pet)} />
                </div>
                <div className="collection-slot-meta">
                  <strong className="collection-slot-name">{pet.name}</strong>
                  <span className="collection-slot-info">
                    {tCharacter(pet.character)} · <GenderTag gender={pet.gender} /> · {tStage(pet.stage)}
                  </span>
                </div>
              </button>
              {isNewEgg && <span className="collection-slot-new-badge">{t('collection.newEgg')}</span>}
              <button
                type="button"
                className="collection-delete-btn"
                onClick={() => setPendingDelete(pet)}
                title={t('collection.delete')}
                aria-label={t('collection.delete')}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {pageCount > 1 && (
        <div className="collection-pagination">
          <button
            type="button"
            className="secondary"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹
          </button>
          <span className="collection-page-label">
            {t('collection.page', { current: safePage + 1, total: pageCount })}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            ›
          </button>
        </div>
      )}

      {liveDetailPet && (
        <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={() => setDetailPet(null)}>
          <div className="hub-modal pet-detail-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="hub-modal-head">
              <h2>{liveDetailPet.name}</h2>
              <button
                type="button"
                className="hub-modal-close"
                onClick={() => setDetailPet(null)}
                aria-label={t('common.cancel')}
              >
                ×
              </button>
            </div>

            <div className="pet-detail-body">
              <div
                className="pet-detail-preview"
                style={{ background: petPreviewColor(liveDetailPet.character) }}
              >
                <DinoSprite pet={liveDetailPet} size={Math.min(displaySizeForPet(liveDetailPet), DETAIL_PREVIEW_SIZE)} />
              </div>
              <div className="pet-detail-info">
                <span className="collection-slot-info">
                  {tCharacter(liveDetailPet.character)} · <GenderTag gender={liveDetailPet.gender} />
                </span>
                <strong>
                  {getStageLabel(liveDetailPet.stage)} Lv.
                  {getPetLevel(liveDetailPet.stage, liveDetailPet.stats.evolution)}
                </strong>
                <div className="hud-bar hud-bar--hp">
                  <span>{t('home.health')}</span>
                  <div><i style={{ width: statPercent(liveDetailPet.stats.health, 100) }} /></div>
                  <b>{liveDetailPet.stats.health}/100</b>
                </div>
                <div className="hud-bar hud-bar--mood">
                  <span>{t('home.emotion')}</span>
                  <div><i style={{ width: statPercent(liveDetailPet.stats.emotion, 100) }} /></div>
                  <b>{liveDetailPet.stats.emotion}/100</b>
                </div>
                <div className="hud-bar hud-bar--xp">
                  <span>{t('home.evolution')}</span>
                  <div><i style={{ width: statPercent(liveDetailPet.stats.evolution, 999) }} /></div>
                  <b>{liveDetailPet.stats.evolution}/999</b>
                </div>
                <CombatStatCheck pet={liveDetailPet} variant="compact" />
              </div>
            </div>

            <PetLoadoutPanel
              pet={liveDetailPet}
              forgetCount={forgetInv}
              busy={busy}
              onUpgradeSkill={(slotIndex) => patchDetail('upgradeSkillRank', [liveDetailPet.id, slotIndex])}
              onForgetSkill={(slotIndex) => patchDetail('forgetSkill', [liveDetailPet.id, slotIndex])}
              onPickGrowthCard={(cardId) => patchDetail('applyGrowthCard', [liveDetailPet.id, cardId])}
            />

            {save.pet?.id !== liveDetailPet.id && (
              <div className="pet-detail-actions">
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => {
                    const target = liveDetailPet
                    setDetailPet(null)
                    setPendingDelete(target)
                  }}
                  disabled={busy}
                >
                  {t('collection.delete')}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => selectToPlay(liveDetailPet)}
                  disabled={busy}
                >
                  {t('collection.select')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {breedOpen && (
        <div
          className="hub-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !breedCelebrating && setBreedOpen(false)}
        >
          <div className="hub-modal hub-modal--lg breed-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="hub-modal-head">
              <h2>{t('breed.title')}</h2>
              <button
                type="button"
                className="hub-modal-close"
                onClick={() => !breedCelebrating && setBreedOpen(false)}
                disabled={breedCelebrating}
                aria-label={t('common.cancel')}
              >
                ×
              </button>
            </div>
            <p className="pet-profile-hint">
              {t('breed.hint')}
              {' · '}
              {t('breed.nestsOwned', { count: breedNestCount })}
              {' · '}
              {t('breed.nestSource')}
            </p>
            {breedCelebrating && (
              <div className="breed-success-fx" role="status" aria-live="polite">
                <span className="breed-success-star breed-success-star--one">✦</span>
                <span className="breed-success-star breed-success-star--two">✦</span>
                <span className="breed-success-star breed-success-star--three">✦</span>
                <div className="breed-success-egg" aria-hidden><i /><i /><i /></div>
                <strong>{t('breed.successTitle')}</strong>
                <span>{t('breed.successBody')}</span>
              </div>
            )}
            {!breedCelebrating && breedBlockReason && (
              <p className="pet-profile-hint" role="status">
                <strong>{breedBlockReason}</strong>
              </p>
            )}
            <div className="breed-picker">
              {(['a', 'b'] as const).map((side) => {
                const selected = side === 'a' ? petA : petB
                const setId = side === 'a' ? setBreedA : setBreedB
                const other = side === 'a' ? petB : petA
                return (
                  <div key={side} className="breed-picker-column">
                    <strong>{t(`breed.parent${side === 'a' ? 'A' : 'B'}`)}</strong>
                    <select
                      value={selected?.id ?? ''}
                    onChange={(e) => {
                      const nextId = e.target.value || null
                      setId(nextId)
                      // Clear the other side if it becomes same-gender after this pick.
                      if (nextId && other) {
                        const picked = adultPets.find((p) => p.id === nextId)
                        if (picked && picked.gender === other.gender) {
                          if (side === 'a') setBreedB(null)
                          else setBreedA(null)
                        }
                      }
                    }}
                    >
                      <option value="">—</option>
                      {adultPets.map((p) => {
                        const taken = other?.id === p.id
                        const wrongGender = other != null && p.gender === other.gender
                        return (
                          <option key={p.id} value={p.id} disabled={taken || wrongGender}>
                            {p.name} ({tCharacter(p.character)} · {p.gender === 'female' ? 'F' : 'M'})
                            {wrongGender ? ` — ${t('breed.sameGender')}` : ''}
                          </option>
                        )
                      })}
                    </select>
                    {selected && (
                      <div className="breed-picker-info">
                        <span>
                          {tCharacter(selected.character)} · <GenderTag gender={selected.gender} />
                        </span>
                        {(() => {
                          const cd = breedCooldownLeft(selected)
                          if (cd > 0) {
                            return (
                              <span className="breed-cooldown">
                                {t('breed.cooldownLeft', { time: formatCooldown(cd) })}
                              </span>
                            )
                          }
                          return <span className="breed-ready">{t('breed.ready')}</span>
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {!breedCelebrating && <div className="breed-card-picker">
              <div className="breed-requirements" aria-label={t('breed.requirements')}>
                <span className={breedNestCount > 0 ? 'breed-requirement--met' : 'breed-requirement--missing'}>{t('breed.nestsOwned', { count: breedNestCount })}</span>
                <span className={freeSlots > 0 ? 'breed-requirement--met' : 'breed-requirement--missing'}>{t('breed.freeSlots', { count: freeSlots })}</span>
                <span>{t('breed.oppositeGenderRule')}</span>
              </div>
              <div className="breed-journey" aria-label={t('breed.requirements')}>
                <span className={petA ? 'breed-journey-step--done' : 'breed-journey-step--active'}><b>1</b>{t('breed.parentA')}</span>
                <i aria-hidden />
                <span className={petB ? 'breed-journey-step--done' : petA ? 'breed-journey-step--active' : ''}><b>2</b>{t('breed.parentB')}</span>
                <i aria-hidden />
                <span className={canBreedNow ? 'breed-journey-step--ready' : ''}><b>3</b>{t('breed.eggResult')}</span>
              </div>
              {breedBlockReason && <p className="breed-status-message" role="status"><strong>{breedBlockReason}</strong></p>}
              <div className="breed-parent-slots">
                {(['a', 'b'] as const).map((side) => {
                  const selected = side === 'a' ? petA : petB
                  const clear = side === 'a' ? () => setBreedA(null) : () => setBreedB(null)
                  return <div key={side} className={`breed-parent-slot ${selected ? 'breed-parent-slot--selected' : ''}`}>
                    <span className="breed-parent-label">{t(`breed.parent${side === 'a' ? 'A' : 'B'}`)}</span>
                    {selected ? <div className="breed-parent-selected">
                      <div className="breed-parent-preview" style={{ background: petPreviewColor(selected.character) }}><DinoSprite pet={selected} size={54} /></div>
                      <span><strong>{selected.name}</strong><small>{tCharacter(selected.character)} · {tStage(selected.stage)}</small></span>
                      <button type="button" className="breed-clear-btn" onClick={clear} aria-label={t('breed.clearParent', { parent: side.toUpperCase() })}>×</button>
                    </div> : <span className="breed-parent-placeholder">{t('breed.chooseParent')}</span>}
                  </div>
                })}
              </div>
              <div className="breed-candidate-heading">
                <strong>{t('breed.choosePet')}</strong>
                <span>{!petA ? t('breed.choosingParent', { parent: 'A' }) : !petB ? t('breed.choosingParent', { parent: 'B' }) : t('breed.pairComplete')}</span>
              </div>
              <div className="breed-candidate-grid">
                {adultPets.map((pet) => {
                  const cooldown = breedCooldownLeft(pet)
                  const selected = pet.id === petA?.id || pet.id === petB?.id
                  const wrongGender = !!((petA && pet.id !== petA.id && pet.gender === petA.gender) || (petB && pet.id !== petB.id && pet.gender === petB.gender))
                  const unavailableReason = cooldown > 0 ? t('breed.cooldownLeft', { time: formatCooldown(cooldown) }) : selected ? t('breed.selected') : wrongGender ? t('breed.sameGender') : null
                  const disabled = selected || !!unavailableReason || (!!petA && !!petB)
                  return <button key={pet.id} type="button" className={`breed-candidate-card${disabled ? ' breed-candidate-card--disabled' : ''}`} disabled={disabled}
                    onClick={() => (!petA ? setBreedA(pet.id) : setBreedB(pet.id))}>
                    <div className="breed-candidate-preview" style={{ background: petPreviewColor(pet.character) }}><DinoSprite pet={pet} size={64} /></div>
                    <span className="breed-candidate-details"><strong>{pet.name}</strong><small>{tCharacter(pet.character)} · <GenderTag gender={pet.gender} /></small><em className={unavailableReason ? 'breed-cooldown' : 'breed-ready'}>{unavailableReason ?? t('breed.ready')}</em></span>
                  </button>
                })}
              </div>
            </div>}
            {!breedCelebrating && <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => setBreedOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!canBreedNow || busy}
                onClick={runBreed}
              >
                {t('breed.breed')}
              </button>
            </div>}
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="collection-dialog-backdrop" role="presentation" onClick={() => setPendingDelete(null)}>
          <div
            className="collection-dialog card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p>{t('collection.deleteConfirm', { name: pendingDelete.name })}</p>
            <div className="collection-dialog-actions">
              <button type="button" className="secondary" onClick={() => setPendingDelete(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="danger-btn" onClick={confirmDelete}>
                {t('collection.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
