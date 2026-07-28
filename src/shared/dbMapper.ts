import type {
  AnimationState,
  ElementId,
  GameSave,
  Gender,
  GrowthCardId,
  InventoryItem,
  ItemType,
  MinigameId,
  MinigameSaveState,
  MissionProgress,
  PetData,
  SkillLoadout,
  Stage
} from './types'
import { SAVE_VERSION, PET_SLOT_BASE } from './constants'
import { createDefaultSave } from './growth'
import { createDefaultMinigameState } from './minigame'
import { normalizePetSpecies } from './creatureCharacters'
import { clampSlotLimit } from './petCollection'
import { normalizePetData } from './petNormalize'

type DbPet = {
  id: string
  owner_id: string
  name: string
  species: string
  gender: string
  stage: string
  /** Post-migration primary care column. */
  health?: number
  emotion?: number
  evolution?: number
  /** Legacy pre-migration columns kept as fallbacks. */
  hp?: number
  mood?: number
  dev_points?: number
  element_primary?: string | null
  element_secondary?: string | null
  str?: number
  dex?: number
  int?: number
  con?: number
  skill_loadout?: SkillLoadout | null
  skill_upgrade_points?: number
  last_bred_at?: string | null
  pending_growth_offers?: string[] | null
  feed_count?: number
  animation_state?: string
  is_active: boolean
  hatched_at: string | null
  created_at: string
}

type DbInventory = {
  item_type: string
  quantity: number
}

type DbMission = {
  mission_id: string
  progress: number
  completed: boolean
  reset_at: string
}

type DbActivity = {
  clicks: number
  keystrokes: number
  /** Post-migration name. */
  evolution_this_hour?: number
  /** Legacy name kept as fallback. */
  dev_points_this_hour?: number
  hour_started_at: string
  total_play_seconds: number
  daily_missions_completed_days: number
  last_daily_mission_day: string | null
  session_started_at: string
  last_saved: string
  save_version: number
  pet_slot_limit?: number
  quick_item_slots?: Array<ItemType | null> | null
  minigame_state?: MinigameSaveState | null
  gems?: number
  active_pet_id?: string | null
}

function normalizeMinigameStateFromDb(value: MinigameSaveState | null | undefined): MinigameSaveState {
  const base = createDefaultMinigameState()
  if (!value || typeof value !== 'object') return base
  return {
    day: typeof value.day === 'string' ? value.day : base.day,
    itemsEarnedToday: { ...base.itemsEarnedToday, ...(value.itemsEarnedToday ?? {}) },
    bestScores: { ...base.bestScores, ...(value.bestScores ?? {}) }
  }
}

function normalizeMinigameId(key: string): MinigameId | null {
  if (key === 'dino_jump' || key === 'rock_dodge') return key
  return null
}

function normalizeMinigameCounts(
  raw: Partial<Record<string, number>> | undefined
): Partial<Record<MinigameId, number>> {
  const next: Partial<Record<MinigameId, number>> = {}
  for (const [key, count] of Object.entries(raw ?? {})) {
    const gameId = normalizeMinigameId(key)
    if (!gameId || typeof count !== 'number') continue
    next[gameId] = count
  }
  return next
}

function minigameStateToDb(minigame: MinigameSaveState): MinigameSaveState {
  return {
    day: minigame.day,
    itemsEarnedToday: normalizeMinigameCounts(minigame.itemsEarnedToday),
    bestScores: normalizeMinigameCounts(minigame.bestScores)
  }
}

function normalizeItemType(type: string): ItemType {
  if (type === 'element_shield') return 'battle_shield'
  return type as ItemType
}

export function petToDbRow(pet: PetData, ownerId: string, isActive: boolean) {
  // Writes post-044 column names only (health/emotion/evolution + RPG fields).
  // Reads still accept legacy hp/mood/dev_points via petFromDbRow fallbacks.
  return {
    id: pet.id,
    owner_id: ownerId,
    name: pet.name,
    species: pet.character,
    gender: pet.gender,
    stage: pet.stage,
    health: pet.stats.health,
    emotion: pet.stats.emotion,
    evolution: pet.stats.evolution,
    element_primary: pet.elementPrimary,
    element_secondary: pet.elementSecondary,
    str: pet.primaries.str,
    dex: pet.primaries.dex,
    int: pet.primaries.int,
    con: pet.primaries.con,
    skill_loadout: pet.skillLoadout,
    skill_upgrade_points: pet.skillUpgradePoints,
    pending_growth_offers: pet.pendingGrowthOffers,
    last_bred_at: pet.lastBredAt,
    feed_count: pet.feedCount,
    animation_state: pet.animationState,
    is_active: isActive,
    hatched_at: pet.hatchedAt,
    created_at: pet.createdAt
  }
}

