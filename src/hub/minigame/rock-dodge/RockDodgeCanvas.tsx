import { useEffect, useRef } from 'react'
import type { GameSave, Stage } from '../../../shared/types'
import { playSfx } from '../../../shared/audio'
import { petPreviewColor } from '../../../shared/constants'
import { flipXForFacing } from '../../../shared/dinoAnim'
import { isCreatureSpecies } from '../../../shared/creatureCharacters'
import {
  drawPetSpriteFrame,
  loadPetSprite,
  minigameJumpDisplaySizeForPet,
  MINIGAME_SPRITE_GROUND_OFFSET_RATIO,
  petSpriteUrl,
  preloadPetSprites,
  setupCrispCanvas,
  spriteFrameIndexForClip,
  type PetSpriteFolder
} from '../../../shared/petSprites'
import {
  CANVAS_H,
  CANVAS_W,
  createDodgeState,
  EGG_GOAL,
  EMPTY_DODGE_INPUT,
  GROUND_Y,
  PLAYER_H,
  PLAYER_W,
  PLAYER_Y,
  tickDodgeState,
  type DodgeInput,
  type DodgeState,
  type FallingEgg,
  type Rock
} from './rockDodgePhysics'

interface Props {
  save: GameSave
  running: boolean
  onScoreChange: (survival: number, score: number) => void
  onGameOver: (score: number) => void
}

function dodgeClipsForPet(stage: Stage) {
  if (stage === 'egg') {
    return [{ folder: 'egg' as PetSpriteFolder, clip: 'move' }]
  }
  return [
    { folder: 'base' as PetSpriteFolder, clip: 'idle' },
    { folder: 'base' as PetSpriteFolder, clip: 'move' }
  ]
}

function drawRock(ctx: CanvasRenderingContext2D, rock: Rock) {
  if (rock.kind === 'branch') {
    ctx.fillStyle = '#6b4423'
    ctx.fillRect(rock.x, rock.y + rock.h * 0.35, rock.w, rock.h * 0.3)
    ctx.fillStyle = '#8a5a2b'
    ctx.fillRect(rock.x + 4, rock.y + 2, rock.w * 0.35, rock.h * 0.45)
    ctx.fillRect(rock.x + rock.w * 0.55, rock.y + rock.h * 0.4, rock.w * 0.35, rock.h * 0.45)
    return
  }
  if (rock.kind === 'trash') {
    ctx.fillStyle = '#7a8a9a'
    ctx.fillRect(rock.x + 2, rock.y + 4, rock.w - 4, rock.h - 6)
    ctx.fillStyle = '#c45c3a'
    ctx.fillRect(rock.x, rock.y, rock.w, 8)
    ctx.fillStyle = '#9aa8b5'
    ctx.fillRect(rock.x + 6, rock.y + 12, rock.w - 12, 6)
    return
  }
  ctx.fillStyle = '#6a6a6a'
  ctx.beginPath()
  ctx.moveTo(rock.x + rock.w * 0.2, rock.y + rock.h)
  ctx.lineTo(rock.x, rock.y + rock.h * 0.55)
  ctx.lineTo(rock.x + rock.w * 0.25, rock.y)
  ctx.lineTo(rock.x + rock.w * 0.75, rock.y + 2)
  ctx.lineTo(rock.x + rock.w, rock.y + rock.h * 0.5)
  ctx.lineTo(rock.x + rock.w * 0.8, rock.y + rock.h)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(rock.x + rock.w * 0.3, rock.y + rock.h * 0.25, rock.w * 0.28, rock.h * 0.22)
}

