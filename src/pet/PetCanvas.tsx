import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AudioMuteButton } from '../components/AudioMuteButton'
import type { AnimationState, GameSave } from '../shared/types'
import { petPreviewColor } from '../shared/constants'
import { resolvePetClip } from '../shared/dinoAnim'
import { canEvolveToAdult, canHatchEgg } from '../shared/stats'
import { getMissionDefinition } from '../shared/missions'
import { canAddPet } from '../shared/petCollection'
import {
  DINO_BOB_PERIOD,
  DINO_BOB_PERIOD_EGG
} from '../shared/dinoTiming'
import {
  drawPetSpriteFrame,
  frameSizeForPet,
  loadPetSprite,
  petSpriteUrl,
  preloadPetSprites,
  resolveSpriteRenderSize,
  setupCrispCanvas,
  spriteFrameIndexForClip
} from '../shared/petSprites'
import type { PetSpriteFolder } from '../shared/petSprites'

const DEFAULT_SIZE = 96
/** Desktop overlay pet is half the hub/collection display size. */
const DESKTOP_PET_SCALE = 0.5
/** Compensate for transparent padding below the feet inside sprite frames. */
const DESKTOP_SPRITE_GROUND_OFFSET_RATIO = 1 / 8
const PET_STATS_HEIGHT = 32
const PET_OVERLAY_MIN_WIDTH = 180
const PET_MENU_WIDTH = 220
const PET_MENU_GAP = 8
const PET_SCALE_MIN = 0.6
const PET_SCALE_MAX = 1.6
const PET_FONT_SIZE_MIN = 7
const PET_FONT_SIZE_MAX = 12

function desktopRenderSize(pet: NonNullable<GameSave['pet']>, scale: number) {
  const full = resolveSpriteRenderSize(pet)
  const desktopScale = DESKTOP_PET_SCALE * scale
  return {
    canvasSize: Math.max(32, Math.round(full.canvasSize * desktopScale)),
    drawSize: Math.max(24, Math.round(full.drawSize * desktopScale)),
    pixelScale: full.pixelScale * desktopScale
  }
}

const PET_CLIPS: Array<{ folder: PetSpriteFolder; clip: string }> = [
  { folder: 'base', clip: 'idle' },
  { folder: 'base', clip: 'move' },
  { folder: 'base', clip: 'hurt' },
  { folder: 'base', clip: 'bite' },
  { folder: 'base', clip: 'jump' },
  { folder: 'egg', clip: 'move' },
  { folder: 'egg', clip: 'hatch' },
  { folder: 'baby', clip: 'idle' },
  { folder: 'baby', clip: 'move' },
  { folder: 'baby', clip: 'hurt' },
  { folder: 'baby', clip: 'bite' },
  { folder: 'baby', clip: 'jump' },
  { folder: 'adult', clip: 'idle' },
  { folder: 'adult', clip: 'move' },
  { folder: 'adult', clip: 'hurt' },
  { folder: 'adult', clip: 'bite' },
  { folder: 'adult', clip: 'jump' }
]

