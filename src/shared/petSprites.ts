import type { PetData, Stage } from './types'
import {
  CREATURE_FRAME_SIZE,
  CREATURE_PIXEL_SCALE,
  creatureDisplaySize,
  creatureAssetBase,
  creatureRenderStage
} from './creatureCharacters'
import { creatureMaxFrameSize } from './creatureFrameManifest'
import {
  DINO_FRAMES_PER_SPRITE_FRAME,
  DINO_HATCH_FRAMES_PER_SPRITE_FRAME,
  DINO_HATCH_POST_DELAY_TICKS,
  hatchWaitMsForFrameCount
} from './dinoTiming'

/**
 * `base` remains a renderer-level alias for the pet's current body stage.
 * It no longer maps to a separate third-party asset folder.
 */
export type PetSpriteFolder = 'base' | 'egg' | 'baby' | 'adult'

const imageCache = new Map<string, HTMLImageElement | Promise<HTMLImageElement>>()

export function frameSizeFromStrip(img: HTMLImageElement, _species?: string): number {
  return img.height > 0 ? img.height : CREATURE_FRAME_SIZE
}

export function frameSizeForPet(pet: Pick<PetData, 'character' | 'stage'>): number {
  return creatureMaxFrameSize(pet.character, creatureRenderStage(pet.stage))
}

export function frameCountFromImage(img: HTMLImageElement, species?: string): number {
  const frameSize = frameSizeFromStrip(img, species)
  return Math.max(1, Math.floor(img.width / frameSize))
}

export function expectedHatchFrameCount(_species?: string): number {
  return 6
}

/** UI wait: hatch animation + post-hatch hold on the final frame. */
export function hatchAnimMsForSpecies(species?: string): number {
  return hatchWaitMsForFrameCount(expectedHatchFrameCount(species))
}

/** Wait until hatch RAF completes; falls back to timing if the callback never fires. */
export function waitForHatchAnimation(
  species: string,
  onSubscribe: (notifyComplete: () => void) => void
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    onSubscribe(finish)
    window.setTimeout(finish, hatchAnimMsForSpecies(species) + 250)
  })
}

/** Hatch plays once (no loop); other clips loop normally. */
export function spriteFrameIndexForClip(
  clip: string,
  tick: number,
  img: HTMLImageElement,
  species?: string
): number {
  const frameCount = frameCountFromImage(img, species)
  if (clip === 'hatch') {
    const index = Math.floor(tick / DINO_HATCH_FRAMES_PER_SPRITE_FRAME)
    return Math.min(index, frameCount - 1)
  }
  const index = Math.floor(tick / DINO_FRAMES_PER_SPRITE_FRAME)
  return ((index % frameCount) + frameCount) % frameCount
}

/** True once hatch playback and post-hatch hold have finished (RAF-synced). */
export function isHatchAnimationComplete(
  tick: number,
  frameCount: number,
  ticksPerFrame: number = DINO_HATCH_FRAMES_PER_SPRITE_FRAME,
  postDelayTicks: number = DINO_HATCH_POST_DELAY_TICKS
): boolean {
  return tick >= frameCount * ticksPerFrame + postDelayTicks
}

/** Shared pixel-art scale; every live pet now uses the creature pipeline. */
export function pixelScaleForPet(_pet: Pick<PetData, 'character' | 'stage'>): number {
  return CREATURE_PIXEL_SCALE
}

/** Scale to fit a custom canvas without clipping. */
export function pixelScaleForCanvas(
  pet: Pick<PetData, 'character' | 'stage'>,
  _canvasSize: number
): number {
  return creatureDisplaySize(pet.stage) / frameSizeForPet(pet)
}

const CREATURE_BOB_PADDING = 8

/** Hub canvas inset from bottom edge to drawn feet (matches DinoSprite feetAnchored). */
export const HUB_PET_FEET_BOTTOM_INSET = 4

export { CREATURE_BOB_PADDING }

/** Canvas includes bob room so the scaled creature is not clipped. */
export function resolveSpriteRenderSize(
  pet: Pick<PetData, 'character' | 'stage'>,
  requestedSize?: number
): { canvasSize: number; pixelScale: number; drawSize: number } {
  const frameSize = frameSizeForPet(pet)
  const drawSize = requestedSize ?? creatureDisplaySize(pet.stage)
  return {
    canvasSize: drawSize + CREATURE_BOB_PADDING,
    pixelScale: drawSize / frameSize,
    drawSize
  }
}

