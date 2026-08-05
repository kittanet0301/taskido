import { QUICK_ITEM_SLOT_COUNT } from './constants'
import type { InventoryItem, ItemType, PetStats } from './types'
import { addDevPoints, clampStat, feedPet, healPet } from './stats'

export interface ItemDefinition {
  type: ItemType
  apply: (stats: PetStats) => PetStats
}

export const ITEMS: Record<ItemType, ItemDefinition> = {
  food_basic: {
    type: 'food_basic',
    apply: (stats) => feedPet(stats, 15)
  },
  food_premium: {
    type: 'food_premium',
    apply: (stats) => healPet(feedPet(stats, 30), 10)
  },
  medicine: {
    type: 'medicine',
    apply: (stats) => healPet(stats, 40)
  },
  water: {
    type: 'water',
    apply: (stats) => healPet(feedPet(stats, 10), 5)
  },
  toy: {
    type: 'toy',
    apply: (stats) => feedPet(stats, 25)
  },
  dev_vitamin: {
    type: 'dev_vitamin',
    apply: (stats) => addDevPoints(stats, 50)
  },
  battle_shield: {
    type: 'battle_shield',
    apply: (stats) => stats
  },
  breed_nest: {
    type: 'breed_nest',
    apply: (stats) => stats
  },
  skill_forget: {
    type: 'skill_forget',
    apply: (stats) => stats
  }
}

export function useItem(type: ItemType, stats: PetStats): PetStats {
  return ITEMS[type].apply(stats)
}

export function getDefaultInventory(): { type: ItemType; quantity: number }[] {
  const base: { type: ItemType; quantity: number }[] = [
    { type: 'food_basic', quantity: 2 },
    { type: 'water', quantity: 2 },
    { type: 'medicine', quantity: 1 }
  ]
  return base
}

export function getDefaultQuickItemSlots(inventory: InventoryItem[] = getDefaultInventory()): Array<ItemType | null> {
  const types = inventory.map((item) => item.type)
  return Array.from({ length: QUICK_ITEM_SLOT_COUNT }, (_, idx) => types[idx] ?? null)
}

export function normalizeQuickItemSlots(slots?: Array<ItemType | null> | null): Array<ItemType | null> {
  const safeSlots = Array.isArray(slots) ? slots.slice(0, QUICK_ITEM_SLOT_COUNT) : []
  while (safeSlots.length < QUICK_ITEM_SLOT_COUNT) safeSlots.push(null)
  return safeSlots.map((slot) => (slot && slot in ITEMS ? slot : null))
}

/** Quick Care buttons on the home dashboard — one slot per item type. */
export const QUICK_CARE_ITEMS: { type: ItemType; emoji: string }[] = [
  { type: 'food_basic', emoji: '🥬' },
  { type: 'food_premium', emoji: '🥫' },
  { type: 'medicine', emoji: '💊' },
  { type: 'water', emoji: '💧' },
  { type: 'toy', emoji: '🎾' }
]
