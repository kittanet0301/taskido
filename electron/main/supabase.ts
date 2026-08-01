import { app } from 'electron'
import { createClient, type SupportedStorage, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import WebSocket from 'ws'
import { formatApiError } from '../../src/shared/formatError'
import { createSupabaseService } from '../../src/shared/supabaseService'

const AUTH_STORAGE_FILE = 'supabase-auth.json'

let client: SupabaseClient | null = null

function getAuthStoragePath(): string {
  return join(app.getPath('userData'), AUTH_STORAGE_FILE)
}

function createFileAuthStorage(): SupportedStorage {
  const memory = new Map<string, string>()
  let loaded = false

  const ensureLoaded = () => {
    if (loaded) return
    loaded = true
    try {
      const path = getAuthStoragePath()
      if (!existsSync(path)) return
      const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, string>
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') memory.set(key, value)
      }
    } catch {
      // ignore corrupt storage; start clean
    }
  }

  const persist = () => {
    try {
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const obj: Record<string, string> = {}
      for (const [key, value] of memory.entries()) obj[key] = value
      writeFileSync(getAuthStoragePath(), JSON.stringify(obj), 'utf-8')
    } catch {
      // non-fatal: session still works in-memory for this process
    }
  }

  return {
    getItem: (key) => {
      ensureLoaded()
      return memory.get(key) ?? null
    },
    setItem: (key, value) => {
      ensureLoaded()
      memory.set(key, value)
      persist()
    },
    removeItem: (key) => {
      ensureLoaded()
      memory.delete(key)
      persist()
    }
  }
}

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, {
    auth: {
      storage: createFileAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    realtime: {
      transport: WebSocket as unknown as typeof globalThis.WebSocket
    }
  })
  return client
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null
}

export const {
  signUp,
  signIn,
  signOut,
  updatePassword,
  resetPasswordByBirthdate,
  getSession,
  getProfile,
  updateProfile,
  adminListPlayers,
  adminGrantGems,
  adminGrantItem,
  adminDeleteUser,
  syncPetToCloud,
  getActivePet,
  searchProfileByFriendCode,
  sendFriendRequest,
  respondFriendRequest,
  listFriends,
  listPendingRequests,
  getFriendPet,
  setActivePet,
  createBattleRoom,
  joinBattleRoom,
  leaveBattleRoom,
  forfeitBattleRoom,
  listPublicRooms,
  getBattleRoom,
  getRoomMembers,
  selectRoomOpponent,
  startRoomDuel,
  submitBattleAction,
  listBattles,
  getBattleTurns,
  subscribeToBattles,
  subscribeToBattleRoom,
  listChatRooms,
  joinChatRoom,
  leaveChatRoom,
  getChatRoomMembers,
  sendChatRoomMessage,
  updateChatRoomPosition,
  subscribeToChatRoom,
  syncInventory,
  syncMissions,
  submitMinigameScore,
  getMinigameLeaderboard,
  sendGift,
  listPendingGifts,
  claimPendingGifts
} = createSupabaseService({
  getSupabase,
  formatError: formatApiError
})
