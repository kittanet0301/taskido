import { useEffect, useRef } from 'react'
import type { Gender, Stage } from '../../shared/types'
import { playSfx } from '../../shared/audio'
import { petPreviewColor } from '../../shared/constants'
import { normalizePetSpecies } from '../../shared/creatureCharacters'
import {
  DINO_BOB_PERIOD,
  DINO_FRAMES_PER_SPRITE_FRAME
} from '../../shared/dinoTiming'
import {
  drawPetSpriteFrame,
  loadPetSprite,
  lobbyDisplaySizeForPet,
  petSpriteUrl,
  preloadPetSprites,
  setupCrispCanvas,
  type PetSpriteFolder
} from '../../shared/petSprites'
import { drawLobbyBackground } from './lobbyBackgrounds'
import {
  createPhysicsState,
  resetPhysicsSpawn,
  tickPhysics,
  type LobbyInput,
  type PhysicsState
} from './lobbyPhysics'
import { pruneBubbles, upsertBubble } from './speechBubbles'
import type { ChatRoomMember, ChatRoomMessage, LobbyEntity } from './types'
import { parseLobbyAnim } from './types'
import { flipXForFacing } from '../../shared/dinoAnim'

const CANVAS_W = 960
const CANVAS_H = 480
const LERP = 0.18
const SYNC_MS = 150

const PET_CLIPS = [
  { folder: 'base' as const, clip: 'idle' },
  { folder: 'base' as const, clip: 'move' },
  { folder: 'base' as const, clip: 'jump' },
  { folder: 'base' as const, clip: 'dash' },
  { folder: 'base' as const, clip: 'bite' }
]

interface Props {
  roomId: string
  roomSlug: string
  userId: string
  members: ChatRoomMember[]
  onPositionSync: (pos: { x: number; y: number; facing: string; anim: string }) => void
  incomingMessage: ChatRoomMessage | null
}

function memberToEntity(m: ChatRoomMember, isSelf: boolean): LobbyEntity {
  return {
    userId: m.user_id,
    username: m.username,
    character: normalizePetSpecies(m.pet_character),
    gender: m.gender as Gender,
    stage: (m.stage === 'egg' || m.stage === 'baby' ? m.stage : 'adult') as Stage,
    x: m.x,
    y: m.y,
    facing: m.facing === 'left' ? 'left' : 'right',
    anim: parseLobbyAnim(m.anim),
    isSelf
  }
}

function resolveLobbyClip(entity: LobbyEntity): {
  folder: PetSpriteFolder
  clip: string
  flipX: boolean
} {
  const flipX = flipXForFacing(entity.facing)
  if (entity.stage === 'egg') {
    return { folder: 'egg', clip: 'move', flipX: false }
  }
  if (entity.anim === 'jump') return { folder: 'base', clip: 'jump', flipX }
  if (entity.anim === 'dash') return { folder: 'base', clip: 'dash', flipX }
  if (entity.anim === 'bite') return { folder: 'base', clip: 'bite', flipX }
  if (entity.anim === 'walk') return { folder: 'base', clip: 'move', flipX }
  return { folder: 'base', clip: 'idle', flipX }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  username: string
): void {
  const padX = 14
  const padY = 10
  const nameH = 18
  const lineH = 18
  const maxTextW = 210
  const radius = 14
  const tailH = 10

  ctx.font = '14px "Mali", "Noto Sans Thai", sans-serif'
  const lines = wrapText(ctx, text, maxTextW)
  ctx.font = 'bold 13px "Mali", "Noto Sans Thai", sans-serif'
  const nameW = ctx.measureText(username).width
  ctx.font = '14px "Mali", "Noto Sans Thai", sans-serif'
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 0)

  const w = Math.min(240, Math.max(100, nameW, textW) + padX * 2)
  const bodyH = padY + nameH + 6 + lines.length * lineH + padY
  const h = bodyH
  const left = Math.round(x - w / 2)
  const top = Math.round(y - h - tailH - 6)

  // shadow
  ctx.save()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.14)'
  ctx.beginPath()
  ctx.roundRect(left + 2, top + 3, w, h, radius)
  ctx.fill()
  ctx.restore()

  // bubble body
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(200, 112, 80, 0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(left, top, w, h, radius)
  ctx.fill()
  ctx.stroke()

  // username pill
  const pillPadX = 8
  const pillH = 18
  const pillW = Math.min(w - padX * 2, nameW + pillPadX * 2)
  const pillX = left + (w - pillW) / 2
  const pillY = top + padY
  ctx.fillStyle = 'rgba(255, 176, 124, 0.12)'
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, 9)
  ctx.fill()

  // tail
  const tailTop = top + h
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(200, 112, 80, 0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 7, tailTop - 1)
  ctx.lineTo(x, tailTop + tailH)
  ctx.lineTo(x + 7, tailTop - 1)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // cover top edge of tail so it blends with bubble
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 6, tailTop - 2, 12, 3)

  // username
  ctx.fillStyle = '#4f46e5'
  ctx.font = 'bold 13px "Mali", "Noto Sans Thai", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(username, x, pillY + pillH / 2)

  // message
  ctx.fillStyle = '#1f2937'
  ctx.font = '14px "Mali", "Noto Sans Thai", sans-serif'
  ctx.textBaseline = 'top'
  const textTop = top + padY + nameH + 8
  lines.forEach((line, i) => {
    ctx.fillText(line, x, textTop + i * lineH)
  })
}

