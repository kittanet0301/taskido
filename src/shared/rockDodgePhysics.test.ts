import { describe, expect, it } from 'vitest'
import {
  CANVAS_W,
  EGG_GOAL,
  PLAYER_W,
  PLAYER_Y,
  START_FALL_SPEED,
  MAX_FALL_SPEED,
  createDodgeState,
  getFallSpeedForEggs,
  getSpawnInterval,
  spawnRock,
  spawnEgg,
  tickDodgeState
} from '../hub/minigame/rock-dodge/rockDodgePhysics'

describe('rock dodge physics', () => {
  it('increases fall speed every 10 collected eggs', () => {
    expect(getFallSpeedForEggs(0)).toBe(START_FALL_SPEED)
    expect(getFallSpeedForEggs(9)).toBe(START_FALL_SPEED)
    expect(getFallSpeedForEggs(10)).toBe(START_FALL_SPEED + 1)
    expect(getFallSpeedForEggs(EGG_GOAL)).toBe(MAX_FALL_SPEED)
  })

  it('moves the player left and right within bounds', () => {
    let state = { ...createDodgeState(), spawnCooldown: 99_999, rocks: [] }
    const startX = state.playerX
    state = tickDodgeState(state, { move: -1 }, () => 0)
    expect(state.playerX).toBeLessThan(startX)

    for (let i = 0; i < 200; i++) {
      state = tickDodgeState(state, { move: -1 }, () => 0)
    }
    expect(state.playerX).toBe(0)

    for (let i = 0; i < 400; i++) {
      state = tickDodgeState(state, { move: 1 }, () => 0)
    }
    expect(state.playerX).toBe(CANVAS_W - PLAYER_W)
  })

  it('marks dead on rock collision', () => {
    let state = createDodgeState()
    state = {
      ...state,
      playerX: 100,
      rocks: [
        {
          id: 1,
          x: 100,
          y: PLAYER_Y,
          w: 40,
          h: 40,
          vy: 0,
          kind: 'rock'
        }
      ],
      spawnCooldown: 9999
    }
    state = tickDodgeState(state, { move: 0 }, () => 0)
    expect(state.dead).toBe(true)
  })

  it('spawns rocks and shortens interval as speed rises', () => {
    const rock = spawnRock(START_FALL_SPEED, 7, () => 0)
    expect(rock.id).toBe(7)
    expect(rock.y).toBeLessThan(0)

    const slow = getSpawnInterval(START_FALL_SPEED, () => 0)
    const fast = getSpawnInterval(MAX_FALL_SPEED, () => 0)
    expect(fast).toBeLessThan(slow)
  })

  it('collects a falling egg when it overlaps the player', () => {
    let state = {
      ...createDodgeState(),
      playerX: 100,
      eggs: [{ ...spawnEgg(START_FALL_SPEED, 1, () => 0), x: 106, y: PLAYER_Y, vy: 0 }],
      spawnCooldown: 9999,
      eggSpawnCooldown: 9999
    }

    state = tickDodgeState(state, { move: 0 }, () => 0)

    expect(state.eggsCollected).toBe(1)
    expect(state.eggs).toEqual([])
    expect(state.won).toBe(false)
  })

  it('wins immediately after collecting the 100th egg without being hit', () => {
    let state = {
      ...createDodgeState(),
      playerX: 100,
      eggsCollected: EGG_GOAL - 1,
      eggs: [{ ...spawnEgg(START_FALL_SPEED, 1, () => 0), x: 106, y: PLAYER_Y, vy: 0 }],
      spawnCooldown: 9999,
      eggSpawnCooldown: 9999
    }

    state = tickDodgeState(state, { move: 0 }, () => 0)

    expect(state.eggsCollected).toBe(EGG_GOAL)
    expect(state.won).toBe(true)
    expect(state.dead).toBe(false)
  })

  it('does not count an egg when a rock hits on the same frame', () => {
    let state = {
      ...createDodgeState(),
      playerX: 100,
      eggsCollected: EGG_GOAL - 1,
      eggs: [{ ...spawnEgg(START_FALL_SPEED, 1, () => 0), x: 106, y: PLAYER_Y, vy: 0 }],
      rocks: [{ id: 1, x: 100, y: PLAYER_Y, w: 40, h: 40, vy: 0, kind: 'rock' as const }],
      spawnCooldown: 9999,
      eggSpawnCooldown: 9999
    }

    state = tickDodgeState(state, { move: 0 }, () => 0)

    expect(state.dead).toBe(true)
    expect(state.won).toBe(false)
    expect(state.eggsCollected).toBe(EGG_GOAL - 1)
  })
})
