import type { CreatureSpecies } from './creatureCharacters'
import type { ElementId } from './elements'
import type { PrimaryStats, GrowthCardId } from './combatStats'
import type { SkillLoadout } from './battle/skillTrees'

export type { CreatureSpecies } from './creatureCharacters'
export { CREATURE_SPECIES } from './creatureCharacters'
export type { ElementId } from './elements'
export type { PrimaryStats, GrowthCardId, GrowthCard } from './combatStats'
export type { SkillLoadout, SkillSlot } from './battle/skillTrees'

export type PetSpecies = CreatureSpecies

export type Gender = 'male' | 'female'
export type Stage = 'egg' | 'baby' | 'adult'
export type AnimationState =
  | 'egg_idle'
  | 'egg_hatch'
  | 'idle'
  | 'walk_left'
  | 'walk_right'
  | 'eat'
  | 'sleep'
  | 'sick'
  | 'happy'
  | 'sad'
  | 'battle_attack'
  | 'battle_hurt'
  | 'evolve'

export type ItemType =
  | 'food_basic'
  | 'food_premium'
  | 'medicine'
  | 'water'
  | 'toy'
  | 'dev_vitamin'
  | 'battle_shield'
  | 'breed_nest'
  | 'skill_forget'

export type MinigameId = 'dino_jump' | 'rock_dodge'

export interface MinigameSaveState {
  /** YYYY-MM-DD local calendar day for daily item reward quota */
  day: string | null
  itemsEarnedToday: Partial<Record<MinigameId, number>>
  bestScores: Partial<Record<MinigameId, number>>
}

/** Care stats — not used in combat damage formulas. */
export interface PetStats {
  health: number
  emotion: number
  evolution: number
  /** @deprecated use health */
  hp?: number
  /** @deprecated use emotion */
  mood?: number
  /** @deprecated use evolution */
  devPoints?: number
}

export interface PetData {
  id: string
  name: string
  character: PetSpecies
  gender: Gender
  stage: Stage
  stats: PetStats
  /** Combat primaries — set at egg create from element table */
  primaries: PrimaryStats
  elementPrimary: ElementId
  elementSecondary: ElementId | null
  skillLoadout: SkillLoadout | null
  skillUpgradePoints: number
  /** Pending growth-card offer ids awaiting a pick (usually 3 at a time). */
  pendingGrowthOffers: GrowthCardId[] | null
  lastBredAt: string | null
  hatchedAt: string | null
  createdAt: string
  animationState: AnimationState
  feedCount: number
}

export interface InventoryItem {
  type: ItemType
  quantity: number
}

export interface MissionProgress {
  missionId: string
  progress: number
  completed: boolean
  resetAt: string
}

export interface ActivityCounters {
  clicks: number
  keystrokes: number
  /** Evolution points earned this hour (renamed from devPointsThisHour) */
  evolutionThisHour: number
  hourStartedAt: string
  /** @deprecated use evolutionThisHour */
  devPointsThisHour?: number
}

export interface GameSave {
  version: number
  pet: PetData | null
  /** Inactive pets/eggs stored in collection slots. */
  collection: PetData[]
  /** Max pet slots (base 5, up to 36 via missions / market). */
  petSlotLimit: number
  /** Soft currency, earned from mission claims. */
  gems: number
  inventory: InventoryItem[]
  quickItemSlots: Array<ItemType | null>
  missions: MissionProgress[]
  activity: ActivityCounters
  sessionStartedAt: string
  lastSaved: string
  totalPlaySeconds: number
  dailyMissionsCompletedDays: number
  /** Local calendar day (YYYY-MM-DD) when a daily mission was last claimed. */
  lastDailyMissionDay: string | null
  minigame: MinigameSaveState
}

export type UserRole = 'user' | 'admin'

export interface Profile {
  id: string
  username: string
  friendCode: string
  createdAt: string
  role: UserRole
}

export interface FriendRequest {
  id: string
  userId: string
  friendId: string
  status: 'pending' | 'accepted'
  username: string
}

export type {
  BattleActionType,
  BattleCommand,
  BattleSessionStatus,
  BattleRoomStatus,
  BattleRoomVisibility,
  BattleRoomMemberStatus,
  BattleRoomMemberRole,
  BattleCombatant,
  BattleSession,
  BattleTurn,
  BattleRoom,
  BattleRoomMember,
  BattleRoomSummary,
  BattleSessionState,
  ApplyActionResult,
  LegacyBattleAction,
  BattleResult
} from './battle/types'

/** @deprecated Use BattleActionType */
export type BattleAction = import('./battle/types').LegacyBattleAction

export interface ChatMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  createdAt: string
}

export interface HatchResult {
  character: PetSpecies
  gender: Gender
}
