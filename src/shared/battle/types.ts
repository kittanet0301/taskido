/**
 * New RPG commands (Attack / Skill / Item / Defend).
 * Legacy bite/jump/... kept so historical battle_turns rows still type-check.
 */
export type BattleCommand = 'attack' | 'skill' | 'item' | 'defend' | 'flee'

export type BattleActionType =
  | BattleCommand
  | 'bite'
  | 'jump'
  | 'tailwhip'
  | 'shield'
  | 'avoid'
  | 'ultimate'
  | 'attack'
  | 'defend'

export type BattleSessionStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'declined'
  | 'fled'
  | 'expired'

export type BattleRoomStatus = 'open' | 'closed'
export type BattleRoomVisibility = 'public'
export type BattleRoomMemberStatus = 'waiting' | 'in_battle' | 'left'
export type BattleRoomMemberRole = 'host' | 'member'

export interface BattleCombatant {
  userId: string
  petId: string
  name: string
  character: string
  hp: number
  hpStart: number
  /** Magic points */
  mp: number
  mpStart: number
  /** Technique / ultimate gauge 0–100 (replaces energy) */
  tp: number
  defending: boolean
  avoiding: boolean
  str: number
  dex: number
  int: number
  con: number
  elementPrimary: string
  elementSecondary: string | null
}

export interface BattleSession {
  id: string
  roomId: string | null
  challengerUserId: string
  defenderUserId: string
  challengerPetId: string
  defenderPetId: string
  challengerHp: number
  defenderHp: number
  challengerHpStart: number
  defenderHpStart: number
  challengerMp: number
  defenderMp: number
  challengerTp: number
  defenderTp: number
  /** @deprecated mapped from tp for older clients */
  challengerEnergy: number
  defenderEnergy: number
  challengerDefending: boolean
  defenderDefending: boolean
  challengerAvoiding: boolean
  defenderAvoiding: boolean
  status: BattleSessionStatus
  turnUserId: string | null
  winnerUserId: string | null
  fledUserId: string | null
  expiresAt: string | null
  createdAt: string
}

export interface BattleTurn {
  id: string
  sessionId: string
  actorUserId: string
  action: BattleActionType
  /** Optional skill path id when action is skill */
  skillId?: string | null
  damage: number
  challengerHpAfter: number
  defenderHpAfter: number
  message: string
  createdAt: string
}

export interface BattleRoom {
  id: string
  hostUserId: string
  roomCode: string
  name: string
  visibility: BattleRoomVisibility
  status: BattleRoomStatus
  maxMembers: number
  activeSessionId: string | null
  selectedOpponentUserId: string | null
  createdAt: string
  expiresAt: string | null
}

export interface BattleRoomMember {
  roomId: string
  userId: string
  username: string
  role: BattleRoomMemberRole
  status: BattleRoomMemberStatus
  joinedAt: string
}

export interface BattleRoomSummary {
  id: string
  roomCode: string
  name: string
  hostUsername: string
  memberCount: number
  waitingCount: number
  createdAt: string
}

/** In-memory battle state for engine preview / tests */
export interface BattleSessionState {
  sessionId: string
  challenger: BattleCombatant
  defender: BattleCombatant
  turnUserId: string
  status: BattleSessionStatus
  winnerUserId: string | null
  fledUserId: string | null
}

export interface ApplyActionResult {
  state: BattleSessionState
  damage: number
  logMessage: string
  finished: boolean
}

/** @deprecated Use BattleCommand */
export type LegacyBattleAction = { type: 'attack' | 'defend' | 'skill' }

export interface BattleResult {
  winnerPetId: string
  log: string[]
  challengerHp: number
  defenderHp: number
}

/** Payload for submitting a turn */
export interface BattleActionPayload {
  command: BattleCommand
  skillId?: string
  itemType?: string
}
