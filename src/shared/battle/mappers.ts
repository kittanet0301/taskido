import type {
  BattleRoom,
  BattleRoomMember,
  BattleRoomSummary,
  BattleSession,
  BattleTurn
} from './types'
import type { Gender, PetData, Stage } from '../types'
import { normalizePetSpecies } from '../creatureCharacters'
import { normalizePetData } from '../petNormalize'

function str(v: unknown): string {
  return String(v ?? '')
}

function num(v: unknown): number {
  return Number(v ?? 0)
}

function bool(v: unknown): boolean {
  return Boolean(v)
}

export function mapBattleSession(row: Record<string, unknown>): BattleSession {
  const challengerTp = num(row.challenger_tp ?? row.challenger_energy ?? 0)
  const defenderTp = num(row.defender_tp ?? row.defender_energy ?? 0)
  return {
    id: str(row.id),
    roomId: row.room_id ? str(row.room_id) : null,
    challengerUserId: str(row.challenger_user_id),
    defenderUserId: str(row.defender_user_id),
    challengerPetId: str(row.challenger_pet_id),
    defenderPetId: str(row.defender_pet_id),
    challengerHp: num(row.challenger_hp),
    defenderHp: num(row.defender_hp),
    challengerHpStart: num(row.challenger_hp_start),
    defenderHpStart: num(row.defender_hp_start),
    challengerMp: num(row.challenger_mp ?? 0),
    defenderMp: num(row.defender_mp ?? 0),
    challengerTp,
    defenderTp,
    challengerEnergy: challengerTp,
    defenderEnergy: defenderTp,
    challengerDefending: bool(row.challenger_defending),
    defenderDefending: bool(row.defender_defending),
    challengerAvoiding: bool(row.challenger_avoiding),
    defenderAvoiding: bool(row.defender_avoiding),
    status: row.status as BattleSession['status'],
    turnUserId: row.turn_user_id ? str(row.turn_user_id) : null,
    winnerUserId: row.winner_user_id ? str(row.winner_user_id) : null,
    fledUserId: row.fled_user_id ? str(row.fled_user_id) : null,
    expiresAt: row.expires_at ? str(row.expires_at) : null,
    createdAt: str(row.created_at)
  }
}

export function mapBattleTurn(row: Record<string, unknown>): BattleTurn {
  return {
    id: str(row.id),
    sessionId: str(row.session_id),
    actorUserId: str(row.actor_user_id),
    action: row.action as BattleTurn['action'],
    skillId: row.skill_id != null ? str(row.skill_id) : null,
    damage: num(row.damage),
    challengerHpAfter: num(row.challenger_hp_after),
    defenderHpAfter: num(row.defender_hp_after),
    message: str(row.message),
    createdAt: str(row.created_at)
  }
}

export function mapBattleRoom(row: Record<string, unknown>): BattleRoom {
  return {
    id: str(row.id),
    hostUserId: str(row.host_user_id),
    roomCode: str(row.room_code),
    name: str(row.name),
    visibility: row.visibility as BattleRoom['visibility'],
    status: row.status as BattleRoom['status'],
    maxMembers: num(row.max_members),
    activeSessionId: row.active_session_id ? str(row.active_session_id) : null,
    selectedOpponentUserId: row.selected_opponent_user_id ? str(row.selected_opponent_user_id) : null,
    createdAt: str(row.created_at),
    expiresAt: row.expires_at ? str(row.expires_at) : null
  }
}

export function mapBattleRoomMember(row: Record<string, unknown>): BattleRoomMember {
  return {
    roomId: str(row.room_id),
    userId: str(row.user_id),
    username: str(row.username),
    role: row.role as BattleRoomMember['role'],
    status: row.status as BattleRoomMember['status'],
    joinedAt: str(row.joined_at)
  }
}

/** Maps a raw `pets` table row into PetData for battle sprite rendering. */
export function mapPetRowToPetData(row: Record<string, unknown>): PetData {
  return normalizePetData({
    id: str(row.id),
    name: str(row.name) || 'Pet',
    character: normalizePetSpecies(str(row.species)),
    gender: (row.gender as Gender) === 'female' ? 'female' : 'male',
    stage: (row.stage as Stage) ?? 'baby',
    stats: {
      health: num(row.health ?? row.hp),
      emotion: num(row.emotion ?? row.mood),
      evolution: num(row.evolution ?? row.dev_points)
    },
    primaries: {
      str: num(row.str ?? 20),
      dex: num(row.dex ?? 20),
      int: num(row.int ?? 20),
      con: num(row.con ?? 20)
    },
    elementPrimary: row.element_primary ?? row.element ?? 'neutral',
    elementSecondary: row.element_secondary ?? null,
    skillLoadout: row.skill_loadout ?? null,
    skillUpgradePoints: num(row.skill_upgrade_points ?? 0),
    pendingGrowthOffers: Array.isArray(row.pending_growth_offers)
      ? (row.pending_growth_offers as string[])
      : null,
    lastBredAt: row.last_bred_at ? str(row.last_bred_at) : null,
    hatchedAt: row.hatched_at ? str(row.hatched_at) : null,
    createdAt: str(row.created_at) || new Date().toISOString(),
    animationState: 'idle',
    feedCount: 0
  } as PetData & Record<string, unknown>)
}

export function mapBattleRoomSummary(row: Record<string, unknown>): BattleRoomSummary {
  return {
    id: str(row.id),
    roomCode: str(row.room_code),
    name: str(row.name),
    hostUsername: str(row.host_username),
    memberCount: num(row.member_count),
    waitingCount: num(row.waiting_count),
    createdAt: str(row.created_at)
  }
}
