import type { SupabaseClient } from '@supabase/supabase-js'

export type SupabaseGetter = () => SupabaseClient | null

interface ServiceOptions {
  getSupabase: SupabaseGetter
  formatError?: (error: unknown) => string
}

function defaultFormatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error_description === 'string') return obj.error_description
  }
  return String(error)
}

export function createSupabaseService({ getSupabase, formatError = defaultFormatError }: ServiceOptions) {
  function requireSupabase(): SupabaseClient {
    const supabase = getSupabase()
    if (!supabase) throw new Error('Supabase not configured')
    return supabase
  }

  function rpcError(error: unknown): never {
    throw new Error(formatError(error))
  }

  function generateFriendCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase()
  }

  function isUserBattleSession(row: Record<string, unknown> | undefined, userId: string): boolean {
    if (!row) return false
    return row.challenger_user_id === userId || row.defender_user_id === userId
  }

  async function signUp(email: string, password: string, username: string) {
    const supabase = requireSupabase()
    const trimmedEmail = email.trim()
    const trimmedUsername = username.trim()

    if (!trimmedEmail) throw new Error('Email required')
    if (!trimmedUsername) throw new Error('Username required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error('Invalid email')
    }

    const { data: availability, error: checkError } = await supabase.rpc('check_signup_availability', {
      p_email: trimmedEmail,
      p_username: trimmedUsername
    })
    if (checkError) rpcError(checkError)

    const row = (Array.isArray(availability) ? availability[0] : availability) as
      | { email_taken?: boolean; username_taken?: boolean }
      | null
      | undefined
    if (row?.email_taken) throw new Error('User already registered')
    if (row?.username_taken) throw new Error('profiles_username_key')

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { username: trimmedUsername } }
    })
    if (error) rpcError(error)
    if (!data.user) throw new Error('No user returned')

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      username: trimmedUsername,
      friend_code: generateFriendCode()
    })
    if (profileError) rpcError(profileError)
    return data
  }

  async function signIn(email: string, password: string) {
    const supabase = requireSupabase()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) throw new Error('Email required')
    if (!password) throw new Error('Password required')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password
    })
    if (error) rpcError(error)
    return data
  }

  async function signOut() {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function updatePassword(password: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) rpcError(error)
  }

  async function resetPasswordByBirthdate(email: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) rpcError(error)
  }

  async function getSession() {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session
  }

  async function getProfile(userId: string) {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (error) rpcError(error)
    return data
  }

  async function adminListPlayers() {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('admin_list_players')
    if (error) rpcError(error)
    return (data ?? []) as Array<{
      id: string
      username: string
      friend_code: string
      role: string
      gems: number
    }>
  }

  async function adminGrantGems(targetId: string, amount: number) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('admin_grant_gems', {
      p_target_id: targetId,
      p_amount: amount
    })
    if (error) rpcError(error)
    return data as number
  }

  async function adminGrantItem(targetId: string, itemType: string, qty: number) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('admin_grant_item', {
      p_target_id: targetId,
      p_item_type: itemType,
      p_qty: qty
    })
    if (error) rpcError(error)
    return data as number
  }

  async function adminDeleteUser(targetId: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('admin_delete_user', { p_target_id: targetId })
    if (error) rpcError(error)
  }

  async function updateProfile(userId: string, fields: { username?: string }) {
    const supabase = requireSupabase()
    const patch: { username?: string } = {}
    if (fields.username !== undefined) {
      const trimmed = fields.username.trim()
      if (!trimmed) throw new Error('Username required')
      patch.username = trimmed
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select()
      .single()
    if (error) rpcError(error)
    return data
  }

  async function syncPetToCloud(userId: string, pet: Record<string, unknown>) {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('pets')
      .upsert({ ...pet, owner_id: userId, is_active: true }, { onConflict: 'id' })
      .select()
      .single()
    if (error) rpcError(error)
    return data
  }

  async function getActivePet(userId: string) {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) rpcError(error)
    return data
  }

  async function searchProfileByFriendCode(friendCode: string) {
    const supabase = getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('friend_code', friendCode.toUpperCase())
      .maybeSingle()
    if (error) rpcError(error)
    return data
  }

  async function sendFriendRequest(userId: string, friendId: string) {
    const supabase = requireSupabase()
    const { data: rows, error: findError } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
      )
    if (findError) rpcError(findError)

    const existing = rows ?? []
    if (existing.some((row) => row.status === 'accepted')) throw new Error('Already friends')

    const pendingFromThem = existing.find(
      (row) => row.status === 'pending' && row.friend_id === userId
    )
    if (pendingFromThem) {
      const { data, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', pendingFromThem.id)
        .select()
        .single()
      if (error) rpcError(error)
      return data
    }

    const pendingFromMe = existing.find(
      (row) => row.status === 'pending' && row.user_id === userId
    )
    if (pendingFromMe) throw new Error('Request already sent')

    const rejected = existing.find((row) => row.status === 'rejected')
    if (rejected) {
      const { data, error } = await supabase
        .from('friendships')
        .update({ user_id: userId, friend_id: friendId, status: 'pending' })
        .eq('id', rejected.id)
        .select()
        .single()
      if (error) rpcError(error)
      return data
    }

    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
      .select()
      .single()
    if (error) rpcError(error)
    return data
  }

  async function respondFriendRequest(requestId: string, accept: boolean) {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('id', requestId)
      .select()
      .single()
    if (error) rpcError(error)
    return data
  }

  async function listFriends(userId: string) {
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    if (error) rpcError(error)
    const rows = data ?? []
    const byFriend = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id
      if (!byFriend.has(otherId)) byFriend.set(otherId, row)
    }
    return Promise.all(
      [...byFriend.entries()].map(async ([otherId, row]) => {
        const profile = await getProfile(otherId)
        return { ...row, friend_id: otherId, profiles: profile }
      })
    )
  }

  async function listPendingRequests(userId: string) {
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, status')
      .eq('friend_id', userId)
      .eq('status', 'pending')
    if (error) rpcError(error)
    const rows = data ?? []
    return Promise.all(
      rows.map(async (row) => {
        const profile = await getProfile(row.user_id)
        return { ...row, profiles: profile }
      })
    )
  }

  async function getFriendPet(ownerId: string) {
    const supabase = getSupabase()
    if (!supabase) return null

    const { data: activity, error: activityError } = await supabase
      .from('player_activity')
      .select('active_pet_id')
      .eq('user_id', ownerId)
      .maybeSingle()
    if (activityError) rpcError(activityError)

    const activePetId = activity?.active_pet_id as string | null | undefined
    if (activePetId) {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('id', activePetId)
        .eq('owner_id', ownerId)
        .maybeSingle()
      if (error) rpcError(error)
      if (data) return data
    }

    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .maybeSingle()
    if (error) rpcError(error)
    return data
  }

  async function createBattleRoom(name?: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('room_create', { p_name: name ?? null })
    if (error) rpcError(error)
    return data
  }

  async function joinBattleRoom(roomCode: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('room_join', { p_room_code: roomCode })
    if (error) rpcError(error)
    return data
  }

  async function leaveBattleRoom(roomId: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('room_leave', { p_room_id: roomId })
    if (error) rpcError(error)
  }

  async function forfeitBattleRoom(roomId: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('room_forfeit', { p_room_id: roomId })
    if (error) rpcError(error)
  }

  async function listPublicRooms() {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('room_list_public')
    if (error) rpcError(error)
    return data ?? []
  }

  async function getBattleRoom(roomId: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase
      .from('battle_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle()
    if (error) rpcError(error)
    return data
  }

  async function getRoomMembers(roomId: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('room_get_members', { p_room_id: roomId })
    if (error) rpcError(error)
    return data ?? []
  }

  async function selectRoomOpponent(roomId: string, opponentUserId: string | null) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('room_select_opponent', {
      p_room_id: roomId,
      p_opponent_user_id: opponentUserId
    })
    if (error) rpcError(error)
    return data
  }

  async function startRoomDuel(roomId: string, opponentUserId: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('room_start_duel', {
      p_room_id: roomId,
      p_opponent_user_id: opponentUserId
    })
    if (error) rpcError(error)
    return data
  }

  async function submitBattleAction(sessionId: string, action: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('battle_submit_action', {
      p_session_id: sessionId,
      p_action: action
    })
    if (error) rpcError(error)
    return data
  }

  async function listBattles() {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('battle_list_for_user')
    if (error) rpcError(error)
    return data ?? []
  }

  async function getBattleTurns(sessionId: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('battle_get_turns', { p_session_id: sessionId })
    if (error) rpcError(error)
    return data ?? []
  }

  function subscribeToBattles(userId: string, onUpdate: (payload: unknown) => void) {
    const supabase = getSupabase()
    if (!supabase) return () => undefined
    const channel = supabase
      .channel(`battles:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_sessions' },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | undefined
          if (isUserBattleSession(row, userId)) onUpdate(payload)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }

  function subscribeToBattleRoom(roomId: string, onUpdate: (payload: unknown) => void) {
    const supabase = getSupabase()
    if (!supabase) return () => undefined
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_rooms', filter: `id=eq.${roomId}` },
        onUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_room_members', filter: `room_id=eq.${roomId}` },
        onUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_sessions', filter: `room_id=eq.${roomId}` },
        onUpdate
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function listChatRooms() {
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase.rpc('chat_room_list')
    if (error) rpcError(error)
    return data ?? []
  }

  async function joinChatRoom(roomId: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('chat_room_join', { p_room_id: roomId })
    if (error) rpcError(error)
    return data
  }

  async function leaveChatRoom(roomId: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('chat_room_leave', { p_room_id: roomId })
    if (error) rpcError(error)
  }

  async function getChatRoomMembers(roomId: string) {
    const supabase = getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase.rpc('chat_room_get_members', { p_room_id: roomId })
    if (error) rpcError(error)
    return data ?? []
  }

  async function sendChatRoomMessage(roomId: string, content: string) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('chat_room_send', {
      p_room_id: roomId,
      p_content: content
    })
    if (error) rpcError(error)
    return data
  }

  async function updateChatRoomPosition(
    roomId: string,
    pos: { x: number; y: number; facing: string; anim: string }
  ) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('chat_room_update_position', {
      p_room_id: roomId,
      p_x: pos.x,
      p_y: pos.y,
      p_facing: pos.facing,
      p_anim: pos.anim
    })
    if (error) rpcError(error)
    return data
  }

  function subscribeToChatRoom(roomId: string, onUpdate: (payload: unknown) => void) {
    const supabase = getSupabase()
    if (!supabase) return () => undefined
    const channel = supabase
      .channel(`chat-room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_room_members', filter: `room_id=eq.${roomId}` },
        onUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_room_messages', filter: `room_id=eq.${roomId}` },
        onUpdate
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_room_positions', filter: `room_id=eq.${roomId}` },
        onUpdate
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function syncInventory(userId: string, inventory: { item_type: string; quantity: number }[]) {
    const supabase = requireSupabase()
    await supabase.from('inventory').delete().eq('user_id', userId)
    if (inventory.length === 0) return []
    const { data, error } = await supabase.from('inventory').insert(
      inventory.map((item) => ({ user_id: userId, item_type: item.item_type, quantity: item.quantity }))
    )
    if (error) rpcError(error)
    return data
  }

  async function syncMissions(
    userId: string,
    missions: { mission_id: string; progress: number; completed: boolean; reset_at: string }[]
  ) {
    const supabase = requireSupabase()
    if (missions.length > 0) {
      const { error } = await supabase.from('mission_progress').upsert(
        missions.map((mission) => ({
          user_id: userId,
          mission_id: mission.mission_id,
          progress: mission.progress,
          completed: mission.completed,
          reset_at: mission.reset_at
        })),
        { onConflict: 'user_id,mission_id' }
      )
      if (error) rpcError(error)
    }
  }

  async function sendGift(recipientId: string, itemType: string, quantity: number) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('send_gift', {
      p_recipient_id: recipientId,
      p_item_type: itemType,
      p_quantity: quantity
    })
    if (error) rpcError(error)
    return data
  }

  async function listPendingGifts(): Promise<
    Array<{
      id: string
      senderId: string
      senderName: string
      itemType: string
      quantity: number
      createdAt: string
    }>
  > {
    const supabase = requireSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return []

    const { data, error } = await supabase.rpc('list_pending_gifts')
    if (error) {
      const msg = formatError(error)
      if (/not authenticated/i.test(msg)) return []
      rpcError(error)
    }
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      senderId: String(row.sender_id),
      senderName: String(row.sender_name ?? '???'),
      itemType: String(row.item_type),
      quantity: Number(row.quantity) || 0,
      createdAt: String(row.created_at)
    }))
  }

  async function claimPendingGifts(giftId?: string | null) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('claim_pending_gifts', {
      p_gift_id: giftId ?? null
    })
    if (error) rpcError(error)
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.claimed_id ?? row.id),
      senderId: String(row.claimed_sender_id ?? row.sender_id),
      senderName: String(row.claimed_sender_name ?? row.sender_name ?? '???'),
      itemType: String(row.claimed_item_type ?? row.item_type),
      quantity: Number(row.claimed_quantity ?? row.quantity) || 0,
      createdAt: String(row.claimed_created_at ?? row.created_at)
    }))
  }

  async function setActivePet(petId: string) {
    const supabase = requireSupabase()
    const { error } = await supabase.rpc('set_active_pet', { p_pet_id: petId })
    if (error) rpcError(error)
  }

  async function submitMinigameScore(gameId: string, score: number) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('upsert_minigame_score', {
      p_game_id: gameId,
      p_score: Math.max(0, Math.floor(score))
    })
    if (error) rpcError(error)
    return data
  }

  async function getMinigameLeaderboard(gameId: string, limit = 50) {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('get_minigame_leaderboard', {
      p_game_id: gameId,
      p_limit: limit
    })
    if (error) rpcError(error)
    return (data ?? []).map((row) => ({
      rank: Number(row.rank),
      userId: row.user_id,
      username: row.username,
      bestScore: row.best_score,
      achievedAt: row.achieved_at
    }))
  }

  return {
    isSupabaseConfigured: () => getSupabase() !== null,
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
  }
}
