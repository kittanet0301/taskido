import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnimationState, GameSave, ItemType } from '../shared/types'
import { DinoSprite } from '../components/DinoSprite'
import { getPetLevel, getStageLabel } from '../shared/activityScore'
import { QUICK_ITEM_SLOT_COUNT } from '../shared/constants'
import { normalizeQuickItemSlots } from '../shared/items'
import {
  CARE_FEEDBACK_MS,
  careDeltaLabel,
  getCareFeedback,
  type CareStatDelta
} from '../shared/careFeedback'
import { canEvolveToAdult, canHatchEgg } from '../shared/stats'
import { tCharacter, tItemDescription, tItemLabel } from '../i18n/labels'
import { creatureDisplaySize, waitForHatchAnimation } from '../shared/petSprites'
import { CREATURE_SPECIES, isCreatureSpecies } from '../shared/creatureCharacters'
import { ALL_ITEM_TYPES, ITEM_ICON_SRC } from '../shared/itemIcons'
import { HomeMissionsPanel } from './HomeMissionsPanel'
import { CombatStatCheck } from '../components/CombatStatCheck'
import { GrowthLevelUpModal } from '../components/GrowthLevelUpModal'
import {
  coverImagePointToPercent,
  DASH_BG_HEIGHT,
  DASH_BG_WIDTH,
  DASH_SCENE_ANCHORS,
  dashSpriteSize
} from './dashSceneLayout'

interface Props {
  save: GameSave
  focusMode?: boolean
  /** Show TEST debug tools when the signed-in user is admin. */
  isAdmin?: boolean
  onUpdated: () => void | Promise<void>
  /** External care-use pulse (e.g. from Inventory click). Item already consumed. */
  carePulse?: { type: ItemType; key: number } | null
  /** Open skill-forget picker (Skill forget scroll). */
  onSkillForget?: () => void
}

interface CareFxState {
  key: number
  itemType?: ItemType
  deltas: CareStatDelta[]
}

const QUICK_ITEM_TYPES: ItemType[] = ALL_ITEM_TYPES
const LEVEL_UP_FX_MS = 2200
const EVOLVE_CHARGE_MS = 750
const EVOLVE_FX_MS = 2400

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function statPercent(value: number, max: number): string {
  return `${Math.max(0, Math.min(100, (value / max) * 100))}%`
}