export function LobbyCanvas({ roomId, roomSlug, userId, members, onPositionSync, incomingMessage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const physicsRef = useRef<PhysicsState>(createPhysicsState())
  const inputRef = useRef<LobbyInput>({ move: 0, jump: false, dash: false, greet: false })
  const jumpQueuedRef = useRef(false)
  const greetQueuedRef = useRef(false)
  const displayRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const bubblesRef = useRef<Map<string, import('./types').SpeechBubble>>(new Map())
  const spriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const lastSyncRef = useRef(0)
  const prevAnimRef = useRef<string>('idle')
  const membersRef = useRef(members)
  const onSyncRef = useRef(onPositionSync)

  membersRef.current = members
  onSyncRef.current = onPositionSync

  useEffect(() => {
    physicsRef.current = resetPhysicsSpawn(createPhysicsState())
    displayRef.current.clear()
    frameRef.current = 0
    const phys = physicsRef.current
    onSyncRef.current({
      x: phys.x,
      y: phys.y,
      facing: phys.facing,
      anim: phys.anim
    })
  }, [roomId, userId])

  useEffect(() => {
    if (!incomingMessage) return
    bubblesRef.current = upsertBubble(
      bubblesRef.current,
      incomingMessage.sender_id,
      incomingMessage.content
    )
  }, [incomingMessage])

  useEffect(() => {
    const urls = members.flatMap((m) => {
      const pet = {
        character: normalizePetSpecies(m.pet_character),
        gender: m.gender as Gender,
        stage: (m.stage === 'egg' || m.stage === 'baby' ? m.stage : 'adult') as Stage
      }
      if (m.stage === 'egg') {
        return ['move', 'hatch'].map((clip) => petSpriteUrl(pet, 'egg', clip))
      }
      return PET_CLIPS.map(({ folder, clip }) => petSpriteUrl(pet, folder, clip))
    })
    void preloadPetSprites(urls)
  }, [members])

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    }

    const held = { left: false, right: false, shift: false }

    const isMoveLeft = (e: KeyboardEvent) =>
      e.code === 'KeyA' || e.key === 'a' || e.key === 'A' || e.key === 'ฟ'

    const isMoveRight = (e: KeyboardEvent) =>
      e.code === 'KeyD' || e.key === 'd' || e.key === 'D' || e.key === 'ก'

    const syncInput = () => {
      inputRef.current.move = held.left && !held.right ? -1 : held.right && !held.left ? 1 : 0
      inputRef.current.dash = held.shift
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping()) return
      if (isMoveLeft(e)) {
        held.left = true
        syncInput()
        e.preventDefault()
      }
      if (isMoveRight(e)) {
        held.right = true
        syncInput()
        e.preventDefault()
      }
      if (e.key === 'Shift') {
        held.shift = true
        syncInput()
      }
      if (e.key === ' ' && !e.repeat) {
        jumpQueuedRef.current = true
        e.preventDefault()
      }
      if ((e.key === 'e' || e.key === 'E') && !e.repeat) {
        greetQueuedRef.current = true
        e.preventDefault()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (isMoveLeft(e)) {
        held.left = false
        syncInput()
      }
      if (isMoveRight(e)) {
        held.right = false
        syncInput()
      }
      if (e.key === 'Shift') {
        held.shift = false
        syncInput()
      }
    }

    const resetInput = () => {
      held.left = false
      held.right = false
      held.shift = false
      inputRef.current = { move: 0, jump: false, dash: false, greet: false }
      jumpQueuedRef.current = false
      greetQueuedRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', resetInput)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', resetInput)
      resetInput()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupCrispCanvas(canvas, CANVAS_W, CANVAS_H, false)
    ctx.imageSmoothingEnabled = false

    let raf = 0
    const tick = async () => {
      frameRef.current++
      const frame = frameRef.current
      const now = performance.now()

      const input: LobbyInput = {
        move: inputRef.current.move,
        jump: jumpQueuedRef.current,
        dash: inputRef.current.dash,
        greet: greetQueuedRef.current
      }
      jumpQueuedRef.current = false
      greetQueuedRef.current = false

      physicsRef.current = tickPhysics(physicsRef.current, frame, input)
      const phys = physicsRef.current
      if (phys.anim !== prevAnimRef.current) {
        if (phys.anim === 'dash') playSfx('chat_dash')
        if (phys.anim === 'bite') playSfx('chat_bite')
        prevAnimRef.current = phys.anim
      }

      if (now - lastSyncRef.current >= SYNC_MS) {
        lastSyncRef.current = now
        onSyncRef.current({
          x: phys.x,
          y: phys.y,
          facing: phys.facing,
          anim: phys.anim
        })
      }

      bubblesRef.current = pruneBubbles(bubblesRef.current)

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      drawLobbyBackground(ctx, roomSlug, CANVAS_W, CANVAS_H, frame)

      const entities: LobbyEntity[] = membersRef.current.map((m) => {
        if (m.user_id !== userId) return memberToEntity(m, false)
        return memberToEntity(
          { ...m, x: phys.x, y: phys.y, facing: phys.facing, anim: phys.anim },
          true
        )
      })

      for (const entity of entities) {
        let px: number
        let py: number

        if (entity.isSelf) {
          px = entity.x * CANVAS_W
          py = entity.y * CANVAS_H
        } else {
          const disp = displayRef.current.get(entity.userId) ?? { x: entity.x, y: entity.y }
          const nx = disp.x + (entity.x - disp.x) * LERP
          const ny = disp.y + (entity.y - disp.y) * LERP
          displayRef.current.set(entity.userId, { x: nx, y: ny })
          px = nx * CANVAS_W
          py = ny * CANVAS_H
        }

        const clip = resolveLobbyClip(entity)

        const url = petSpriteUrl(
          { character: entity.character, gender: entity.gender, stage: entity.stage },
          clip.folder,
          clip.clip
        )
        let img = spriteCacheRef.current.get(url)
        if (!img) {
          try {
            img = await loadPetSprite(url)
            spriteCacheRef.current.set(url, img)
          } catch {
            img = undefined
          }
        }

        const bob = Math.round(Math.sin(frame / DINO_BOB_PERIOD) * 2)
        const drawSize = lobbyDisplaySizeForPet({
          character: entity.character,
          stage: entity.stage
        })

        if (img) {
          drawPetSpriteFrame(ctx, img, Math.floor(frame / DINO_FRAMES_PER_SPRITE_FRAME), entity.character, {
            x: Math.round(px),
            y: Math.round(py + bob),
            drawSize,
            flipX: clip.flipX
          })
        } else {
          ctx.fillStyle = petPreviewColor(entity.character)
          ctx.beginPath()
          ctx.arc(Math.round(px), Math.round(py + bob), drawSize / 3, 0, Math.PI * 2)
          ctx.fill()
        }

        const bubble = bubblesRef.current.get(entity.userId)
        if (bubble) {
          drawBubble(ctx, px, py - drawSize / 2 - 12, bubble.content, entity.username)
        }
      }

      raf = requestAnimationFrame(tick)
    }

    tick()
    return () => cancelAnimationFrame(raf)
  }, [roomId, roomSlug, userId])

  return (
    <canvas
      ref={canvasRef}
      className="chat-lobby-canvas dino-sprite-canvas"
      tabIndex={0}
      aria-label="Chat lobby"
    />
  )
}