export function displaySizeForPet(pet: Pick<PetData, 'character' | 'stage'>): number {
  return creatureDisplaySize(pet.stage)
}

/** On-screen sprite size in the chat lobby — adult is 2× baby/egg. */
export const LOBBY_SPRITE_BABY = 96
export const LOBBY_SPRITE_ADULT = LOBBY_SPRITE_BABY * 2

export function lobbyDisplaySizeForPet(pet: Pick<PetData, 'character' | 'stage'>): number {
  return pet.stage === 'adult' ? LOBBY_SPRITE_ADULT : LOBBY_SPRITE_BABY
}

/** Minigame display size; collision continues to use the smaller physics hitbox. */
export const MINIGAME_JUMP_SPRITE_BABY = 60
export const MINIGAME_JUMP_SPRITE_ADULT = MINIGAME_JUMP_SPRITE_BABY * 2
/** Transparent padding below the creature's feet inside each square sprite frame. */
export const MINIGAME_SPRITE_GROUND_OFFSET_RATIO = 1 / 8

export function minigameJumpDisplaySizeForPet(
  pet: Pick<PetData, 'character' | 'stage'>
): number {
  return pet.stage === 'adult' ? MINIGAME_JUMP_SPRITE_ADULT : MINIGAME_JUMP_SPRITE_BABY
}

function stageFolderForRequest(
  stage: Stage,
  folder: PetSpriteFolder
): 'egg' | 'baby' | 'adult' {
  if (folder === 'egg') return 'egg'
  if (folder === 'baby' || folder === 'adult') return folder
  return creatureRenderStage(stage)
}

export function petSpriteUrl(
  pet: Pick<PetData, 'character' | 'stage'>,
  folder: PetSpriteFolder,
  clip: string
): string {
  return creatureAssetBase(
    pet.character,
    stageFolderForRequest(pet.stage, folder),
    clip
  )
}

export function setupCrispCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight?: number,
  cssSized = true
): CanvasRenderingContext2D {
  const logicalH = logicalHeight ?? logicalWidth
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(logicalWidth * dpr)
  canvas.height = Math.round(logicalH * dpr)
  if (cssSized) {
    canvas.style.width = `${logicalWidth}px`
    canvas.style.height = `${logicalH}px`
  } else {
    canvas.style.width = ''
    canvas.style.height = ''
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
  return ctx
}

export function loadPetSprite(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url)
  if (cached instanceof HTMLImageElement) return Promise.resolve(cached)
  if (cached) return cached

  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(url, img)
      resolve(img)
    }
    img.onerror = () => reject(new Error(`Failed to load sprite: ${url}`))
    img.src = url
  })
  imageCache.set(url, loading)
  return loading
}

export function preloadPetSprites(urls: string[]): Promise<void> {
  return Promise.all(urls.map(loadPetSprite)).then(() => undefined)
}

export function drawPetSpriteFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frameIndex: number,
  species: string,
  options: {
    x: number
    y: number
    pixelScale: number
    drawSize?: number
    flipX?: boolean
  }
): void {
  const frameSize = frameSizeFromStrip(img, species)
  const frameCount = frameCountFromImage(img, species)
  const frame = ((frameIndex % frameCount) + frameCount) % frameCount
  const size = options.drawSize ?? Math.round(options.pixelScale * frameSize)
  const scale = size / frameSize
  const dx = Math.round(options.x - size / 2)
  const dy = Math.round(options.y - size / 2)
  const sx = frame * frameSize

  ctx.imageSmoothingEnabled = false

  if (options.flipX) {
    ctx.save()
    ctx.translate(dx + size, dy)
    ctx.scale(-scale, scale)
    ctx.drawImage(img, sx, 0, frameSize, frameSize, 0, 0, frameSize, frameSize)
    ctx.restore()
  } else {
    ctx.drawImage(img, sx, 0, frameSize, frameSize, dx, dy, size, size)
  }
}

export { creatureDisplaySize, CREATURE_DISPLAY_SIZE } from './creatureCharacters'