export function HomeDashboard({
  save,
  focusMode = false,
  isAdmin = false,
  onUpdated,
  carePulse = null,
  onSkillForget
}: Props) {
  const { t } = useTranslation()
  const sceneRef = useRef<HTMLDivElement>(null)
  const careClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const levelUpFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const evolveFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const careFxKeyRef = useRef(0)
  const lastCarePulseKeyRef = useRef(0)
  const prevLevelRef = useRef<number | null>(null)
  const prevStageRef = useRef<string | null>(null)
  const pet = save.pet
  const isEgg = pet?.stage === 'egg'
  const [layout, setLayout] = useState({ leftPct: 50, topPct: 50, spriteSize: 96 })
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [hatching, setHatching] = useState(false)
  const [evolving, setEvolving] = useState(false)
  const [evolvePhase, setEvolvePhase] = useState<'charge' | 'reveal' | null>(null)
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const [levelUpBusy, setLevelUpBusy] = useState(false)
  const [careAnim, setCareAnim] = useState<AnimationState | null>(null)
  const [careFx, setCareFx] = useState<CareFxState | null>(null)
  const [levelUpFx, setLevelUpFx] = useState<{ key: number; level: number } | null>(null)
  const [evolveFx, setEvolveFx] = useState<{ key: number } | null>(null)
  const hatchDoneRef = useRef<(() => void) | null>(null)
  const sceneKey = 'hatch'
  const hasPendingLevelUp = (pet?.pendingGrowthOffers?.length ?? 0) > 0

  const quickSlots = useMemo(
    () => normalizeQuickItemSlots(save.quickItemSlots).slice(0, QUICK_ITEM_SLOT_COUNT),
    [save.quickItemSlots]
  )

  useEffect(() => {
    const el = sceneRef.current
    if (!el || !pet) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width === 0 || height === 0) return
      const anchor = DASH_SCENE_ANCHORS[isEgg ? 'egg' : 'pedestal']
      const pos = coverImagePointToPercent(
        width,
        height,
        DASH_BG_WIDTH,
        DASH_BG_HEIGHT,
        anchor.x,
        anchor.y
      )
      setLayout({
        leftPct: pos.leftPct,
        topPct: pos.topPct,
        spriteSize: isCreatureSpecies(pet.character)
          ? creatureDisplaySize(pet.stage)
          : dashSpriteSize(width, Boolean(isEgg))
      })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isEgg, pet])

  useEffect(() => {
    return () => {
      if (careClearTimerRef.current) clearTimeout(careClearTimerRef.current)
      if (levelUpFxTimerRef.current) clearTimeout(levelUpFxTimerRef.current)
      if (evolveFxTimerRef.current) clearTimeout(evolveFxTimerRef.current)
    }
  }, [])

  const clearCareFeedback = useCallback(async () => {
    setCareAnim(null)
    setCareFx(null)
    await window.electronAPI.patchGame('setPetAnimation', ['idle'])
    await onUpdated()
  }, [onUpdated])

  const playCareFeedback = useCallback(
    (type: ItemType) => {
      const feedback = getCareFeedback(type)
      if (!feedback) return
      if (careClearTimerRef.current) clearTimeout(careClearTimerRef.current)
      careFxKeyRef.current += 1
      setCareAnim(feedback.anim)
      setCareFx({
        key: careFxKeyRef.current,
        itemType: type,
        deltas: feedback.deltas
      })
      careClearTimerRef.current = setTimeout(() => {
        careClearTimerRef.current = null
        void clearCareFeedback()
      }, CARE_FEEDBACK_MS)
    },
    [clearCareFeedback]
  )

  const playStatFeedback = useCallback(
    (kind: 'health' | 'emotion', amount: number) => {
      if (amount === 0) return
      if (careClearTimerRef.current) clearTimeout(careClearTimerRef.current)
      careFxKeyRef.current += 1
      setCareAnim(amount > 0 ? 'happy' : 'sad')
      setCareFx({
        key: careFxKeyRef.current,
        deltas: [{ kind, amount }]
      })
      careClearTimerRef.current = setTimeout(() => {
        careClearTimerRef.current = null
        void clearCareFeedback()
      }, CARE_FEEDBACK_MS)
    },
    [clearCareFeedback]
  )

  const playLevelUpFx = useCallback((level: number) => {
    if (careClearTimerRef.current) {
      clearTimeout(careClearTimerRef.current)
      careClearTimerRef.current = null
    }
    if (levelUpFxTimerRef.current) clearTimeout(levelUpFxTimerRef.current)
    careFxKeyRef.current += 1
    setCareFx(null)
    setEvolveFx(null)
    setCareAnim('happy')
    setLevelUpFx({ key: careFxKeyRef.current, level })
    levelUpFxTimerRef.current = setTimeout(() => {
      levelUpFxTimerRef.current = null
      setCareAnim(null)
      setLevelUpFx(null)
    }, LEVEL_UP_FX_MS)
  }, [])

  const finishEvolveFx = useCallback(async () => {
    setCareAnim(null)
    setEvolveFx(null)
    setEvolvePhase(null)
    setEvolving(false)
    await window.electronAPI.patchGame('setPetAnimation', ['idle'])
    await onUpdated()
  }, [onUpdated])

  const playEvolveRevealFx = useCallback(() => {
    if (careClearTimerRef.current) {
      clearTimeout(careClearTimerRef.current)
      careClearTimerRef.current = null
    }
    if (levelUpFxTimerRef.current) {
      clearTimeout(levelUpFxTimerRef.current)
      levelUpFxTimerRef.current = null
    }
    if (evolveFxTimerRef.current) clearTimeout(evolveFxTimerRef.current)
    careFxKeyRef.current += 1
    setCareFx(null)
    setLevelUpFx(null)
    setEvolvePhase('reveal')
    setCareAnim('happy')
    setEvolveFx({ key: careFxKeyRef.current })
    evolveFxTimerRef.current = setTimeout(() => {
      evolveFxTimerRef.current = null
      void finishEvolveFx()
    }, EVOLVE_FX_MS)
  }, [finishEvolveFx])

  useEffect(() => {
    if (!carePulse || carePulse.key === lastCarePulseKeyRef.current) return
    if (!pet || pet.stage === 'egg' || hatching || evolving) return
    lastCarePulseKeyRef.current = carePulse.key
    playCareFeedback(carePulse.type)
  }, [carePulse, pet, hatching, evolving, playCareFeedback])

  useEffect(() => {
    if (!pet || pet.stage === 'egg') {
      prevLevelRef.current = null
      prevStageRef.current = pet?.stage ?? null
      return
    }
    const level = getPetLevel(pet.stage, pet.stats.evolution)
    const prev = prevLevelRef.current
    const prevStage = prevStageRef.current
    prevLevelRef.current = level
    prevStageRef.current = pet.stage
    // Stage change (baby → adult) recalculates level; don't treat as a level-up claim.
    if (prevStage != null && prevStage !== pet.stage) return
    if (prev != null && level > prev && !hatching && !evolving) {
      playLevelUpFx(level)
    }
  }, [pet?.id, pet?.stage, pet?.stats.evolution, hatching, evolving, playLevelUpFx, pet])

  if (!pet) return null

  const inventoryByType = new Map(save.inventory.map((item) => [item.type, item.quantity]))
  const canHatch = canHatchEgg(pet)
  const canEvolve = canEvolveToAdult(pet)

  const useQuickItem = async (type: ItemType | null) => {
    if (!type || !inventoryByType.get(type)) return
    if (pet.stage === 'egg' || hatching || evolving) return
    if (type === 'skill_forget') {
      onSkillForget?.()
      return
    }
    const feedback = getCareFeedback(type)
    if (!feedback) return

    await window.electronAPI.patchGame('useItem', [type])
    await onUpdated()
    playCareFeedback(type)
  }

  const setQuickItem = async (slotIndex: number, type: ItemType | null) => {
    await window.electronAPI.patchGame('setQuickItemSlot', [slotIndex, type])
    setEditingSlot(null)
    onUpdated()
  }

  const runPetAction = async () => {
    if (hatching || evolving) return
    if (canHatch) {
      setHatching(true)
      await waitForHatchAnimation(pet.character, (finish) => {
        hatchDoneRef.current = finish
      })
      hatchDoneRef.current = null
      await window.electronAPI.patchGame('hatch')
      await onUpdated()
      setHatching(false)
      return
    }
    if (canEvolve) {
      setEvolving(true)
      setEvolvePhase('charge')
      setCareFx(null)
      setLevelUpFx(null)
      setCareAnim(null)
      try {
        await delay(EVOLVE_CHARGE_MS)
        await window.electronAPI.patchGame('evolve')
        await onUpdated()
        playEvolveRevealFx()
      } catch {
        setEvolving(false)
        setEvolvePhase(null)
        setEvolveFx(null)
      }
    }
  }

  const runDebug = async (mutator: string, args: unknown[] = []) => {
    await window.electronAPI.patchGame(mutator, args)
    onUpdated()
  }

  const runDebugCare = async (kind: 'health' | 'emotion', amount: number) => {
    if (!pet || pet.stage === 'egg' || hatching || evolving) return
    await window.electronAPI.patchGame('debugAdjustCare', [kind, amount])
    await onUpdated()
    playStatFeedback(kind, amount)
  }

  const pickGrowthCard = async (cardId: string) => {
    if (!pet || levelUpBusy) return
    setLevelUpBusy(true)
    try {
      await window.electronAPI.patchGame('applyGrowthCard', [pet.id, cardId])
      await onUpdated()
    } finally {
      setLevelUpBusy(false)
    }
  }

  const upgradeSkillFromLevelUp = async (slotIndex: number) => {
    if (!pet || levelUpBusy) return
    setLevelUpBusy(true)
    try {
      await window.electronAPI.patchGame('upgradeSkillRank', [pet.id, slotIndex])
      await onUpdated()
    } finally {
      setLevelUpBusy(false)
    }
  }

  return (
    <div className={`dash-hud dash-hud--${sceneKey}${focusMode ? ' dash-hud--focus' : ''}`}>
      <div ref={sceneRef} className="dash-hud-scene">
        <img
          src="/ui/dash-bg-hatch-v2.png"
          alt=""
          className="dash-scene-bg"
          width={DASH_BG_WIDTH}
          height={DASH_BG_HEIGHT}
          draggable={false}
        />

        <section className="dash-hud-status" aria-label="Pet status">
          <div className="dash-hud-nameplate">
            <span>{pet.name}</span>
            <strong>
              {getStageLabel(pet.stage)} Lv.{getPetLevel(pet.stage, pet.stats.evolution)}
            </strong>
            <div className="dash-hud-nameplate-elements">
              <span className={`element-badge element-badge--${pet.elementPrimary}`}>
                {t(`elements.${pet.elementPrimary}`)}
              </span>
              {pet.elementSecondary && (
                <span className={`element-badge element-badge--${pet.elementSecondary}`}>
                  {t(`elements.${pet.elementSecondary}`)}
                </span>
              )}
            </div>
          </div>
          <div className="dash-hud-status-body">
            <div className="hud-bar hud-bar--hp">
              <span>{t('home.health')}</span>
              <div><i style={{ width: statPercent(pet.stats.health, 100) }} /></div>
              <b>{pet.stats.health}/100</b>
            </div>
            <div className="hud-bar hud-bar--mood">
              <span>{t('home.emotion')}</span>
              <div><i style={{ width: statPercent(pet.stats.emotion, 100) }} /></div>
              <b>{pet.stats.emotion}/100</b>
            </div>
            <div className="hud-bar hud-bar--xp">
              <span>{t('home.evolution')}</span>
              <div><i style={{ width: statPercent(pet.stats.evolution, 999) }} /></div>
              <b>{pet.stats.evolution}/999</b>
            </div>
            <CombatStatCheck pet={pet} variant="compact" className="dash-hud-combat-stats" />
            {hasPendingLevelUp && (
              <button
                type="button"
                className="dash-hud-cta dash-hud-cta--levelup"
                onClick={() => setLevelUpOpen(true)}
              >
                <span className="dash-hud-cta__label">{t('growth.claimLevelUp')}</span>
              </button>
            )}
            {(canHatch || canEvolve || evolving) && (
              <button
                type="button"
                className="dash-hud-cta dash-hud-cta--evolve"
                onClick={runPetAction}
                disabled={hatching || evolving}
              >
                <span className="dash-hud-cta__label">
                  {hatching
                    ? t('pet.hatching')
                    : evolving
                      ? t('pet.evolving')
                      : canHatch
                        ? t('pet.hatch')
                        : t('pet.evolveToAdult')}
                </span>
              </button>
            )}
            {isAdmin && (
              <div className="dash-hud-debug" aria-label="Test controls">
                <span className="dash-hud-debug-label">TEST</span>
                <div className="dash-hud-debug-row">
                  {CREATURE_SPECIES.map((species) => (
                    <button
                      key={species}
                      type="button"
                      className={`dash-hud-debug-btn${pet.character === species ? ' active' : ''}`}
                      onClick={() => runDebug('debugSetSpecies', [species])}
                      title={tCharacter(species)}
                    >
                      {species}
                    </button>
                  ))}
                </div>
                <div className="dash-hud-debug-row">
                  {(['egg', 'baby', 'adult'] as const).map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className={`dash-hud-debug-btn${pet.stage === stage ? ' active' : ''}`}
                      onClick={() => runDebug('debugSetStage', [stage])}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
                <div className="dash-hud-debug-row">
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => void runDebugCare('health', 10)}
                    title={t('home.health')}
                  >
                    HP+
                  </button>
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => void runDebugCare('health', -10)}
                    title={t('home.health')}
                  >
                    HP-
                  </button>
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => void runDebugCare('emotion', 10)}
                    title={t('home.emotion')}
                  >
                    Mood+
                  </button>
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => void runDebugCare('emotion', -10)}
                    title={t('home.emotion')}
                  >
                    Mood-
                  </button>
                </div>
                <div className="dash-hud-debug-row">
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => runDebug('debugBoostDev', [50])}
                    title={t('home.evolution')}
                  >
                    +50 Evo
                  </button>
                  {CREATURE_SPECIES.map((species) => (
                    <button
                      key={`egg-${species}`}
                      type="button"
                      className="dash-hud-debug-btn"
                      onClick={() => runDebug('newEgg', [species])}
                    >
                      +{species} egg
                    </button>
                  ))}
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => runDebug('debugGrantItem', ['breed_nest', 3])}
                    title={t('items.breed_nest.label')}
                  >
                    +nest
                  </button>
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() => runDebug('debugGrantItem', ['skill_forget', 3])}
                    title={t('items.skill_forget.label')}
                  >
                    +forget
                  </button>
                  <button
                    type="button"
                    className="dash-hud-debug-btn"
                    onClick={() =>
                      runDebug('debugSetGender', [pet.gender === 'female' ? 'male' : 'female'])
                    }
                    title={t('pet.gender')}
                  >
                    flip {pet.gender === 'female' ? 'F→M' : 'M→F'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <HomeMissionsPanel save={save} onUpdated={onUpdated} />

        <div
          className={[
            `dash-scene-pet dash-scene-pet--${isEgg ? 'egg' : 'pedestal'}`,
            evolving && evolvePhase ? `dash-scene-pet--evolve-${evolvePhase}` : ''
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: `${layout.leftPct}%`, top: `${layout.topPct}%` }}
        >
          {evolving && <div className="dash-evolve-burst" aria-hidden />}
          <div className="dash-evolve-sprite">
            <DinoSprite
              pet={pet}
              size={layout.spriteSize}
              hatching={hatching}
              careAnim={careAnim}
              onHatchComplete={() => hatchDoneRef.current?.()}
            />
          </div>
          {careFx && (
            <div key={careFx.key} className="dash-care-fx" aria-hidden>
              {careFx.itemType && (
                <img
                  className="dash-care-fx-icon"
                  src={ITEM_ICON_SRC[careFx.itemType]}
                  alt=""
                  draggable={false}
                />
              )}
              <div className="dash-care-fx-deltas">
                {careFx.deltas.map((delta) => (
                  <span
                    key={`${delta.kind}-${delta.amount}`}
                    className={`dash-care-fx-delta dash-care-fx-delta--${delta.kind}`}
                  >
                    {delta.amount > 0 ? '+' : ''}
                    {delta.amount} {careDeltaLabel(delta.kind)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {levelUpFx && (
            <div key={levelUpFx.key} className="dash-levelup-fx" aria-hidden>
              <strong>{t('growth.banner')}</strong>
              <span>{t('growth.bannerLevel', { level: levelUpFx.level })}</span>
            </div>
          )}
          {evolveFx && (
            <div key={evolveFx.key} className="dash-evolve-fx" aria-hidden>
              <strong>{t('pet.evolveBanner')}</strong>
              <span>{t('pet.evolveBannerAdult')}</span>
            </div>
          )}
        </div>

        <section className="dash-hud-quickbar" aria-label={t('home.quickCare')}>
          {quickSlots.map((type, index) => {
            const quantity = type ? inventoryByType.get(type) ?? 0 : 0
            const isSkillForget = type === 'skill_forget'
            const canCare = Boolean(type && getCareFeedback(type))
            const canUse =
              (canCare || (isSkillForget && Boolean(onSkillForget))) &&
              quantity > 0 &&
              pet.stage !== 'egg' &&
              !hatching &&
              !evolving
            const disabled = !type || !canUse
            return (
              <div key={`${type ?? 'empty'}-${index}`} className="dash-hud-slot-wrap">
                <button
                  type="button"
                  className="dash-hud-slot"
                  disabled={disabled}
                  onClick={() => useQuickItem(type)}
                  title={type ? `${tItemLabel(type)} · ${tItemDescription(type)}` : t('inventory.empty')}
                >
                  {type ? <img className="hud-icon" src={ITEM_ICON_SRC[type]} alt="" draggable={false} /> : <span className="dash-hud-empty-slot" />}
                  {quantity > 0 && <strong>{quantity}</strong>}
                </button>
                <button
                  type="button"
                  className="dash-hud-slot-edit"
                  onClick={() => setEditingSlot(editingSlot === index ? null : index)}
                  title={t('inventory.title')}
                  aria-label={t('inventory.title')}
                >
                  +
                </button>
              </div>
            )
          })}
        </section>

        {editingSlot !== null && (
          <div className="dash-hud-picker">
            <div className="dash-hud-picker-head">
              <strong>{t('inventory.title')}</strong>
              <button type="button" onClick={() => setEditingSlot(null)} aria-label={t('common.cancel')}>
                ×
              </button>
            </div>
            <div className="dash-hud-picker-grid">
              {QUICK_ITEM_TYPES.map((type) => {
                const quantity = inventoryByType.get(type) ?? 0
                return (
                  <button
                    key={type}
                    type="button"
                    className="dash-hud-picker-item"
                    disabled={quantity <= 0}
                    onClick={() => setQuickItem(editingSlot, type)}
                    title={tItemDescription(type)}
                  >
                    <img className="hud-icon" src={ITEM_ICON_SRC[type]} alt="" draggable={false} />
                    <span>{tItemLabel(type)}</span>
                    <b>{quantity}</b>
                  </button>
                )
              })}
              <button
                type="button"
                className="dash-hud-picker-item dash-hud-picker-item--clear"
                onClick={() => setQuickItem(editingSlot, null)}
              >
                {t('common.none')}
              </button>
            </div>
          </div>
        )}
      </div>

      {levelUpOpen && pet && (
        <GrowthLevelUpModal
          pet={pet}
          busy={levelUpBusy}
          onClose={() => setLevelUpOpen(false)}
          onPickGrowthCard={pickGrowthCard}
          onUpgradeSkill={upgradeSkillFromLevelUp}
        />
      )}
    </div>
  )
}
