/** Rock Dodge: catch 100 eggs while avoiding falling hazards. */

import { ROCK_DODGE_EGG_GOAL } from '../../../shared/minigame'

export const CANVAS_W = 720
export const CANVAS_H = 360
export const GROUND_Y = 280
export const PLAYER_W = 44
export const PLAYER_H = 48
export const PLAYER_Y = GROUND_Y - PLAYER_H
export const PLAYER_SPEED = 6

export const START_FALL_SPEED = 3
export const MAX_FALL_SPEED = 9
export const EGG_GOAL = ROCK_DODGE_EGG_GOAL

export const ROCK_MIN_W = 28
export const ROCK_MAX_W = 48
export const ROCK_MIN_H = 24
export const ROCK_MAX_H = 42

export const PLAYER_HITBOX_PAD = 4
export const ROCK_HITBOX_PAD = 4
export const EGG_W = 26
export const EGG_H = 34
export const EGG_HITBOX_PAD = 2

export type Rng = () => number

export type RockKind = 'rock' | 'branch' | 'trash'

export interface Rock {
  id: number
  x: number
  y: number
  w: number
  h: number
  vy: number
  kind: RockKind
}

export interface FallingEgg {
  id: number
  x: number
  y: number
  w: number
  h: number
  vy: number
}

export interface DodgeState {
  /** Survival accumulator (same scale idea as Dino Jump distanceRan) */
  survival: number
  playerX: number
  rocks: Rock[]
  eggs: FallingEgg[]
  eggsCollected: number
  spawnCooldown: number
  eggSpawnCooldown: number
  nextRockId: number
  nextEggId: number
  dead: boolean
  won: boolean
}

export interface DodgeInput {
  /** -1 left, 0 none, 1 right */
  move: -1 | 0 | 1
}

export const EMPTY_DODGE_INPUT: DodgeInput = { move: 0 }

export function createDodgeState(): DodgeState {
  return {
    survival: 0,
    playerX: Math.round((CANVAS_W - PLAYER_W) / 2),
    rocks: [],
    eggs: [],
    eggsCollected: 0,
    spawnCooldown: 50,
    eggSpawnCooldown: 24,
    nextRockId: 1,
    nextEggId: 1,
    dead: false,
    won: false
  }
}

export function getFallSpeedForEggs(eggsCollected: number): number {
  const tier = Math.floor(eggsCollected / 10)
  return Math.min(MAX_FALL_SPEED, START_FALL_SPEED + tier)
}

export function getSpawnInterval(fallSpeed: number, rng: Rng = Math.random): number {
  const base = Math.max(18, 70 - fallSpeed * 5)
  const jitter = Math.round(rng() * 22)
  return base + jitter
}

export function getEggSpawnInterval(rng: Rng = Math.random): number {
  return 28 + Math.round(rng() * 24)
}

function rollRockKind(rng: Rng): RockKind {
  const r = rng()
  if (r < 0.55) return 'rock'
  if (r < 0.8) return 'branch'
  return 'trash'
}

export function spawnRock(
  fallSpeed: number,
  nextId: number,
  rng: Rng = Math.random
): Rock {
  const w = Math.round(ROCK_MIN_W + rng() * (ROCK_MAX_W - ROCK_MIN_W))
  const h = Math.round(ROCK_MIN_H + rng() * (ROCK_MAX_H - ROCK_MIN_H))
  const maxX = Math.max(0, CANVAS_W - w)
  const x = Math.round(rng() * maxX)
  const kind = rollRockKind(rng)
  const vy = fallSpeed + (kind === 'trash' ? 0.6 : kind === 'branch' ? -0.3 : 0) + rng() * 0.8
  return {
    id: nextId,
    x,
    y: -h - 4,
    w,
    h,
    vy,
    kind
  }
}

export function spawnEgg(fallSpeed: number, nextId: number, rng: Rng = Math.random): FallingEgg {
  return {
    id: nextId,
    x: Math.round(rng() * (CANVAS_W - EGG_W)),
    y: -EGG_H - 4,
    w: EGG_W,
    h: EGG_H,
    vy: Math.max(2.8, fallSpeed * 0.72) + rng() * 0.5
  }
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

export function tickDodgeState(
  state: DodgeState,
  input: DodgeInput = EMPTY_DODGE_INPUT,
  rng: Rng = Math.random
): DodgeState {
  if (state.dead || state.won) return state

  const next: DodgeState = {
    ...state,
    rocks: state.rocks.map((r) => ({ ...r })),
    eggs: state.eggs.map((egg) => ({ ...egg }))
  }
  const fallSpeed = getFallSpeedForEggs(next.eggsCollected)

  if (input.move !== 0) {
    next.playerX += input.move * PLAYER_SPEED
    next.playerX = Math.max(0, Math.min(CANVAS_W - PLAYER_W, next.playerX))
  }

  next.survival += fallSpeed

  next.rocks = next.rocks
    .map((r) => ({ ...r, y: r.y + r.vy }))
    .filter((r) => r.y < CANVAS_H + 40)
  next.eggs = next.eggs
    .map((egg) => ({ ...egg, y: egg.y + egg.vy }))
    .filter((egg) => egg.y < CANVAS_H + 40)

  next.spawnCooldown -= 1
  if (next.spawnCooldown <= 0) {
    next.rocks.push(spawnRock(fallSpeed, next.nextRockId++, rng))
    next.spawnCooldown = getSpawnInterval(fallSpeed, rng)
  }

  next.eggSpawnCooldown -= 1
  if (next.eggSpawnCooldown <= 0) {
    next.eggs.push(spawnEgg(fallSpeed, next.nextEggId++, rng))
    next.eggSpawnCooldown = getEggSpawnInterval(rng)
  }

  for (const rock of next.rocks) {
    if (
      rectsOverlap(
        next.playerX + PLAYER_HITBOX_PAD,
        PLAYER_Y + PLAYER_HITBOX_PAD,
        PLAYER_W - PLAYER_HITBOX_PAD * 2,
        PLAYER_H - PLAYER_HITBOX_PAD * 2,
        rock.x + ROCK_HITBOX_PAD,
        rock.y + ROCK_HITBOX_PAD,
        rock.w - ROCK_HITBOX_PAD * 2,
        rock.h - ROCK_HITBOX_PAD * 2
      )
    ) {
      next.dead = true
      break
    }
  }

  if (!next.dead) {
    const uncollectedEggs: FallingEgg[] = []
    for (const egg of next.eggs) {
      const collected = rectsOverlap(
        next.playerX + PLAYER_HITBOX_PAD,
        PLAYER_Y + PLAYER_HITBOX_PAD,
        PLAYER_W - PLAYER_HITBOX_PAD * 2,
        PLAYER_H - PLAYER_HITBOX_PAD * 2,
        egg.x + EGG_HITBOX_PAD,
        egg.y + EGG_HITBOX_PAD,
        egg.w - EGG_HITBOX_PAD * 2,
        egg.h - EGG_HITBOX_PAD * 2
      )
      if (collected) next.eggsCollected = Math.min(EGG_GOAL, next.eggsCollected + 1)
      else uncollectedEggs.push(egg)
    }
    next.eggs = uncollectedEggs
    next.won = next.eggsCollected >= EGG_GOAL
  }

  return next
}
