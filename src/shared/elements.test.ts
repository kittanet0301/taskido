import { describe, expect, it } from 'vitest'
import {
  FORCE_PURE_ELEMENTS,
  battleEntryBlock,
  canEnterBattle,
  elementMultiplier,
  pureBonus,
  rollElementSlots
} from './elements'

describe('elements', () => {
  it('applies SE / resist / neutral multipliers', () => {
    expect(elementMultiplier('fire', 'grass', null)).toBe(1.5)
    expect(elementMultiplier('fire', 'water', null)).toBe(0.75)
    expect(elementMultiplier('fire', 'electric', null)).toBe(1)
  })

  it('treats dual defenders as SE if either slot is weak', () => {
    expect(elementMultiplier('fire', 'electric', 'grass')).toBe(1.5)
  })

  it('requires both dual slots to resist for NVE', () => {
    // water resists fire; electric does not resist fire → neutral
    expect(elementMultiplier('fire', 'water', 'electric')).toBe(1)
    // both water and ice? ice does not resist fire. Use water+water-like: water resists fire,
    // and only water-type strong against fire among dual that both resist fire.
    // grass is weak to fire (does not resist). ground does not resist fire.
    // For both to resist fire, each must have fire in strong-against. Only water has fire.
    // So pure water is the resist case; dual cannot both resist fire with current chart.
    expect(elementMultiplier('dragon', 'ice', null)).toBe(0.75)
  })

  it('gives pure pets a 1.25 damage bonus', () => {
    expect(pureBonus('fire', null)).toBe(1.25)
    expect(pureBonus('fire', 'water')).toBe(1)
  })

  it('gates battle entry on care health/emotion', () => {
    expect(canEnterBattle(30, 30)).toBe(true)
    expect(canEnterBattle(29, 30)).toBe(false)
    expect(canEnterBattle(30, 29)).toBe(false)
  })

  it('classifies why battle entry is blocked', () => {
    expect(battleEntryBlock(null)).toBe('egg')
    expect(battleEntryBlock({ stage: 'egg', stats: { health: 80, emotion: 80 } })).toBe('egg')
    expect(battleEntryBlock({ stage: 'baby', stats: { health: 29, emotion: 80 } })).toBe('care')
    expect(battleEntryBlock({ stage: 'baby', stats: { health: 80, emotion: 80 } })).toBe(null)
  })

  it('rolls pure slots while FORCE_PURE_ELEMENTS is on', () => {
    expect(FORCE_PURE_ELEMENTS).toBe(true)
    // Even with rng that would have taken the dual branch (0.9 >= 0.6), stay pure.
    let n = 0
    const dualAttemptRng = () => {
      const values = [0.0, 0.9, 0.5]
      return values[Math.min(n++, values.length - 1)]!
    }
    const rolled = rollElementSlots(dualAttemptRng)
    expect(rolled.elementSecondary).toBeNull()
    expect(rolled.elementPrimary).toBeTruthy()
  })
})
