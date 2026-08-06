import type { AnimationState, PetData } from './types'
import { battleClipFlipX, battleHurtClipFlipX } from './creatureCharacters'
import { getMoodLabel, shouldBeSick } from './stats'
import type { PetSpriteFolder } from './petSprites'
import {
  DINO_HAPPY_BURST,
  DINO_HAPPY_CYCLE
} from './dinoTiming'

export interface ResolvedPetClip {
  folder: PetSpriteFolder
  clip: string
  flipX: boolean
}

export type ResolvedDinoClip = ResolvedPetClip

/**
 * Creature (and shared walk) sprites face left in the art.
 * Mirror when the pet should face/move right (hub idle default).
 */
export function flipXForFacing(facing: 'left' | 'right'): boolean {
  return facing === 'right'
}

/** Hub / stationary clips face right by default. */
const IDLE_FLIP_X = flipXForFacing('right')

function bodyFolder(pet: PetData): PetSpriteFolder {
  if (pet.stage === 'egg') return 'egg'
  return pet.stage === 'baby' ? 'baby' : 'adult'
}

export function resolvePetClip(
  pet: PetData,
  frame: number,
  movementAnim: AnimationState,
  hatching = false
): ResolvedPetClip {
  if (pet.stage === 'egg') {
    if (hatching || pet.animationState === 'egg_hatch') {
      // Match hub idle facing (sprites face left in art; mirror to show right).
      return { folder: 'egg', clip: 'hatch', flipX: IDLE_FLIP_X }
    }
    return { folder: 'egg', clip: 'move', flipX: false }
  }

  const folder = bodyFolder(pet)

  if (movementAnim === 'battle_attack') return { folder, clip: 'bite', flipX: battleClipFlipX(pet.character) }
  if (movementAnim === 'battle_hurt') return { folder, clip: 'hurt', flipX: battleHurtClipFlipX(pet.character) }

  if (pet.animationState === 'eat') return { folder, clip: 'bite', flipX: IDLE_FLIP_X }
  if (pet.animationState === 'happy') return { folder, clip: 'jump', flipX: IDLE_FLIP_X }
  if (pet.animationState === 'sad' || pet.animationState === 'sick') {
    return { folder, clip: 'hurt', flipX: IDLE_FLIP_X }
  }
  if (pet.animationState === 'sleep') return { folder, clip: 'idle', flipX: IDLE_FLIP_X }
  if (pet.animationState === 'evolve') return { folder, clip: 'jump', flipX: IDLE_FLIP_X }
  if (pet.animationState === 'battle_attack') return { folder, clip: 'bite', flipX: battleClipFlipX(pet.character) }
  if (pet.animationState === 'battle_hurt') return { folder, clip: 'hurt', flipX: battleHurtClipFlipX(pet.character) }
  if (pet.stats.health <= 0) return { folder, clip: 'hurt', flipX: IDLE_FLIP_X }

  if (shouldBeSick(pet.stats)) return { folder, clip: 'hurt', flipX: IDLE_FLIP_X }

  const mood = getMoodLabel(pet.stats.emotion)
  if (mood === 'happy' && frame % DINO_HAPPY_CYCLE < DINO_HAPPY_BURST) {
    return { folder, clip: 'jump', flipX: IDLE_FLIP_X }
  }
  if (mood === 'sad') return { folder, clip: 'hurt', flipX: IDLE_FLIP_X }

  if (movementAnim === 'walk_left') return { folder, clip: 'move', flipX: flipXForFacing('left') }
  if (movementAnim === 'walk_right') return { folder, clip: 'move', flipX: flipXForFacing('right') }

  return { folder, clip: 'idle', flipX: IDLE_FLIP_X }
}

export const resolveDinoClip = resolvePetClip

/** Hub/collection preview: same mood/health clips as live pet (idle facing right). */
export function hubPreviewClip(pet: PetData, hatching = false): ResolvedPetClip {
  return resolvePetClip(pet, 0, 'idle', hatching)
}
