import type { GameSave, PetData } from '../shared/types'
import type { GameSpeedMultiplier } from '../shared/gameSpeed'
import type { MinigameFinishResult, MinigameLeaderboardRow } from '../shared/minigame'

export interface GameAPI {
  getGame: () => Promise<GameSave>
  patchGame: (mutator: string, args?: unknown[]) => Promise<GameSave>
  updateGame: (save: GameSave) => Promise<GameSave>
  forceCloudSave: () => Promise<void>
  clearMyGameData: () => Promise<GameSave>
  isDbMode: () => Promise<boolean>
  reloadFromCloud: () => Promise<GameSave>
  onGameUpdated: (callback: (save: GameSave) => void) => () => void
  onHubOpened: (callback: () => void) => () => void
  openHub: () => Promise<void>
  supabaseConfigured: () => Promise<boolean>
  signUp: (email: string, password: string, username: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signOut: () => Promise<void>
  setLocale: (locale: 'en' | 'th') => Promise<void>
  resetPasswordByBirthdate: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (userId: string, fields: { username?: string }) => Promise<unknown>
  getSession: () => Promise<unknown>
  getProfile: (userId: string) => Promise<unknown>
  syncPet: (userId: string, pet: PetData) => Promise<unknown>
  getCloudPet: (userId: string) => Promise<unknown>
  searchFriend: (code: string) => Promise<unknown>
  sendFriendRequest: (userId: string, friendId: string) => Promise<unknown>
  respondFriend: (requestId: string, accept: boolean) => Promise<unknown>
  listFriends: (userId: string) => Promise<unknown>
  listPending: (userId: string) => Promise<unknown>
  getFriendPet: (ownerId: string) => Promise<unknown>
  createBattleRoom: (name?: string) => Promise<unknown>
  joinBattleRoom: (roomCode: string) => Promise<unknown>
  leaveBattleRoom: (roomId: string) => Promise<void>
  forfeitBattleRoom: (roomId: string) => Promise<void>
  listPublicRooms: () => Promise<unknown>
  getBattleRoom: (roomId: string) => Promise<unknown>
  getRoomMembers: (roomId: string) => Promise<unknown>
  selectRoomOpponent: (roomId: string, opponentUserId: string | null) => Promise<unknown>
  startRoomDuel: (roomId: string, opponentUserId: string) => Promise<unknown>
  submitBattleAction: (sessionId: string, action: string) => Promise<unknown>
  listBattles: () => Promise<unknown>
  getBattleTurns: (sessionId: string) => Promise<unknown>
  subscribeBattles: (userId: string) => Promise<boolean>
  subscribeBattleRoom: (roomId: string) => Promise<boolean>
  onBattleUpdate: (callback: (payload: unknown) => void) => () => void
  listChatRooms: () => Promise<unknown>
  joinChatRoom: (roomId: string) => Promise<unknown>
  leaveChatRoom: (roomId: string) => Promise<void>
  getChatRoomMembers: (roomId: string) => Promise<unknown>
  sendChatRoomMessage: (roomId: string, content: string) => Promise<unknown>
  updateChatRoomPosition: (
    roomId: string,
    pos: { x: number; y: number; facing: string; anim: string }
  ) => Promise<unknown>
  subscribeChatRoom: (roomId: string) => Promise<boolean>
  onChatRoomUpdate: (callback: (payload: unknown) => void) => () => void
  syncInventory: (userId: string, inventory: GameSave['inventory']) => Promise<unknown>
  syncMissions: (userId: string, missions: GameSave['missions']) => Promise<unknown>
  getActivityStatus: () => Promise<{ global: boolean; fallback: boolean; ready: boolean }>
  reportActivityClick: () => Promise<void>
  reportActivityKey: () => Promise<void>
  finishMinigame: (
    gameId: string,
    score: number
  ) => Promise<{ save: GameSave; result: MinigameFinishResult }>
  submitMinigameScore: (gameId: string, score: number) => Promise<unknown>
  getMinigameLeaderboard: (gameId: string, limit?: number) => Promise<MinigameLeaderboardRow[]>
  sendGift: (recipientId: string, itemType: string, quantity: number) => Promise<GameSave>
  listPendingGifts: () => Promise<
    Array<{
      id: string
      senderId: string
      senderName: string
      itemType: string
      quantity: number
      createdAt: string
    }>
  >
  claimPendingGifts: (
    giftId?: string | null
  ) => Promise<{
    claimed: Array<{
      id: string
      senderId: string
      senderName: string
      itemType: string
      quantity: number
      createdAt: string
    }>
    save: GameSave
  }>
  adminListPlayers: () => Promise<
    Array<{
      id: string
      username: string
      friend_code: string
      role: string
      gems: number
    }>
  >
  adminGrantGems: (targetId: string, amount: number) => Promise<number>
  adminGrantItem: (targetId: string, itemType: string, qty: number) => Promise<number>
  adminDeleteUser: (targetId: string) => Promise<void>
  getGameSpeed: () => Promise<GameSpeedMultiplier>
  setGameSpeed: (multiplier: GameSpeedMultiplier) => Promise<GameSpeedMultiplier>
  onGameSpeedUpdated: (callback: (multiplier: GameSpeedMultiplier) => void) => () => void
}

/** @deprecated use GameAPI — kept for Electron preload compatibility */
export type ElectronAPI = GameAPI
