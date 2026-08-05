import { describe, expect, it } from 'vitest'
import { DASH_SCENE_ANCHORS } from './dashSceneLayout'
import {
  DASH_BG_FRAME_COUNT,
  DASH_CANONICAL_FEET,
  dashBgFrameSrc,
  dashBgObjectPosition,
  dashBgSrcForElement,
  dashPetFeetAnchorFraction,
  dashSceneAnchorForElement
} from './dashSceneBackgrounds'

describe('dashSceneBackgrounds', () => {
  it('maps every element to animated frame paths', () => {
    expect(dashBgSrcForElement('neutral')).toBe('/ui/home-bg/neutral/frame-0.png')
    expect(dashBgFrameSrc('fire', 2)).toBe('/ui/home-bg/fire/frame-2.png')
    expect(dashBgFrameSrc('fire', 5)).toBe('/ui/home-bg/fire/frame-1.png')
  })

  it('uses canonical feet anchor for every element after pipeline alignment', () => {
    expect(DASH_CANONICAL_FEET).toEqual(DASH_SCENE_ANCHORS.pedestal)
    expect(dashSceneAnchorForElement('grass', 'pedestal')).toEqual(DASH_CANONICAL_FEET)
    expect(dashSceneAnchorForElement('water', 'egg').y).toBe(DASH_SCENE_ANCHORS.egg.y)
  })

  it('uses four frames per element', () => {
    expect(DASH_BG_FRAME_COUNT).toBe(4)
  })

  it('locks BG object-position to the feet stand line', () => {
    expect(dashBgObjectPosition('fire')).toBe(
      `${(836 / 1672) * 100}% ${(790 / 941) * 100}%`
    )
  })

  it('derives pet transform Y from hub canvas feet inset', () => {
    expect(dashPetFeetAnchorFraction(250)).toBeCloseTo(254 / 258, 5)
  })
})
