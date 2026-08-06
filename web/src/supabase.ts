import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { formatApiError } from '@shared/formatError'
import { createSupabaseService } from '@shared/supabaseService'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  if (!url || !key) return null
  client = createClient(url, key)
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
  getGameSpeed,
  setGameSpeed,
  subscribeToGameSpeed,
  syncPetToCloud,
  getActivePet,
  searchProfileByFriendCode,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
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
