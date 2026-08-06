import { useEffect, useRef } from 'react'
import type { GameSave, Stage } from '../../../shared/types'
import { playSfx } from '../../../shared/audio'
import { petPreviewColor } from '../../../shared/constants'
import { flipXForFacing } from '../../../shared/dinoAnim'
import { isCreatureSpecies } from '../../../shared/creatureCharacters'
import { DINO_FRAMES_PER_SPRITE_FRAME } from '../../../shared/dinoTiming'
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
  createJumpState,
  DINO_H,
  DINO_W,
  DINO_X,
  EMPTY_JUMP_INPUT,
  GROUND_Y,
  getScore,
  tickJumpState,
  type JumpInput,
  type JumpState
} from './dinoJumpPhysics'

interface Props {
  save: GameSave
  running: boolean
  onDistanceChange: (distanceRan: number, score: number) => void
  onGameOver: (score: number) => void
}

function jumpClipsForPet(stage: Stage) {
  if (stage === 'egg') {
    return [{ folder: 'egg' as PetSpriteFolder, clip: 'move' }]
  }
  return [
    { folder: 'base' as PetSpriteFolder, clip: 'move' },
    { folder: 'base' as PetSpriteFolder, clip: 'jump' }
  ]
}

export function DinoJumpCanvas({ save, running, onDistanceChange, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<JumpState>(createJumpState())
  const jumpInputRef = useRef<JumpInput>({ ...EMPTY_JUMP_INPUT })
  const jumpHeldRef = useRef(false)
  const frameRef = useRef(0)
  const reportedOverRef = useRef(false)
  const onDistanceChangeRef = useRef(onDistanceChange)
  const onGameOverRef = useRef(onGameOver)
  const spriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  onDistanceChangeRef.current = onDistanceChange
  onGameOverRef.current = onGameOver

  useEffect(() => {
    if (running) {
      stateRef.current = createJumpState()
      jumpInputRef.current = { ...EMPTY_JUMP_INPUT }
      jumpHeldRef.current = false
      frameRef.current = 0
      reportedOverRef.current = false
      spriteCacheRef.current.clear()
    }
  }, [running])

  const queueJumpPress = () => {
    jumpInputRef.current.jumpPressed = true
    jumpInputRef.current.jumpHeld = true
    jumpHeldRef.current = true
  }

  const queueJumpRelease = () => {
    if (!jumpHeldRef.current) return
    jumpInputRef.current.jumpHeld = false
    jumpInputRef.current.jumpReleased = true
    jumpHeldRef.current = false
  }

  useEffect(() => {
    if (!running) return

    const isJumpKey = (key: string) => key === ' ' || key === 'ArrowUp'

    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (isJumpKey(e.key)) {
        queueJumpPress()
        e.preventDefault()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (isJumpKey(e.key)) {
        queueJumpRelease()
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      queueJumpRelease()
    }
  }, [running])

  useEffect(() => {
    const pet = save.pet
    if (!pet) return
    const urls = jumpClipsForPet(pet.stage).map(({ folder, clip }) => petSpriteUrl(pet, folder, clip))
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
      const input = jumpInputRef.current
      const prev = stateRef.current
      stateRef.current = tickJumpState(stateRef.current, input)
      jumpInputRef.current = {
        jumpPressed: false,
        jumpHeld: jumpHeldRef.current,
        jumpReleased: false
      }
      const state = stateRef.current
      if (input.jumpPressed && state.jumping && !prev.jumping) playSfx('jump')
      if (state.grounded && prev.jumping && !state.jumping) playSfx('land')
      if (state.dead && !prev.dead) playSfx('minigame_hit')
      const score = getScore(state.distanceRan)
      onDistanceChangeRef.current(state.distanceRan, score)

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      sky.addColorStop(0, '#8fd3ff')
      sky.addColorStop(1, '#dff6ff')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      const groundScroll = state.distanceRan % 48
      ctx.fillStyle = '#6db04f'
      ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y)
      ctx.fillStyle = '#4f8f38'
      for (let x = -groundScroll; x < CANVAS_W; x += 48) {
        ctx.fillRect(x, GROUND_Y + 18, 24, 6)
      }

      ctx.fillStyle = '#5a3824'
      for (const obstacle of state.obstacles) {
        const top = GROUND_Y - obstacle.h
        ctx.fillRect(obstacle.x, top, obstacle.w, obstacle.h)
        ctx.fillStyle = '#7a4f2f'
        ctx.fillRect(obstacle.x + 4, top + 4, obstacle.w - 8, 8)
        ctx.fillStyle = '#5a3824'
      }

      if (pet) {
        const drawSize = minigameJumpDisplaySizeForPet(pet)
        const spriteX = DINO_X + DINO_W / 2
        const spriteY =
          state.dinoY + DINO_H - drawSize / 2 + drawSize * MINIGAME_SPRITE_GROUND_OFFSET_RATIO
        const useJump = !state.grounded && pet.stage !== 'egg'
        const folder: PetSpriteFolder = pet.stage === 'egg' ? 'egg' : 'base'
        const clip = useJump ? 'jump' : 'move'
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
          const spriteFrame = spriteFrameIndexForClip(
            clip,
            frameRef.current,
            img,
            pet.character
          )
          drawPetSpriteFrame(ctx, img, spriteFrame, pet.character, {
            x: spriteX,
            y: Math.round(spriteY),
            drawSize,
            flipX: isCreatureSpecies(pet.character) ? flipXForFacing('right') : false
          })
        } else {
          ctx.fillStyle = petPreviewColor(pet.character)
          ctx.fillRect(DINO_X, state.dinoY, DINO_W, DINO_H)
        }
      } else {
        ctx.fillStyle = '#e8789a'
        ctx.fillRect(DINO_X, state.dinoY, DINO_W, DINO_H)
      }

      ctx.fillStyle = '#535353'
      ctx.font = 'bold 14px "Press Start 2P", "Mali", monospace'
      ctx.textAlign = 'right'
      const scoreText = String(score).padStart(5, '0')
      ctx.fillText(scoreText, CANVAS_W - 16, 28)

      if (state.dead && !reportedOverRef.current) {
        reportedOverRef.current = true
        playSfx('minigame_over')
        onGameOverRef.current(score)
      }

      raf = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(raf)
  }, [running, save.pet])

  return (
    <canvas
      ref={canvasRef}
      className="minigame-canvas dino-sprite-canvas"
      width={CANVAS_W}
      height={CANVAS_H}
      onPointerDown={() => {
        if (running) queueJumpPress()
      }}
      onPointerUp={() => {
        if (running) queueJumpRelease()
      }}
      onPointerLeave={() => {
        if (running) queueJumpRelease()
      }}
      aria-label="Dino jump mini-game"
    />
  )
}