export function PetCanvas() {
  const { t, i18n } = useTranslation()
  const petUiFontFamily =
    i18n.language === 'th'
      ? '"Mali", "Noto Sans Thai", sans-serif'
      : '"Press Start 2P", monospace'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [save, setSave] = useState<GameSave | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [petScale, setPetScale] = useState(1)
  const [bubbleFontSize, setBubbleFontSize] = useState(8)
  const [pendingGiftCount, setPendingGiftCount] = useState(0)
  const canvasSizeRef = useRef(DEFAULT_SIZE)
  const stateRef = useRef({
    frame: 0,
    animState: 'idle' as AnimationState,
    dragging: false,
    spriteUrl: '',
    spriteImg: null as HTMLImageElement | null
  })

  const pet = save?.pet
  const scaledRenderSize = pet ? desktopRenderSize(pet, petScale) : null
  const maxRenderSize = pet ? desktopRenderSize(pet, PET_SCALE_MAX) : null
  // While settings are open, keep a fixed maximum viewport so dragging the
  // slider never moves the slider itself or resizes the native window.
  const canvasSize = menuOpen
    ? (maxRenderSize?.canvasSize ?? DEFAULT_SIZE)
    : (scaledRenderSize?.canvasSize ?? DEFAULT_SIZE)
  const drawSize = scaledRenderSize?.drawSize ?? DEFAULT_SIZE
  const pixelScale = scaledRenderSize?.pixelScale ?? 4
  const overlayWidth = Math.max(canvasSize, PET_OVERLAY_MIN_WIDTH)
  const menuHeight = i18n.language === 'th' ? 194 : 178
  const missionReady =
    save?.missions.some((mission) => {
      if (!mission.completed) return false
      const reward = getMissionDefinition(mission.missionId)?.reward
      return !reward || !('newEgg' in reward) || canAddPet(save)
    }) ?? false
  const evolutionReady = pet ? canHatchEgg(pet) || canEvolveToAdult(pet) : false
  const giftReady = pendingGiftCount > 0
  const hasNotification = missionReady || evolutionReady || giftReady
  const notificationTitle = [
    missionReady ? t('desktopPet.missionReady') : null,
    evolutionReady ? t('desktopPet.evolutionReady') : null,
    giftReady ? t('desktopPet.giftsWaiting', { count: pendingGiftCount }) : null
  ]
    .filter(Boolean)
    .join(' · ')
  const notificationTopSpace = hasNotification ? Math.max(36, bubbleFontSize * 5) : 0
  const overlayHeight = notificationTopSpace + canvasSize + PET_STATS_HEIGHT
  const windowWidth = overlayWidth + (menuOpen ? PET_MENU_GAP + PET_MENU_WIDTH : 0)
  const windowHeight = Math.max(overlayHeight, menuOpen ? menuHeight : 0)
  canvasSizeRef.current = canvasSize

  const finishDrag = async () => {
    if (!stateRef.current.dragging) return
    stateRef.current.dragging = false
    document.body.style.cursor = 'grab'
    await window.petAPI.endDrag()
  }

  useEffect(() => {
    document.documentElement.style.cssText =
      'background:transparent!important;overflow:hidden!important;margin:0;width:100%;height:100%;cursor:grab'
    document.body.style.cssText =
      'background:transparent!important;overflow:hidden!important;margin:0;width:100%;height:100%;cursor:grab'
    const root = document.getElementById('root')
    if (root) {
      root.style.cssText =
        'background:transparent;overflow:hidden;margin:0;width:100%;height:100%;display:block;cursor:grab'
    }

    // Always receive mouse — click-through made drag unreliable.
    void window.petAPI.setIgnoreMouse(false)

    void window.petAPI.getGame().then(setSave)

    const unsubGame = window.petAPI.onGameUpdated(setSave)
    const unsubDrag = window.petAPI.onDragEnded(() => {
      stateRef.current.dragging = false
      document.body.style.cursor = 'grab'
    })
    const refreshPendingGifts = async () => {
      try {
        const gifts = await window.petAPI.listPendingGifts()
        setPendingGiftCount(gifts.length)
      } catch {
        // Offline / signed-out states keep the last known badge state.
      }
    }
    void refreshPendingGifts()
    const giftPoll = window.setInterval(() => void refreshPendingGifts(), 30_000)
    return () => {
      window.clearInterval(giftPoll)
      unsubGame()
      unsubDrag()
      void window.petAPI.endDrag()
    }
  }, [])

  useEffect(() => {
    void window.petAPI.resize(windowWidth, windowHeight, true)
  }, [windowHeight, windowWidth])

  useEffect(() => {
    if (!pet) return
    const urls = PET_CLIPS.map(({ folder, clip }) => petSpriteUrl(pet, folder, clip))
    void preloadPetSprites(urls)
    stateRef.current.spriteUrl = ''
    stateRef.current.spriteImg = null
  }, [pet?.gender, pet?.character, pet?.stage])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setupCrispCanvas(canvas, canvasSize)
  }, [canvasSize])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    const tick = () => {
      const s = stateRef.current
      s.frame++
      const activePet = save?.pet
      s.animState = 'idle'

      if (activePet) {
        const clip = resolvePetClip(activePet, s.frame, s.animState)
        const url = petSpriteUrl(activePet, clip.folder, clip.clip)
        if (url !== s.spriteUrl) {
          s.spriteUrl = url
          void loadPetSprite(url)
            .then((img) => {
              if (s.spriteUrl === url) s.spriteImg = img
            })
            .catch(() => {
              if (s.spriteUrl === url) s.spriteImg = null
            })
        }

        ctx.clearRect(0, 0, canvasSize, canvasSize)
        const bob =
          activePet.stage === 'egg'
            ? Math.round(Math.sin(s.frame / DINO_BOB_PERIOD_EGG) * 2)
            : s.animState.includes('walk')
              ? Math.round(Math.sin(s.frame / DINO_BOB_PERIOD) * 2)
              : Math.round(Math.sin(s.frame / DINO_BOB_PERIOD) * 3)
        const cx = Math.round(canvasSize / 2)
        const groundOffset = drawSize * DESKTOP_SPRITE_GROUND_OFFSET_RATIO
        const cy = Math.round(canvasSize - drawSize / 2 + groundOffset + bob)

        if (s.spriteImg) {
          const spriteFrame = spriteFrameIndexForClip(clip.clip, s.frame, s.spriteImg, activePet.character)
          drawPetSpriteFrame(ctx, s.spriteImg, spriteFrame, activePet.character, {
            x: cx,
            y: cy,
            pixelScale,
            drawSize,
            // Desktop pet starts facing left; source sprite art already faces left.
            flipX: false
          })
        } else {
          ctx.fillStyle = petPreviewColor(activePet.character)
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(12, frameSizeForPet(activePet) / 4), 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        ctx.clearRect(0, 0, canvasSize, canvasSize)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [save, canvasSize, drawSize, pixelScale])

  useEffect(() => {
    const onDblClick = () => {
      if (save?.pet && save.pet.stage !== 'egg') window.petAPI.patchGame('useItem', ['toy'])
    }
    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      window.petAPI.openHub()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void finishDrag()
    }
    window.addEventListener('dblclick', onDblClick)
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('dblclick', onDblClick)
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [save])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    stateRef.current.dragging = true
    stateRef.current.animState = 'idle'
    document.body.style.cursor = 'grabbing'
    void window.petAPI.startDrag()
  }

  return (
    <div
      className={`pet-overlay-root${i18n.language === 'th' ? ' pet-overlay-root--th' : ''}`}
      style={{
        width: windowWidth,
        height: windowHeight,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        gap: menuOpen ? PET_MENU_GAP : 0,
        background: 'transparent'
      }}
    >
      <div
        className="pet-overlay-column"
        style={{
          width: overlayWidth,
          height: overlayHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flex: '0 0 auto'
        }}
      >
        <div
          className="pet-canvas-wrap"
          style={{
            position: 'relative',
            width: canvasSize,
            height: canvasSize,
            marginTop: notificationTopSpace,
            flex: '0 0 auto',
            overflow: 'visible'
          }}
        >
          <canvas
            ref={canvasRef}
            className="dino-sprite-canvas"
            style={{
              display: 'block',
              background: 'transparent',
              overflow: 'hidden',
              cursor: 'grab'
            }}
            onPointerDown={onPointerDown}
            onPointerUp={() => void finishDrag()}
            onPointerCancel={() => void finishDrag()}
          />
          {hasNotification && (
            <span
              className="pet-status-bubble"
              aria-label={notificationTitle}
              title={notificationTitle}
              style={{
                left: '50%',
                bottom: Math.round(drawSize * 0.72),
                fontFamily: petUiFontFamily,
                fontSize: bubbleFontSize
              }}
            >
              {notificationTitle}
            </span>
          )}
        </div>
        <div
          aria-label={t('desktopPet.activityCounters')}
          className="pet-activity-bar"
          style={{
            width: '100%',
            height: PET_STATS_HEIGHT,
            boxSizing: 'border-box',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 30px',
            alignItems: 'center',
            gap: 4,
            padding: '3px 4px 3px 8px',
            border: '2px solid #f4c542',
            borderRadius: 6,
            background: 'rgba(22, 25, 34, 0.92)',
            color: '#ffffff',
            fontFamily: petUiFontFamily,
            fontSize: 8,
            lineHeight: 1.35,
            textAlign: 'center',
            cursor: 'default'
          }}
        >
          <span>{t('desktopPet.clicks')} {save?.activity.clicks.toLocaleString() ?? '0'}</span>
          <span>{t('desktopPet.typing')} {save?.activity.keystrokes.toLocaleString() ?? '0'}</span>
          <button
            type="button"
            className={`pet-menu-toggle${menuOpen ? ' pet-menu-toggle--active' : ''}`}
            aria-label={menuOpen ? t('desktopPet.closeMenu') : t('desktopPet.openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              width: 26,
              height: 24,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              border: '2px solid #f4c542',
              borderRadius: 3,
              background: menuOpen ? '#f4c542' : '#30343f',
              color: menuOpen ? '#222631' : '#ffffff',
              fontFamily: 'monospace',
              fontSize: 18,
              fontWeight: 900,
              lineHeight: 1,
              cursor: 'pointer'
            }}
          >
            ☰
          </button>
        </div>
      </div>
      {menuOpen && (
        <aside
          aria-label={t('desktopPet.settings')}
          className="pet-settings-panel"
          style={{
            width: PET_MENU_WIDTH,
            height: menuHeight,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            border: '3px solid #c9655d',
            borderRadius: 6,
            background: 'linear-gradient(180deg, #df8c7c 0%, #efc18b 100%)',
            color: '#3a2928',
            fontFamily: petUiFontFamily,
            cursor: 'default'
          }}
        >
          <div
            className="pet-settings-heading"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 10
            }}
          >
            <strong>{t('desktopPet.scale')}</strong>
            <span>{petScale.toFixed(1)}x</span>
          </div>
          <input
            className="pet-scale-slider"
            aria-label={t('desktopPet.scale')}
            type="range"
            min={PET_SCALE_MIN}
            max={PET_SCALE_MAX}
            step="0.1"
            value={petScale}
            onChange={(event) => setPetScale(Number(event.target.value))}
            style={{
              width: '100%',
              accentColor: '#a94f49',
              cursor: 'pointer'
            }}
          />
          <small className="pet-settings-hint">
            {t('desktopPet.scaleHint')}
          </small>
          <div className="pet-setting-divider" />
          <label className="pet-setting-label" htmlFor="pet-bubble-font-size">
            <strong>{t('desktopPet.fontSize')}</strong>
            <span>{bubbleFontSize}px</span>
          </label>
          <input
            id="pet-bubble-font-size"
            className="pet-scale-slider"
            aria-label={t('desktopPet.fontSize')}
            type="range"
            min={PET_FONT_SIZE_MIN}
            max={PET_FONT_SIZE_MAX}
            step="1"
            value={bubbleFontSize}
            onChange={(event) => setBubbleFontSize(Number(event.target.value))}
          />
          <div className="pet-setting-divider" />
          <div className="pet-settings-heading" style={{ fontSize: 10 }}>
            <strong>{t('audio.sound')}</strong>
          </div>
          <AudioMuteButton variant="pet" />
        </aside>
      )}
    </div>
  )
}
