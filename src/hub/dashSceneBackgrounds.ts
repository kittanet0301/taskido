import type { ElementId } from '../shared/elements'
import {
  DASH_BG_HEIGHT,
  DASH_BG_WIDTH,
  DASH_SCENE_ANCHORS,
  dashBgObjectPositionCss
} from './dashSceneLayout'

export const DASH_BG_FRAME_COUNT = 4
export const DASH_BG_FRAME_MS = 650

/** Canonical feet anchor — all aligned frames share this hub layout. */
export const DASH_CANONICAL_FEET = DASH_SCENE_ANCHORS.pedestal
export const DASH_CANONICAL_EGG = DASH_SCENE_ANCHORS.egg

const HOME_BG_BASE = '/ui/home-bg'

export function dashBgFrameSrc(element: ElementId, frame: number): string {
  const idx = ((frame % DASH_BG_FRAME_COUNT) + DASH_BG_FRAME_COUNT) % DASH_BG_FRAME_COUNT
  return `${HOME_BG_BASE}/${element}/frame-${idx}.png`
}

export function dashBgSrcForElement(element: ElementId): string {
  return dashBgFrameSrc(element, 0)
}

export function dashBgObjectPosition(_element: ElementId): string {
  return dashBgObjectPositionCss()
}

export function dashSceneAnchorForElement(
  _element: ElementId,
  kind: 'egg' | 'pedestal'
): { x: number; y: number } {
  return kind === 'egg' ? DASH_CANONICAL_EGG : DASH_CANONICAL_FEET
}

export const DASH_SCENE_BG_DIMENSIONS = {
  width: DASH_BG_WIDTH,
  height: DASH_BG_HEIGHT
} as const

export { DASH_BG_OBJECT_POSITION, dashPetFeetAnchorFraction } from './dashSceneLayout'
