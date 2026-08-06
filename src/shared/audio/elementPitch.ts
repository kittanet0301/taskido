import type { ElementId } from '../elements'

/** Relative pitch multiplier per element for battle/creature SFX. */
const ELEMENT_PITCH: Record<ElementId, number> = {
  fire: 1.25,
  electric: 1.18,
  grass: 1.08,
  dragon: 1.12,
  ice: 0.95,
  water: 0.9,
  neutral: 1.0,
  ground: 0.82,
  dark: 0.75
}

export function elementPitchMultiplier(element?: ElementId | string | null): number {
  if (!element || !(element in ELEMENT_PITCH)) return 1
  return ELEMENT_PITCH[element as ElementId]
}
