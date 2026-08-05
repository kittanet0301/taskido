export const GAME_SPEED_MULTIPLIERS = [1, 2, 4, 8, 16] as const

export type GameSpeedMultiplier = (typeof GAME_SPEED_MULTIPLIERS)[number]

let multiplier: GameSpeedMultiplier = 1

export function normalizeGameSpeedMultiplier(value: unknown): GameSpeedMultiplier {
  const parsed = Number(value)
  return GAME_SPEED_MULTIPLIERS.includes(parsed as GameSpeedMultiplier)
    ? (parsed as GameSpeedMultiplier)
    : 1
}

export function getGameSpeedMultiplier(): GameSpeedMultiplier {
  return multiplier
}

export function setGameSpeedMultiplier(value: unknown): GameSpeedMultiplier {
  multiplier = normalizeGameSpeedMultiplier(value)
  return multiplier
}