function drawEgg(ctx: CanvasRenderingContext2D, egg: FallingEgg) {
  const centerX = egg.x + egg.w / 2
  const centerY = egg.y + egg.h / 2
  ctx.fillStyle = '#fff5cf'
  ctx.strokeStyle = '#d89b45'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(centerX, centerY + 2, egg.w * 0.42, egg.h * 0.46, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.ellipse(centerX - 5, centerY - 6, 4, 7, -0.35, 0, Math.PI * 2)
  ctx.fill()
}

export function RockDodgeCanvas({ save, running, onScoreChange, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<DodgeState>(createDodgeState())
  const inputRef = useRef<DodgeInput>({ ...EMPTY_DODGE_INPUT })
  const keysRef = useRef({ left: false, right: false })
  const touchSideRef = useRef<-1 | 0 | 1>(0)
  const facingRef = useRef<'left' | 'right'>('right')
  const frameRef = useRef(0)
  const reportedOverRef = useRef(false)
  const onScoreChangeRef = useRef(onScoreChange)
  const onGameOverRef = useRef(onGameOver)
  const spriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  onScoreChangeRef.current = onScoreChange
  onGameOverRef.current = onGameOver

  const syncMoveInput = () => {
    const { left, right } = keysRef.current
    if (touchSideRef.current !== 0) {
      inputRef.current = { move: touchSideRef.current }
      return
    }
    if (left && !right) inputRef.current = { move: -1 }
    else if (right && !left) inputRef.current = { move: 1 }
    else inputRef.current = { move: 0 }
  }

  useEffect(() => {
    if (running) {
      stateRef.current = createDodgeState()
      inputRef.current = { ...EMPTY_DODGE_INPUT }
      keysRef.current = { left: false, right: false }
      touchSideRef.current = 0
      facingRef.current = 'right'
      frameRef.current = 0
      reportedOverRef.current = false
      spriteCacheRef.current.clear()
    }
  }, [running])

  useEffect(() => {
    if (!running) return

    const isLeft = (key: string) => key === 'ArrowLeft' || key === 'a' || key === 'A'
    const isRight = (key: string) => key === 'ArrowRight' || key === 'd' || key === 'D'

    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (isLeft(e.key)) {
        keysRef.current.left = true
        syncMoveInput()
        e.preventDefault()
      } else if (isRight(e.key)) {
        keysRef.current.right = true
        syncMoveInput()
        e.preventDefault()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (isLeft(e.key)) {
        keysRef.current.left = false
        syncMoveInput()
        e.preventDefault()
      } else if (isRight(e.key)) {
        keysRef.current.right = false
        syncMoveInput()
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keysRef.current = { left: false, right: false }
      touchSideRef.current = 0
      inputRef.current = { ...EMPTY_DODGE_INPUT }
    }
  }, [running])

  useEffect(() => {
    const pet = save.pet
    if (!pet) return
    const urls = dodgeClipsForPet(pet.stage).map(({ folder, clip }) => petSpriteUrl(pet, folder, clip))
    void preloadPetSprites(urls)
  }, [save.pet?.gender, save.pet?.character, save.pet?.stage])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !running) return

    const pet = save.pet
    const ctx = setupCrispCanvas(canvas, CANVAS_W, CANVAS_H, false)
    ctx.imageSmoothingEnabled = false

    let raf = 0
    const tick = async () => {
      frameRef.current += 1
      const input = inputRef.current
      const prev = stateRef.current
      stateRef.current = tickDodgeState(stateRef.current, input)
      const state = stateRef.current
      if (state.eggsCollected > prev.eggsCollected) playSfx('collect')
      if (state.dead && !prev.dead) playSfx('minigame_hit')
      if (input.move === -1) facingRef.current = 'left'
      else if (input.move === 1) facingRef.current = 'right'

      const score = state.eggsCollected
      onScoreChangeRef.current(state.survival, score)

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      sky.addColorStop(0, '#9ec8ef')
      sky.addColorStop(1, '#e8f4ff')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      ctx.fillStyle = '#6db04f'
      ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y)
      ctx.fillStyle = '#4f8f38'
      for (let x = 0; x < CANVAS_W; x += 48) {
        ctx.fillRect(x, GROUND_Y + 18, 24, 6)
      }

      for (const egg of state.eggs) {
        drawEgg(ctx, egg)
      }
      for (const rock of state.rocks) {
        drawRock(ctx, rock)
      }

      if (pet) {
        const moving = input.move !== 0
        const drawSize = minigameJumpDisplaySizeForPet(pet)
        const spriteX = state.playerX + PLAYER_W / 2
        const spriteY =
          PLAYER_Y + PLAYER_H - drawSize / 2 + drawSize * MINIGAME_SPRITE_GROUND_OFFSET_RATIO
        const folder: PetSpriteFolder = pet.stage === 'egg' ? 'egg' : 'base'
        const clip = moving || pet.stage === 'egg' ? 'move' : 'idle'
        const url = petSpriteUrl(pet, folder, clip)

        let img = spriteCacheRef.current.get(url)
        if (!img) {
          try {
            img = await loadPetSprite(url)
            spriteCacheRef.current.set(url, img)
          } catch {
            img = undefined
          }
        }

        if (img) {
          const spriteFrame = spriteFrameIndexForClip(clip, frameRef.current, img, pet.character)
          drawPetSpriteFrame(ctx, img, spriteFrame, pet.character, {
            x: spriteX,
            y: Math.round(spriteY),
            drawSize,
            flipX: isCreatureSpecies(pet.character)
              ? flipXForFacing(facingRef.current)
              : facingRef.current === 'right'
          })
        } else {
          ctx.fillStyle = petPreviewColor(pet.character)
          ctx.fillRect(state.playerX, PLAYER_Y, PLAYER_W, PLAYER_H)
        }
      } else {
        ctx.fillStyle = '#e8789a'
        ctx.fillRect(state.playerX, PLAYER_Y, PLAYER_W, PLAYER_H)
      }

      ctx.fillStyle = '#fff5cf'
      ctx.strokeStyle = '#d89b45'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(CANVAS_W - 116, 22, 8, 11, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#535353'
      ctx.font = 'bold 14px "Press Start 2P", "Mali", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${String(score).padStart(3, '0')} / ${EGG_GOAL}`, CANVAS_W - 16, 28)

      if ((state.dead || state.won) && !reportedOverRef.current) {
        reportedOverRef.current = true
        playSfx('minigame_over')
        onGameOverRef.current(score)
      }

      raf = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(raf)
  }, [running, save.pet])

  const setTouchFromEvent = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const localX = clientX - rect.left
    touchSideRef.current = localX < rect.width / 2 ? -1 : 1
    syncMoveInput()
  }

  const clearTouch = () => {
    touchSideRef.current = 0
    syncMoveInput()
  }

  return (
    <canvas
      ref={canvasRef}
      className="minigame-canvas dino-sprite-canvas"
      width={CANVAS_W}
      height={CANVAS_H}
      onPointerDown={(e) => {
        if (!running) return
        canvasRef.current?.setPointerCapture(e.pointerId)
        setTouchFromEvent(e.clientX)
      }}
      onPointerMove={(e) => {
        if (!running || touchSideRef.current === 0) return
        setTouchFromEvent(e.clientX)
      }}
      onPointerUp={clearTouch}
      onPointerCancel={clearTouch}
      onPointerLeave={clearTouch}
      aria-label="Rock dodge mini-game"
    />
  )
}
