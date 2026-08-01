/** Basic Attack power (no skill) */
export const BASE_ATTACK_POWER = 20

/** Defend free stance reduction */
export const DEFEND_REDUCTION = 0.5

/** battle_shield item extra reduction when used via Item menu */
export const SHIELD_ITEM_REDUCTION = 0.5

/** Session-only consumables used by bot battles (never persisted to inventory). */
export const BATTLE_HEALTH_POTION_HEAL = 90
export const BATTLE_MANA_POTION_RESTORE = 60

export const TP_MAX = 100
export const TP_GAIN_ATTACK_MIN = 15
export const TP_GAIN_ATTACK_MAX = 30
export const TP_GAIN_SKILL_MIN = 10
export const TP_GAIN_SKILL_MAX = 25
export const TP_GAIN_DEFEND_MIN = 10
export const TP_GAIN_DEFEND_MAX = 20

/** @deprecated legacy move bases — kept for old tests / migration notes */
export const BASE_BITE = 15
export const BASE_JUMP = 22
export const BASE_TAILWHIP = 10
export const BASE_ULTIMATE = 30
export const SHIELD_REDUCTION = 0.5
export const TAILWHIP_VS_SHIELD_REDUCTION = 0.75
export const AVOID_DODGE_CHANCE = 0.35
export const ULTIMATE_ENERGY_MAX = 100

export const ENERGY_GAIN_BITE_MIN = 15
export const ENERGY_GAIN_BITE_MAX = 35
export const ENERGY_GAIN_JUMP_MIN = 20
export const ENERGY_GAIN_JUMP_MAX = 40
export const ENERGY_GAIN_TAILWHIP_MIN = 10
export const ENERGY_GAIN_TAILWHIP_MAX = 25
export const ENERGY_GAIN_SHIELD_MIN = 10
export const ENERGY_GAIN_SHIELD_MAX = 30
export const ENERGY_GAIN_AVOID_MIN = 5
export const ENERGY_GAIN_AVOID_MAX = 15

export const BATTLE_MIN_HP = 10
export const REWARD_WIN_EMOTION = 5
export const REWARD_LOSE_HEALTH = 0
export const REWARD_FLEE_EMOTION = 3
/** @deprecated */
export const REWARD_WIN_MOOD = REWARD_WIN_EMOTION
/** @deprecated */
export const REWARD_LOSE_HP = REWARD_LOSE_HEALTH
/** @deprecated */
export const REWARD_FLEE_MOOD = REWARD_FLEE_EMOTION

export const STAT_MIN = 0
export const STAT_MAX = 100
export const CHALLENGE_EXPIRE_DAYS = 7
export const ROOM_MAX_MEMBERS = 8
export const ROOM_IDLE_MINUTES = 30
export const BREED_COOLDOWN_MS = 6 * 60 * 60 * 1000
