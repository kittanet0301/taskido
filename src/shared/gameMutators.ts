import type { AnimationState, GameSave, InventoryItem, ItemType, MinigameId, PetData, PetSpecies, Stage } from './types'
import { hatchPet, evolvePet, createEggPet, resetPetToEggStage, breedPetsLocal, canBreed } from './growth'
import { addDevPoints, canEvolveToAdult, canHatchEgg } from './stats'
import { ITEMS, normalizeQuickItemSlots, useItem } from './items'
import { getCareFeedback } from './careFeedback'
import { getMissionDefinition, applyDailyResets, recordDailyMissionClaim, updateMissionProgress } from './missions'
import { canAddPet, clampSlotLimit } from './petCollection'
import { applyFinishMinigame } from './minigame'
import { PET_SLOT_MAX } from './constants'
import { getMarketOffer } from './market'
import { getSessionIsAdmin, setSessionIsAdmin } from './sessionFlags'
import { calculateBotBattleReward, type BotDifficulty } from './battle/bot'

export { setSessionIsAdmin, getSessionIsAdmin } from './sessionFlags'

function debugMutatorsEnabled(): boolean {
  return getSessionIsAdmin()
}
import {
  PLAYABLE_CREATURE_SPECIES,
  elementForCreatureSpecies,
  isPlayableCreatureSpecies
} from './creatureCharacters'
import { defaultPetName } from './creatureCharacters'
import { getPetLevel } from './activityScore'
import {
  GROWTH_CARDS,
  applyGrowthCard as applyGrowthCardToStats,
  primariesForElements,
  rollGrowthCardOffers,
  type GrowthCard,
  type GrowthCardId
} from './combatStats'
import {
  forgetSkillSlot,
  rollSkillLoadout,
  upgradeSkillRank as upgradeSkillRankOnLoadout
} from './battle/skillTrees'

/** Grant +1 skill upgrade point per level gained, plus fresh growth-card offers. */
function grantLevelRewardsToPet(pet: PetData, levelsGained: number): PetData {
  if (levelsGained <= 0) return pet
  const nextPoints = pet.skillUpgradePoints + levelsGained
  const pending: GrowthCardId[] = pet.pendingGrowthOffers ?? []
  for (let i = 0; i < levelsGained; i++) {
    const offers = rollGrowthCardOffers()
    for (const o of offers) pending.push(o.id)
  }
  return {
    ...pet,
    skillUpgradePoints: nextPoints,
    pendingGrowthOffers: pending.length > 0 ? pending : null
  }
}

/**
 * Compare pet level before/after evolution stat change and, if it grew, grant
 * skill upgrade points + queue growth-card picks.
 */
function applyLevelGainRewards(prev: PetData, next: PetData): PetData {
  if (prev.stage === 'egg' || next.stage === 'egg') return next
  const prevLvl = getPetLevel(prev.stage, prev.stats.evolution)
  const nextLvl = getPetLevel(next.stage, next.stats.evolution)
  const gained = nextLvl - prevLvl
  if (gained <= 0) return next
  return grantLevelRewardsToPet(next, gained)
}

function findPetById(save: GameSave, petId: string): {
  pet: PetData
  where: 'active' | 'collection'
  index: number
} | null {
  if (save.pet && save.pet.id === petId) return { pet: save.pet, where: 'active', index: -1 }
  const idx = save.collection.findIndex((p) => p.id === petId)
  if (idx < 0) return null
  return { pet: save.collection[idx]!, where: 'collection', index: idx }
}

function replacePet(save: GameSave, petId: string, replacer: (pet: PetData) => PetData): GameSave {
  if (save.pet && save.pet.id === petId) {
    return { ...save, pet: replacer(save.pet) }
  }
  const idx = save.collection.findIndex((p) => p.id === petId)
  if (idx < 0) return save
  const collection = [...save.collection]
  collection[idx] = replacer(collection[idx]!)
  return { ...save, collection }
}