export function petFromDbRow(row: DbPet): PetData {
  const health = row.health ?? row.hp ?? 100
  const emotion = row.emotion ?? row.mood ?? 80
  const evolution = row.evolution ?? row.dev_points ?? 0
  return normalizePetData({
    id: row.id,
    name: row.name,
    character: normalizePetSpecies(row.species),
    gender: row.gender as Gender,
    stage: row.stage as Stage,
    stats: {
      health,
      emotion,
      evolution
    },
    primaries:
      row.str != null || row.dex != null || row.int != null || row.con != null
        ? {
            str: row.str ?? 20,
            dex: row.dex ?? 20,
            int: row.int ?? 20,
            con: row.con ?? 20
          }
        : undefined,
    elementPrimary: (row.element_primary ?? null) as ElementId | null,
    elementSecondary: (row.element_secondary ?? null) as ElementId | null,
    skillLoadout: row.skill_loadout ?? null,
    skillUpgradePoints: row.skill_upgrade_points ?? 0,
    pendingGrowthOffers: (row.pending_growth_offers ?? null) as GrowthCardId[] | null,
    lastBredAt: row.last_bred_at ?? null,
    hatchedAt: row.hatched_at,
    createdAt: row.created_at,
    animationState: (row.animation_state ?? 'idle') as AnimationState,
    feedCount: row.feed_count ?? 0
  } as PetData & Record<string, unknown>)
}

export function gameSaveToDbPayload(userId: string, save: GameSave) {
  const pets = [
    ...(save.pet ? [petToDbRow(save.pet, userId, true)] : []),
    ...save.collection.map((pet) => petToDbRow(pet, userId, false))
  ]

  return {
    pets,
    inventory: save.inventory.map((item) => ({
      user_id: userId,
      item_type: item.type,
      quantity: item.quantity
    })),
    missions: save.missions.map((m) => ({
      user_id: userId,
      mission_id: m.missionId,
      progress: m.progress,
      completed: m.completed,
      reset_at: m.resetAt
    })),
    activity: {
      user_id: userId,
      clicks: save.activity.clicks,
      keystrokes: save.activity.keystrokes,
      evolution_this_hour: save.activity.evolutionThisHour,
      hour_started_at: save.activity.hourStartedAt,
      total_play_seconds: save.totalPlaySeconds,
      daily_missions_completed_days: save.dailyMissionsCompletedDays,
      last_daily_mission_day: save.lastDailyMissionDay,
      session_started_at: save.sessionStartedAt,
      last_saved: save.lastSaved,
      save_version: save.version,
      pet_slot_limit: save.petSlotLimit,
      quick_item_slots: save.quickItemSlots,
      minigame_state: minigameStateToDb(save.minigame ?? createDefaultMinigameState()),
      gems: save.gems,
      active_pet_id: save.pet?.id ?? null
    }
  }
}

export function gameSaveFromDbParts(
  pets: DbPet[],
  inventory: DbInventory[],
  missions: DbMission[],
  activity: DbActivity | null
): GameSave {
  const base = createDefaultSave()
  const activeId = activity?.active_pet_id ?? null
  const activeRow =
    (activeId ? pets.find((p) => p.id === activeId) : undefined) ??
    pets.find((p) => p.is_active) ??
    null
  const collectionRows = pets.filter((p) => p.id !== activeRow?.id)

  return {
    version: activity?.save_version ?? SAVE_VERSION,
    pet: activeRow ? petFromDbRow(activeRow) : null,
    collection: collectionRows.map(petFromDbRow),
    petSlotLimit: clampSlotLimit(activity?.pet_slot_limit ?? PET_SLOT_BASE),
    gems: activity?.gems ?? 0,
    quickItemSlots: activity?.quick_item_slots ?? base.quickItemSlots,
    inventory: inventory.map(
      (row): InventoryItem => ({
        type: normalizeItemType(row.item_type),
        quantity: row.quantity
      })
    ),
    missions: missions.map(
      (row): MissionProgress => ({
        missionId: row.mission_id,
        progress: row.progress,
        completed: row.completed,
        resetAt: row.reset_at
      })
    ),
    activity: activity
      ? {
          clicks: activity.clicks,
          keystrokes: activity.keystrokes,
          evolutionThisHour: activity.evolution_this_hour ?? activity.dev_points_this_hour ?? 0,
          hourStartedAt: activity.hour_started_at
        }
      : base.activity,
    sessionStartedAt: activity?.session_started_at ?? base.sessionStartedAt,
    lastSaved: activity?.last_saved ?? new Date().toISOString(),
    totalPlaySeconds: activity?.total_play_seconds ?? 0,
    dailyMissionsCompletedDays: activity?.daily_missions_completed_days ?? 0,
    lastDailyMissionDay: activity?.last_daily_mission_day ?? null,
    minigame: normalizeMinigameStateFromDb(activity?.minigame_state)
  }
}
