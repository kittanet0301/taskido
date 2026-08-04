import { describe, expect, it } from 'vitest'
import type { PetData } from './types'
import { markEggNotificationRead, reconcileEggNotifications } from './eggNotifications'

const pet = (id: string, stage: PetData['stage'] = 'egg') => ({ id, stage }) as PetData

describe('egg notifications', () => {
  it('uses the first collection snapshot as a read baseline', () => {
    expect(reconcileEggNotifications([pet('old')], null)).toEqual({
      knownIds: ['old'],
      unreadIds: []
    })
  })

  it('marks only newly added eggs unread and drops removed eggs', () => {
    expect(
      reconcileEggNotifications([pet('old'), pet('new'), pet('baby', 'baby')], {
        knownIds: ['old', 'removed'],
        unreadIds: ['removed']
      })
    ).toEqual({ knownIds: ['old', 'new'], unreadIds: ['new'] })
  })

  it('clears an unread egg when it is viewed', () => {
    expect(markEggNotificationRead({ knownIds: ['a', 'b'], unreadIds: ['a', 'b'] }, 'a').unreadIds).toEqual(['b'])
  })
})
