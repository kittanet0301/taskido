import type { ItemType } from './types'
import type { SfxId } from './audio/soundIds'

const CARE_ITEM_SFX: Partial<Record<ItemType, SfxId>> = {
  food_basic: 'care_eat',
  food_premium: 'care_eat',
  water: 'care_drink',
  medicine: 'care_medicine',
  toy: 'care_toy',
  dev_vitamin: 'care_happy'
}

export function careItemSfx(type: ItemType): SfxId {
  return CARE_ITEM_SFX[type] ?? 'care_happy'
}
