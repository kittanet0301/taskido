import { contextBridge, ipcRenderer } from 'electron'
import type { GameSave, PetData } from '../../src/shared/types'
import type { GameAPI } from '../../src/api/types'

export type { GameAPI, ElectronAPI } from '../../src/api/types'

const api: GameAPI = {
  getGame: () => ipcRenderer.invoke('game:get'),
  patchGame: (mutator, args = []) => ipcRenderer.invoke('game:patch', mutator, args),
  updateGame: (save) => ipcRenderer.invoke('game:update', JSON.stringify(save)),
  onGameUpdated: (callback) => {
    const handler = (_: unknown, payload: string) => callback(JSON.parse(payload) as GameSave)
    ipcRenderer.on('game:updated', handler)
    return () => ipcRenderer.removeListener('game:updated', handler)
  },
  onHubOpened: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('hub:opened', handler)
    return () => ipcRenderer.removeListener('hub:opened', handler)
  },
  openHub: () => ipcRenderer.invoke('hub:open'),
  supabaseConfigured: () => ipcRenderer.invoke('supabase:configured'),
  signUp: (email, password, username) =>
    ipcRenderer.invoke('auth:signup', email, password, username),
  signIn: (email, password) => ipcRenderer.invoke('auth:signin', email, password),
  signOut: () => ipcRenderer.invoke('auth:signout'),
  setLocale: (locale) => ipcRenderer.invoke('locale:set', locale),
  resetPasswordByBirthdate: (email) => ipcRenderer.invoke('auth:resetPasswordByBirthdate', email),
  updatePassword: (password) => ipcRenderer.invoke('auth:updatePassword', password),
  updateProfile: (userId, fields) => ipcRenderer.invoke('auth:updateProfile', userId, fields),
  getSession: () => ipcRenderer.invoke('auth:session'),
  getProfile: (userId) => ipcRenderer.invoke('auth:profile', userId),
  syncPet: (userId, pet) => ipcRenderer.invoke('cloud:syncPet', userId, pet),
  getCloudPet: (userId) => ipcRenderer.invoke('cloud:getPet', userId),
  searchFriend: (code) => ipcRenderer.invoke('friends:search', code),
  sendFriendRequest: (userId, friendId) => ipcRenderer.invoke('friends:request', userId, friendId),
  respondFriend: (requestId, accept) => ipcRenderer.invoke('friends:respond', requestId, accept),
  listFriends: (userId) => ipcRenderer.invoke('friends:list', userId),
  listPending: (userId) => ipcRenderer.invoke('friends:pending', userId),
  getFriendPet: (ownerId) => ipcRenderer.invoke('friends:pet', ownerId),
  createBattleRoom: (name) => ipcRenderer.invoke('room:create', name),
  joinBattleRoom: (roomCode) => ipcRenderer.invoke('room:join', roomCode),
  leaveBattleRoom: (roomId) => ipcRenderer.invoke('room:leave', roomId),
  forfeitBattleRoom: (roomId) => ipcRenderer.invoke('room:forfeit', roomId),
  listPublicRooms: () => ipcRenderer.invoke('room:listPublic'),
  getBattleRoom: (roomId) => ipcRenderer.invoke('room:get', roomId),
  getRoomMembers: (roomId) => ipcRenderer.invoke('room:getMembers', roomId),
  selectRoomOpponent: (roomId, opponentUserId) =>
    ipcRenderer.invoke('room:selectOpponent', roomId, opponentUserId),
  startRoomDuel: (roomId, opponentUserId) =>
    ipcRenderer.invoke('room:startDuel', roomId, opponentUserId),
  submitBattleAction: (sessionId, action) =>
    ipcRenderer.invoke('battle:submitAction', sessionId, action),
  listBattles: () => ipcRenderer.invoke('battle:list'),
  getBattleTurns: (sessionId) => ipcRenderer.invoke('battle:getTurns', sessionId),
  subscribeBattles: (userId) => ipcRenderer.invoke('battle:subscribe', userId),
  subscribeBattleRoom: (roomId) => ipcRenderer.invoke('room:subscribe', roomId),
  onBattleUpdate: (callback) => {
    const handler = (_: unknown, payload: unknown) => callback(payload)
    ipcRenderer.on('battle:update', handler)
    return () => ipcRenderer.removeListener('battle:update', handler)
  },
  listChatRooms: () => ipcRenderer.invoke('chatRoom:list'),
  joinChatRoom: (roomId) => ipcRenderer.invoke('chatRoom:join', roomId),
  leaveChatRoom: (roomId) => ipcRenderer.invoke('chatRoom:leave', roomId),
  getChatRoomMembers: (roomId) => ipcRenderer.invoke('chatRoom:members', roomId),
  sendChatRoomMessage: (roomId, content) => ipcRenderer.invoke('chatRoom:send', roomId, content),
  updateChatRoomPosition: (roomId, pos) =>
    ipcRenderer.invoke('chatRoom:updatePosition', roomId, pos),
  subscribeChatRoom: (roomId) => ipcRenderer.invoke('chatRoom:subscribe', roomId),
  onChatRoomUpdate: (callback) => {
    const handler = (_: unknown, payload: unknown) => callback(payload)
    ipcRenderer.on('chatRoom:update', handler)
    return () => ipcRenderer.removeListener('chatRoom:update', handler)
  },
  syncInventory: (userId, inventory) => ipcRenderer.invoke('cloud:syncInventory', userId, inventory),
  syncMissions: (userId, missions) => ipcRenderer.invoke('cloud:syncMissions', userId, missions),
  isDbMode: () => ipcRenderer.invoke('cloud:isDbMode'),
  forceCloudSave: () => ipcRenderer.invoke('cloud:forceSave'),
  clearMyGameData: () => ipcRenderer.invoke('cloud:clearMyData'),
  reloadFromCloud: () => ipcRenderer.invoke('cloud:reload'),
  getActivityStatus: () =>
    ipcRenderer.invoke('activity:status') as Promise<{
      global: boolean
      fallback: boolean
      ready: boolean
    }>,
  reportActivityClick: () => ipcRenderer.invoke('activity:click'),
  reportActivityKey: () => ipcRenderer.invoke('activity:key'),
  finishMinigame: (gameId, score) => ipcRenderer.invoke('minigame:finish', gameId, score),
  submitMinigameScore: (gameId, score) => ipcRenderer.invoke('minigame:submitScore', gameId, score),
  getMinigameLeaderboard: (gameId, limit) => ipcRenderer.invoke('minigame:leaderboard', gameId, limit),
  sendGift: (recipientId, itemType, quantity) =>
    ipcRenderer.invoke('gift:send', recipientId, itemType, quantity),
  listPendingGifts: () => ipcRenderer.invoke('gift:listPending'),
  claimPendingGifts: (giftId) => ipcRenderer.invoke('gift:claimPending', giftId),
  adminListPlayers: () => ipcRenderer.invoke('admin:listPlayers'),
  adminGrantGems: (targetId, amount) => ipcRenderer.invoke('admin:grantGems', targetId, amount),
  adminGrantItem: (targetId, itemType, qty) =>
    ipcRenderer.invoke('admin:grantItem', targetId, itemType, qty),
  adminDeleteUser: (targetId) => ipcRenderer.invoke('admin:deleteUser', targetId)
}

contextBridge.exposeInMainWorld('electronAPI', api)
