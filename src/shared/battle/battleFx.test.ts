import { describe, expect, it } from 'vitest'
import { collectUnseenBattleFx, resolveBattleFighterAnim, resolveBattleFx, usesAura, usesProjectile } from './battleFx'
import type { BattleTurn } from './types'

const turn = (overrides: Partial<BattleTurn> = {}): BattleTurn => ({
  id: 'turn-1', sessionId: 'battle-1', actorUserId: 'a', action: 'attack',
  damage: 12, challengerHpAfter: 100, defenderHpAfter: 88, message: 'hit', createdAt: '',
  ...overrides
})

describe('collectUnseenBattleFx', () => {
  it('preserves order and never queues the same confirmed turn twice', () => {
    const seen = new Set(['history'])
    const turns = [turn({ id: 'history' }), turn({ id: 'new-1' }), turn({ id: 'new-2', action: 'skill', skillId: 'fire_inferno_burst' })]
    expect(collectUnseenBattleFx(turns, seen, 'a', 'b').map((fx) => fx.eventId)).toEqual(['new-1', 'new-2'])
    expect(collectUnseenBattleFx(turns, seen, 'a', 'b')).toEqual([])
  })
})

describe('resolveBattleFx', () => {
  it('maps a basic attack to a neutral opponent impact', () => {
    const fx = resolveBattleFx(turn(), 'a', 'b')!
    expect(fx).toMatchObject({ actorSide: 'challenger', targetSide: 'defender', element: 'neutral', role: 'attack' })
  })

  it('maps elemental skill roles and direction', () => {
    const fx = resolveBattleFx(turn({ actorUserId: 'b', action: 'skill', skillId: 'electric_needle_bolt' }), 'a', 'b')!
    expect(fx).toMatchObject({ actorSide: 'defender', targetSide: 'challenger', element: 'electric', role: 'pierce' })
    expect(usesProjectile(fx)).toBe(true)
  })

  it.each([
    ['fire_heat_guard', 'guard'],
    ['grass_photosynth', 'support'],
    ['dark_fade_step', 'dodge']
  ])('keeps %s on the actor', (skillId, role) => {
    const fx = resolveBattleFx(turn({ action: 'skill', skillId, damage: 0 }), 'a', 'b')!
    expect(fx.targetSide).toBe('challenger')
    expect(fx.role).toBe(role)
    expect(usesAura(fx)).toBe(true)
  })

  it('maps marks and ultimates without requiring damage', () => {
    expect(resolveBattleFx(turn({ action: 'skill', skillId: 'water_ripple_mark', damage: 0 }), 'a', 'b')?.role).toBe('mark')
    expect(resolveBattleFx(turn({ action: 'skill', skillId: 'ice_absolute_zero' }), 'a', 'b')?.durationMs).toBe(1100)
  })

  it('falls back for unknown and legacy attacks and ignores items', () => {
    expect(resolveBattleFx(turn({ action: 'bite', skillId: null }), 'a', 'b')?.role).toBe('attack')
    expect(resolveBattleFx(turn({ action: 'defend', damage: 0 }), 'a', 'b')?.role).toBe('guard')
    expect(resolveBattleFx(turn({ action: 'avoid', damage: 0 }), 'a', 'b')?.role).toBe('dodge')
    expect(resolveBattleFx(turn({ action: 'skill', skillId: 'missing' }), 'a', 'b')?.element).toBe('neutral')
    expect(resolveBattleFx(turn({ action: 'item' }), 'a', 'b')).toBeNull()
  })
})

describe('resolveBattleFighterAnim', () => {
  it('keeps defeated fighters on hurt until the scene changes', () => {
    expect(resolveBattleFighterAnim('defender', { defeated: true, activeFx: null, hit: false })).toBe('battle_hurt')
  })

  it('prioritizes attack and hit clips while the fighter is still up', () => {
    const fx = resolveBattleFx(turn(), 'a', 'b')!
    expect(resolveBattleFighterAnim('challenger', { defeated: false, activeFx: fx, hit: false })).toBe('battle_attack')
    expect(resolveBattleFighterAnim('defender', { defeated: false, activeFx: fx, hit: true })).toBe('battle_hurt')
  })
})
