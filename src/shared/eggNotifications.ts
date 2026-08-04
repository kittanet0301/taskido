import type { PetData } from './types'

export interface EggNotificationState {
  knownIds: string[]
  unreadIds: string[]
}

export function reconcileEggNotifications(
  collection: PetData[],
  previous: EggNotificationState | null
): EggNotificationState {
  const currentEggIds = collection.filter((pet) => pet.stage === 'egg').map((pet) => pet.id)
  if (!previous) return { knownIds: currentEggIds, unreadIds: [] }

  const currentSet = new Set(currentEggIds)
  const knownSet = new Set(previous.knownIds)
  return {
    knownIds: currentEggIds,
    unreadIds: [
      ...previous.unreadIds.filter((id) => currentSet.has(id)),
      ...currentEggIds.filter((id) => !knownSet.has(id))
    ].filter((id, index, ids) => ids.indexOf(id) === index)
  }
}

export function markEggNotificationRead(
  state: EggNotificationState,
  petId: string
): EggNotificationState {
  return { ...state, unreadIds: state.unreadIds.filter((id) => id !== petId) }
}
