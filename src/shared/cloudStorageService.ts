import type { GameSave } from './types'
import { createDefaultSave } from './growth'
import { gameSaveFromDbParts, gameSaveToDbPayload } from './dbMapper'
import { applyMoodDecay } from './stats'
import { applyDailyResets, ensureAllMissions } from './missions'
import { applyMinigameDailyReset } from './minigame'
import type { SupabaseGetter } from './supabaseService'

interface CloudStorageOptions {
  getSupabase: SupabaseGetter
  isSupabaseConfigured: () => boolean
}

export interface SaveGameOptions {
  /** When true, leave the inventory table untouched (activity autosaves must not wipe claimed gifts). */
  skipInventory?: boolean
}

export function createCloudStorageService({
  getSupabase,
  isSupabaseConfigured
}: CloudStorageOptions) {
  async function loadGameSaveFromDb(userId: string): Promise<GameSave | null> {
    const supabase = getSupabase()
    if (!supabase) return null

    const [petsRes, invRes, missionRes, activityRes] = await Promise.all([
      supabase.from('pets').select('*').eq('owner_id', userId),
      supabase.from('inventory').select('item_type, quantity').eq('user_id', userId),
      supabase.from('mission_progress').select('mission_id, progress, completed, reset_at').eq('user_id', userId),
      supabase.from('player_activity').select('*').eq('user_id', userId).maybeSingle()
    ])

    if (petsRes.error) throw petsRes.error
    if (invRes.error) throw invRes.error
    if (missionRes.error) throw missionRes.error
    if (activityRes.error) throw activityRes.error

    const hasData =
      (petsRes.data?.length ?? 0) > 0 ||
      (invRes.data?.length ?? 0) > 0 ||
      (missionRes.data?.length ?? 0) > 0 ||
      activityRes.data

    if (!hasData) return null

    let save = gameSaveFromDbParts(
      petsRes.data ?? [],
      invRes.data ?? [],
      missionRes.data ?? [],
      activityRes.data
    )

    save.missions = ensureAllMissions(save.missions)
    // Empty inventory is valid (player used everything). Do not refill defaults on load.

    return applyOfflineDecay(save)
  }

  async function saveGameSaveToDb(
    userId: string,
    save: GameSave,
    options?: SaveGameOptions
  ): Promise<GameSave> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    const skipInventory = options?.skipInventory === true
    const payload = gameSaveToDbPayload(userId, {
      ...save,
      lastSaved: new Date().toISOString()
    })

    const keptIds = new Set(payload.pets.map((p) => p.id))

    const { data: existingPets, error: listError } = await supabase
      .from('pets')
      .select('id')
      .eq('owner_id', userId)
    if (listError) throw listError

    for (const row of existingPets ?? []) {
      if (!keptIds.has(row.id)) {
        const { error } = await supabase.from('pets').delete().eq('id', row.id)
        if (error) throw error
      }
    }

    if (payload.pets.length > 0) {
      // Deactivate first, then activate — avoids unique index pets_one_active_per_owner
      // failing when swapping which pet is the main/playing one.
      const inactivePets = payload.pets.filter((p) => !p.is_active)
      const activePets = payload.pets.filter((p) => p.is_active)
      if (inactivePets.length > 0) {
        const { error } = await supabase.from('pets').upsert(inactivePets, { onConflict: 'id' })
        if (error) throw error
      }
      if (activePets.length > 0) {
        const { error } = await supabase.from('pets').upsert(activePets, { onConflict: 'id' })
        if (error) throw error
      }
    }

    if (!skipInventory) {
      const { error: invDeleteError } = await supabase.from('inventory').delete().eq('user_id', userId)
      if (invDeleteError) throw invDeleteError
      if (payload.inventory.length > 0) {
        const { error } = await supabase.from('inventory').insert(payload.inventory)
        if (error) throw error
      }
    }

    if (payload.missions.length > 0) {
      const { error } = await supabase.from('mission_progress').upsert(payload.missions, {
        onConflict: 'user_id,mission_id'
      })
      if (error) throw error
    }

    const { error: activityError } = await supabase
      .from('player_activity')
      .upsert(payload.activity, { onConflict: 'user_id' })
    if (activityError) throw activityError

    return { ...save, lastSaved: payload.activity.last_saved ?? save.lastSaved }
  }

  async function bootstrapGameSaveInDb(userId: string, save?: GameSave): Promise<GameSave> {
    const initial = save ?? createDefaultSave()
    return saveGameSaveToDb(userId, initial)
  }

  async function resetGameDataInDb(userId: string): Promise<GameSave> {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')

    const { error: chatLeaveError } = await supabase.rpc('chat_room_leave_all')
    if (chatLeaveError) throw chatLeaveError

    const { error: deletePetsError } = await supabase.from('pets').delete().eq('owner_id', userId)
    if (deletePetsError) throw deletePetsError

    const { error: invError } = await supabase.from('inventory').delete().eq('user_id', userId)
    if (invError) throw invError

    const { error: missionError } = await supabase.from('mission_progress').delete().eq('user_id', userId)
    if (missionError) throw missionError

    const { error: activityError } = await supabase.from('player_activity').delete().eq('user_id', userId)
    if (activityError) throw activityError

    const { error: giftSenderError } = await supabase.from('gifts').delete().eq('sender_id', userId)
    if (giftSenderError) throw giftSenderError

    const { error: giftRecipientError } = await supabase.from('gifts').delete().eq('recipient_id', userId)
    if (giftRecipientError) throw giftRecipientError

    const { error: scoreError } = await supabase.from('minigame_scores').delete().eq('user_id', userId)
    if (scoreError) throw scoreError

    const fresh = createDefaultSave()
    return saveGameSaveToDb(userId, fresh)
  }

  function applyOfflineDecay(save: GameSave): GameSave {
    const lastSaved = new Date(save.lastSaved).getTime()
    const hoursAway = (Date.now() - lastSaved) / 3_600_000
    let next = applyDailyResets(save)
    next = applyMinigameDailyReset(next)
    if (next.pet && hoursAway > 0.1) {
      next.pet = {
        ...next.pet,
        stats: applyMoodDecay(next.pet.stats, hoursAway)
      }
    }
    return next
  }

  return {
    loadGameSaveFromDb,
    saveGameSaveToDb,
    bootstrapGameSaveInDb,
    resetGameDataInDb,
    canUseCloudStorage: () => isSupabaseConfigured()
  }
}