function addInventoryItems(
  inventory: InventoryItem[],
  items: Array<{ type: ItemType; quantity: number }>
): InventoryItem[] {
  const inv = [...inventory]
  for (const { type, quantity } of items) {
    if (!(type in ITEMS) || quantity <= 0) continue
    const idx = inv.findIndex((i) => i.type === type)
    if (idx >= 0) inv[idx] = { ...inv[idx], quantity: inv[idx].quantity + quantity }
    else inv.push({ type, quantity })
  }
  return inv
}

function debugSetPetStage(pet: NonNullable<GameSave['pet']>, stage: Stage) {
  if (stage === 'egg') return resetPetToEggStage(pet)

  // Jumping out of egg must go through hatch so skill loadout is rolled.
  let next = pet.stage === 'egg' ? hatchPet(pet) : pet

  if (stage === 'baby') {
    return {
      ...next,
      stage: 'baby' as const,
      hatchedAt: next.hatchedAt ?? new Date().toISOString(),
      animationState: 'idle' as const
    }
  }
  return {
    ...next,
    stage: 'adult' as const,
    hatchedAt: next.hatchedAt ?? new Date().toISOString(),
    animationState: 'idle' as const
  }
}

export function applyGamePatch(save: GameSave, mutatorName: string, args: unknown[] = []): GameSave {
  if (mutatorName === 'hatch') {
    if (!save.pet || !canHatchEgg(save.pet)) return save
    let next = { ...save, pet: hatchPet(save.pet) }
    next = applyDailyResets(next)
    next.missions = next.missions.map((m) =>
      m.missionId === 'weekly_hatch_1' ? { ...m, progress: m.progress + 1, completed: m.progress + 1 >= 1 } : m
    )
    return next
  }
  if (mutatorName === 'evolve') {
    if (!save.pet || !canEvolveToAdult(save.pet)) return save
    const prev = save.pet
    const evolved = evolvePet(prev)
    return { ...save, pet: applyLevelGainRewards(prev, evolved) }
  }
  if (mutatorName === 'newEgg') {
    if (!canAddPet(save)) return save
    const speciesArg = typeof args[0] === 'string' && isPlayableCreatureSpecies(args[0]) ? args[0] : undefined
    return { ...save, collection: [...save.collection, createEggPet(speciesArg)] }
  }
  if (mutatorName === 'buyMarket' && typeof args[0] === 'string') {
    const offer = getMarketOffer(args[0])
    if (!offer) return save
    const gems = save.gems ?? 0
    if (gems < offer.cost) return save

    if (offer.kind === 'egg') {
      if (!canAddPet(save)) return save
      return {
        ...save,
        gems: gems - offer.cost,
        collection: [...save.collection, createEggPet()]
      }
    }

    if (offer.kind === 'slots') {
      if (save.petSlotLimit >= PET_SLOT_MAX) return save
      const nextLimit = clampSlotLimit(save.petSlotLimit + offer.slots)
      if (nextLimit <= save.petSlotLimit) return save
      return {
        ...save,
        gems: gems - offer.cost,
        petSlotLimit: nextLimit
      }
    }

    if (offer.kind === 'item') {
      return {
        ...save,
        gems: gems - offer.cost,
        inventory: addInventoryItems(save.inventory, [
          { type: offer.itemType, quantity: offer.quantity }
        ])
      }
    }

    if (offer.kind === 'bundle') {
      return {
        ...save,
        gems: gems - offer.cost,
        inventory: addInventoryItems(save.inventory, offer.items)
      }
    }

    return save
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugSetSpecies' && typeof args[0] === 'string') {
    if (!save.pet || !isPlayableCreatureSpecies(args[0])) return save
    const species = args[0] as PetSpecies
    const elementPrimary = elementForCreatureSpecies(args[0])
    const elementSecondary = null
    const primaries = primariesForElements(elementPrimary, elementSecondary)
    const skillLoadout =
      save.pet.stage === 'egg'
        ? null
        : rollSkillLoadout(elementPrimary, elementSecondary)
    return {
      ...save,
      pet: {
        ...save.pet,
        character: species,
        name: defaultPetName(species),
        elementPrimary,
        elementSecondary,
        primaries,
        skillLoadout,
        skillUpgradePoints: save.pet.stage === 'egg' ? 0 : save.pet.skillUpgradePoints,
        pendingGrowthOffers: save.pet.stage === 'egg' ? null : save.pet.pendingGrowthOffers
      }
    }
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugSetStage' && typeof args[0] === 'string') {
    if (!save.pet) return save
    const stage = args[0] as Stage
    if (stage !== 'egg' && stage !== 'baby' && stage !== 'adult') return save
    return { ...save, pet: debugSetPetStage(save.pet, stage) }
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugBoostDev') {
    if (!save.pet) return save
    const amount = typeof args[0] === 'number' ? Math.max(0, Math.floor(args[0])) : 50
    const prev = save.pet
    const boosted: PetData = {
      ...prev,
      stats: addDevPoints(prev.stats, amount)
    }
    return { ...save, pet: applyLevelGainRewards(prev, boosted) }
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugAdjustEvoTime' && typeof args[0] === 'number') {
    if (save.pet?.stage !== 'baby' || !save.pet.hatchedAt) return save
    const hours = Math.max(-168, Math.min(168, Math.trunc(args[0])))
    const hatchedAt = new Date(save.pet.hatchedAt).getTime()
    if (hours === 0 || Number.isNaN(hatchedAt)) return save
    return {
      ...save,
      pet: {
        ...save.pet,
        // Moving hatch time backward shortens the remaining evolution wait.
        hatchedAt: new Date(hatchedAt + hours * 3_600_000).toISOString()
      }
    }
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugCycleSpecies') {
    if (!save.pet) return save
    const idx = PLAYABLE_CREATURE_SPECIES.indexOf(
      save.pet.character as (typeof PLAYABLE_CREATURE_SPECIES)[number]
    )
    const next = PLAYABLE_CREATURE_SPECIES[(Math.max(0, idx) + 1) % PLAYABLE_CREATURE_SPECIES.length]!
    const elementPrimary = elementForCreatureSpecies(next)
    const elementSecondary = null
    return {
      ...save,
      pet: {
        ...save.pet,
        character: next,
        name: defaultPetName(next),
        elementPrimary,
        elementSecondary,
        primaries: primariesForElements(elementPrimary, elementSecondary),
        skillLoadout:
          save.pet.stage === 'egg'
            ? null
            : rollSkillLoadout(elementPrimary, elementSecondary)
      }
    }
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugGrantItem' && typeof args[0] === 'string') {
    const itemType = args[0] as ItemType
    if (!(itemType in ITEMS)) return save
    const qty = typeof args[1] === 'number' ? Math.max(1, Math.floor(args[1])) : 1
    const inv = [...save.inventory]
    const idx = inv.findIndex((i) => i.type === itemType)
    if (idx >= 0) inv[idx] = { ...inv[idx], quantity: inv[idx].quantity + qty }
    else inv.push({ type: itemType, quantity: qty })
    return { ...save, inventory: inv }
  }
  if (debugMutatorsEnabled() && mutatorName === 'debugSetGender' && typeof args[0] === 'string') {
    if (!save.pet) return save
    const gender = args[0] === 'female' ? 'female' : args[0] === 'male' ? 'male' : null
    if (!gender) return save
    return { ...save, pet: { ...save.pet, gender } }
  }
  if (
    debugMutatorsEnabled() &&
    mutatorName === 'debugAdjustCare' &&
    (args[0] === 'health' || args[0] === 'emotion') &&
    typeof args[1] === 'number'
  ) {
    if (!save.pet) return save
    const kind = args[0] as 'health' | 'emotion'
    const delta = Math.trunc(args[1])
    if (delta === 0) return save
    const prev = save.pet.stats
    const nextVal =
      kind === 'health'
        ? Math.max(0, Math.min(100, prev.health + delta))
        : Math.max(0, Math.min(100, prev.emotion + delta))
    if (nextVal === prev[kind]) return save
    return {
      ...save,
      pet: {
        ...save.pet,
        stats: { ...prev, [kind]: nextVal },
        animationState: delta > 0 ? 'happy' : save.pet.animationState
      }
    }
  }
  if (mutatorName === 'setActivePet' && typeof args[0] === 'string') {
    const petId = args[0] as string
    const idx = save.collection.findIndex((p) => p.id === petId)
    if (idx < 0) return save
    const selected = save.collection[idx]
    const newCollection = [...save.collection]
    newCollection.splice(idx, 1)
    if (save.pet) newCollection.push(save.pet)
    return { ...save, pet: selected, collection: newCollection }
  }
  if (mutatorName === 'releasePet' && typeof args[0] === 'string') {
    const petId = args[0] as string
    if (save.pet?.id === petId) return save
    return { ...save, collection: save.collection.filter((p) => p.id !== petId) }
  }
  if (mutatorName === 'rename' && typeof args[0] === 'string') {
    if (!save.pet) return save
    return { ...save, pet: { ...save.pet, name: args[0] as string } }
  }
  if (mutatorName === 'useItem' && typeof args[0] === 'string') {
    const itemType = args[0] as ItemType
    if (!save.pet) return save
    if (itemType === 'battle_shield' || itemType === 'breed_nest' || itemType === 'skill_forget') return save
    const inv = [...save.inventory]
    const idx = inv.findIndex((i) => i.type === itemType && i.quantity > 0)
    if (idx < 0) return save
    inv[idx] = { ...inv[idx], quantity: inv[idx].quantity - 1 }
    const stats = useItem(itemType, save.pet.stats)
    const prevPet = save.pet
    let missions = save.missions
    if (itemType === 'food_basic' || itemType === 'food_premium' || itemType === 'water') {
      missions = missions.map((m) =>
        m.missionId === 'daily_feed_3'
          ? {
              ...m,
              progress: m.progress + 1,
              completed: m.progress + 1 >= (getMissionDefinition('daily_feed_3')?.target ?? 3)
            }
          : m
      )
    }
    const care = getCareFeedback(itemType)
    let nextPet: PetData = {
      ...save.pet,
      stats,
      feedCount: save.pet.feedCount + (itemType === 'food_basic' || itemType === 'food_premium' || itemType === 'water' ? 1 : 0),
      animationState: care?.anim ?? save.pet.animationState
    }
    nextPet = applyLevelGainRewards(prevPet, nextPet)
    return {
      ...save,
      inventory: inv.filter((i) => i.quantity > 0),
      missions,
      pet: nextPet
    }
  }
  if (mutatorName === 'setPetAnimation' && typeof args[0] === 'string') {
    if (!save.pet) return save
    const animationState = args[0] as AnimationState
    return { ...save, pet: { ...save.pet, animationState } }
  }
  if (mutatorName === 'setQuickItemSlot' && typeof args[0] === 'number') {
    const index = args[0] as number
    const itemType = args[1] as ItemType | null
    const quickItemSlots = normalizeQuickItemSlots(save.quickItemSlots)
    if (index < 0 || index >= quickItemSlots.length) return save
    if (itemType !== null && !(itemType in ITEMS)) return save
    quickItemSlots[index] = itemType
    return { ...save, quickItemSlots }
  }
  if (mutatorName === 'claimMission' && typeof args[0] === 'string') {
    const missionId = args[0] as string
    const mission = save.missions.find((m) => m.missionId === missionId)
    const def = getMissionDefinition(missionId)
    if (!mission || !def || !mission.completed) return save

    const reward = def.reward
    if ('newEgg' in reward && !canAddPet(save)) return save

    let inventory = [...save.inventory]
    let pet = save.pet
    let collection = [...save.collection]
    let petSlotLimit = save.petSlotLimit

    if ('type' in reward) {
      const existing = inventory.find((i) => i.type === reward.type)
      if (existing) existing.quantity += reward.quantity
      else inventory.push({ type: reward.type, quantity: reward.quantity })
    } else if ('emotion' in reward && pet) {
      pet = { ...pet, stats: { ...pet.stats, emotion: Math.min(100, pet.stats.emotion + reward.emotion) } }
    } else if ('evolution' in reward && pet) {
      pet = { ...pet, stats: addDevPoints(pet.stats, reward.evolution) }
    } else if ('newEgg' in reward) {
      collection = [...collection, createEggPet()]
    } else if ('slots' in reward) {
      petSlotLimit = clampSlotLimit(petSlotLimit + reward.slots)
    }

    const missions = save.missions.map((m) =>
      m.missionId === missionId ? { ...m, completed: false, progress: 0 } : m
    )
    const gemsReward = def.kind === 'daily' ? 5 : 15
    let next: GameSave = {
      ...save,
      inventory,
      pet,
      collection,
      petSlotLimit,
      missions,
      gems: (save.gems ?? 0) + gemsReward
    }
    if (def.kind === 'daily') next = recordDailyMissionClaim(next)
    return next
  }
  if (mutatorName === 'sendGiftLocal' && typeof args[0] === 'string' && typeof args[1] === 'number') {
    const itemType = args[0] as ItemType
    const quantity = Math.max(0, Math.floor(args[1]))
    if (quantity <= 0) return save
    const inv = [...save.inventory]
    const idx = inv.findIndex((i) => i.type === itemType)
    if (idx < 0 || inv[idx].quantity < quantity) return save
    inv[idx] = { ...inv[idx], quantity: inv[idx].quantity - quantity }
    return { ...save, inventory: inv.filter((i) => i.quantity > 0) }
  }
  if (mutatorName === 'recordBattleWin') {
    const next = applyDailyResets(save)
    return {
      ...next,
      missions: updateMissionProgress(next.missions, 'weekly_battle_win_3', 1)
    }
  }
  if (
    mutatorName === 'completeBotBattle' &&
    (args[0] === 'easy' || args[0] === 'normal' || args[0] === 'hard') &&
    typeof args[1] === 'number'
  ) {
    const difficulty = args[0] as BotDifficulty
    const reward = calculateBotBattleReward(difficulty, args[1])
    let next = applyDailyResets(save)
    let pet = next.pet
    if (pet) {
      const previous = pet
      pet = {
        ...pet,
        stats: addDevPoints(pet.stats, reward.evolution)
      }
      pet = applyLevelGainRewards(previous, pet)
    }
    return {
      ...next,
      pet,
      gems: (next.gems ?? 0) + reward.gems,
      inventory: reward.drop
        ? addInventoryItems(next.inventory, [{ type: reward.drop, quantity: 1 }])
        : next.inventory,
      missions: updateMissionProgress(next.missions, 'weekly_battle_win_3', 1)
    }
  }
  if (mutatorName === 'consumeBattleShield') {
    const inv = [...save.inventory]
    const idx = inv.findIndex((i) => i.type === 'battle_shield' && i.quantity > 0)
    if (idx < 0) return save
    inv[idx] = { ...inv[idx], quantity: inv[idx].quantity - 1 }
    return { ...save, inventory: inv.filter((i) => i.quantity > 0) }
  }
  if (mutatorName === 'finishMinigame' && typeof args[0] === 'string' && typeof args[1] === 'number') {
    const gameId = args[0] as MinigameId
    const score = Math.max(0, Math.floor(args[1]))
    return applyFinishMinigame(save, gameId, score).save
  }
  if (mutatorName === 'applyGrowthCard' && typeof args[0] === 'string' && typeof args[1] === 'string') {
    const petId = args[0] as string
    const cardId = args[1] as GrowthCardId
    const found = findPetById(save, petId)
    if (!found) return save
    const pending = found.pet.pendingGrowthOffers ?? []
    // Offers are queued in groups of 3 (one level-up pick). Choosing a card
    // resolves the current group and leaves later level-ups pending.
    const pickIndex = pending.indexOf(cardId)
    if (pickIndex < 0) return save
    const card: GrowthCard | undefined = GROWTH_CARDS.find((c) => c.id === cardId)
    if (!card) return save
    const groupStart = Math.floor(pickIndex / 3) * 3
    const remaining = [...pending.slice(0, groupStart), ...pending.slice(groupStart + 3)]
    return replacePet(save, petId, (pet) => ({
      ...pet,
      primaries: applyGrowthCardToStats(pet.primaries, card),
      pendingGrowthOffers: remaining.length > 0 ? remaining : null
    }))
  }
  if (mutatorName === 'upgradeSkillRank' && typeof args[0] === 'string' && typeof args[1] === 'number') {
    const petId = args[0] as string
    const slotIndex = Math.max(0, Math.floor(args[1] as number))
    const found = findPetById(save, petId)
    if (!found) return save
    if (found.pet.skillUpgradePoints <= 0) return save
    if (!found.pet.skillLoadout) return save
    const nextLoadout = upgradeSkillRankOnLoadout(found.pet.skillLoadout, slotIndex)
    if (!nextLoadout) return save
    return replacePet(save, petId, (pet) => ({
      ...pet,
      skillLoadout: nextLoadout,
      skillUpgradePoints: Math.max(0, pet.skillUpgradePoints - 1)
    }))
  }
  if (mutatorName === 'forgetSkill' && typeof args[0] === 'string' && typeof args[1] === 'number') {
    const petId = args[0] as string
    const slotIndex = Math.max(0, Math.floor(args[1] as number))
    const found = findPetById(save, petId)
    if (!found || !found.pet.skillLoadout) return save
    const inv = [...save.inventory]
    const idx = inv.findIndex((i) => i.type === 'skill_forget' && i.quantity > 0)
    if (idx < 0) return save
    const nextLoadout = forgetSkillSlot(
      found.pet.skillLoadout,
      slotIndex,
      found.pet.elementPrimary,
      found.pet.elementSecondary
    )
    if (nextLoadout === found.pet.skillLoadout) return save
    inv[idx] = { ...inv[idx], quantity: inv[idx].quantity - 1 }
    const withInventory = { ...save, inventory: inv.filter((i) => i.quantity > 0) }
    return replacePet(withInventory, petId, (pet) => ({ ...pet, skillLoadout: nextLoadout }))
  }
  if (mutatorName === 'breedPets' && typeof args[0] === 'string' && typeof args[1] === 'string') {
    const idA = args[0] as string
    const idB = args[1] as string
    if (idA === idB) return save
    const foundA = findPetById(save, idA)
    const foundB = findPetById(save, idB)
    if (!foundA || !foundB) return save
    if (!canBreed(foundA.pet, foundB.pet)) return save
    if (!canAddPet(save)) return save
    const inv = [...save.inventory]
    const nestIdx = inv.findIndex((i) => i.type === 'breed_nest' && i.quantity > 0)
    if (nestIdx < 0) return save
    const { parents: [parentA, parentB], egg } = breedPetsLocal(foundA.pet, foundB.pet)
    inv[nestIdx] = { ...inv[nestIdx], quantity: inv[nestIdx].quantity - 1 }
    let next: GameSave = { ...save, inventory: inv.filter((i) => i.quantity > 0) }
    next = replacePet(next, idA, () => parentA)
    next = replacePet(next, idB, () => parentB)
    return { ...next, collection: [...next.collection, egg] }
  }
  if (mutatorName === 'grantLevelRewards' && typeof args[0] === 'string' && typeof args[1] === 'number') {
    const petId = args[0] as string
    const gained = Math.max(0, Math.floor(args[1] as number))
    if (gained <= 0) return save
    return replacePet(save, petId, (pet) => grantLevelRewardsToPet(pet, gained))
  }
  return save
}
