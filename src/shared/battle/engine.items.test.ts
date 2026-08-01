import { describe, expect, it } from 'vitest'
import { applyAction } from './engine'
import type { BattleSessionState } from './types'

function state(): BattleSessionState {
  const fighter = (userId: string) => ({
    userId,
    petId: userId,
    name: userId,
    character: 'neutral',
    hp: 100,
    hpStart: 200,
    mp: 20,
    mpStart: 100,
    tp: 0,
    defending: false,
    avoiding: false,
    str: 20,
    dex: 20,
    int: 20,
    con: 20,
    elementPrimary: 'neutral',
    elementSecondary: null
  })
  return {
    sessionId: 'local',
    challenger: fighter('player'),
    defender: fighter('bot'),
    turnUserId: 'player',
    status: 'active',
    winnerUserId: null,
    fledUserId: null
  }
}

describe('session-only battle consumables', () => {
  it('restores HP without exceeding max and passes the turn', () => {
    const result = applyAction(state(), 'player', 'item:health_potion')
    expect(result.state.challenger.hp).toBe(190)
    expect(result.state.turnUserId).toBe('bot')
  })

  it('restores MP without exceeding max', () => {
    const result = applyAction(state(), 'player', 'item:mana_potion')
    expect(result.state.challenger.mp).toBe(80)
  })
})
