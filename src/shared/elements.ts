export const ELEMENT_IDS = [
  'fire',
  'grass',
  'ground',
  'electric',
  'water',
  'ice',
  'dragon',
  'dark',
  'neutral'
] as const

export type ElementId = (typeof ELEMENT_IDS)[number]

/** Strong against list per attacker element */
export const ELEMENT_STRONG_AGAINST: Record<ElementId, ElementId[]> = {
  fire: ['grass', 'ice'],
  grass: ['ground'],
  ground: ['electric'],
  electric: ['water'],
  water: ['fire'],
  ice: ['dragon'],
  dragon: ['dark'],
  dark: ['neutral'],
  neutral: []
}

export const PURE_CHANCE = 0.6
/**
 * Temporary rollout switch: when true, new eggs / breed / debug rolls are always
 * pure (1 element). Set false later to re-enable dual 40% rolls.
 */
export const FORCE_PURE_ELEMENTS = true
export const PURE_DAMAGE_BONUS = 1.25
export const ELEMENT_SE_MULT = 1.5
export const ELEMENT_RESIST_MULT = 0.75
export const BATTLE_HEALTH_MIN = 30
export const BATTLE_EMOTION_MIN = 30

export function isElementId(value: string): value is ElementId {
  return (ELEMENT_IDS as readonly string[]).includes(value)
}

export function normalizeElementId(value: string | null | undefined): ElementId {
  if (value && isElementId(value)) return value
  return 'neutral'
}

/** Roll element slots. Pure-only while FORCE_PURE_ELEMENTS is true; else 60/40. */
export function rollElementSlots(rng: () => number = Math.random): {
  elementPrimary: ElementId
  elementSecondary: ElementId | null
} {
  const pick = (): ElementId => ELEMENT_IDS[Math.floor(rng() * ELEMENT_IDS.length)]!
  const primary = pick()
  if (FORCE_PURE_ELEMENTS || rng() < PURE_CHANCE) {
    return { elementPrimary: primary, elementSecondary: null }
  }
  let secondary = pick()
  let guard = 0
  while (secondary === primary && guard < 20) {
    secondary = pick()
    guard += 1
  }
  if (secondary === primary) {
    secondary = ELEMENT_IDS.find((e) => e !== primary) ?? 'neutral'
  }
  return { elementPrimary: primary, elementSecondary: secondary }
}

export function isPureElements(
  primary: ElementId,
  secondary: ElementId | null | undefined
): boolean {
  return secondary == null
}

/**
 * Attacker vs defender element multiplier.
 * Dual defenders: SE if attacker is strong vs either slot; resist only if weak to both.
 */
export function elementMultiplier(
  attacker: ElementId,
  defenderPrimary: ElementId,
  defenderSecondary: ElementId | null = null
): number {
  const defs = defenderSecondary
    ? [defenderPrimary, defenderSecondary]
    : [defenderPrimary]
  const strong = ELEMENT_STRONG_AGAINST[attacker] ?? []
  if (defs.some((d) => strong.includes(d))) return ELEMENT_SE_MULT

  const resisted = defs.every((d) => (ELEMENT_STRONG_AGAINST[d] ?? []).includes(attacker))
  if (resisted) return ELEMENT_RESIST_MULT
  return 1
}

export function pureBonus(primary: ElementId, secondary: ElementId | null | undefined): number {
  return isPureElements(primary, secondary) ? PURE_DAMAGE_BONUS : 1
}

export function canEnterBattle(health: number, emotion: number): boolean {
  return health >= BATTLE_HEALTH_MIN && emotion >= BATTLE_EMOTION_MIN
}

export type BattleEntryBlock = 'egg' | 'care'

export function battleEntryBlock(
  pet: { stage: string; stats: { health: number; emotion: number } } | null | undefined
): BattleEntryBlock | null {
  if (!pet || pet.stage === 'egg') return 'egg'
  if (!canEnterBattle(pet.stats.health, pet.stats.emotion)) return 'care'
  return null
}
