import { app, BrowserWindow, ipcMain } from 'electron'
import { loadEnvFile } from './env'
import {
  createPetWindow,
  endPetDrag,
  getPetWindow,
  getPetBounds,
  getWorkArea,
  movePetWindow,
  resizePetWindow,
  setPetIgnoreMouse,
  startPetDrag
} from './petWindow'
import { createHubWindow, getHubWindow, isHubWindowOpen } from './hubWindow'
import { createTray, destroyTray, refreshTray } from './tray'
import { setMainLocale } from './locale'
import { registerAppProtocolHandler, registerAppProtocolScheme } from './rendererUrl'
import { getAppIconPath } from './appIcon'
import {
  broadcastToWindows,
  forceCloudSave,
  getGameSave,
  hydrateFromSession,
  isDbMode,
  onSaveChange,
  registerPlaytimeTick,
  clearMyGameData,
  setCurrentUser,
  setGameSave,
  startActivityTracker,
  stopActivityTracker,
  isGlobalActivityTracking,
  needsRendererActivityFallback,
  isActivityTrackerReady,
  recordActivityClick,
  recordActivityKey,
  updateSave
} from './gameState'
import type { GameSave, MinigameId, PetData } from '../../src/shared/types'
import { applyGamePatch, setSessionIsAdmin } from '../../src/shared/gameMutators'
import { isAdminRole } from '../../src/shared/userRole'
import { setGameSpeedMultiplier } from '../../src/shared/gameSpeed'
import { applyFinishMinigame } from '../../src/shared/minigame'
import {
  getSession,
  signIn,
  signOut,
  signUp,
  resetPasswordByBirthdate,
  updatePassword,
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
  isSupabaseConfigured,
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
} from './supabase'

let activeBattleRoomId: string | null = null
let chatRoomUnsubscribe: (() => void) | null = null
let gameSpeedUnsubscribe: (() => void) | null = null

loadEnvFile()
registerAppProtocolScheme()

const isDev = !app.isPackaged

function getAllWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows()
}

async function refreshGameSpeed(): Promise<number> {
  const multiplier = await getGameSpeed()
  setGameSpeedMultiplier(multiplier)
  for (const window of getAllWindows()) window.webContents.send('game:speedUpdated', multiplier)
  return multiplier
}

function notifyAll(): void {
  broadcastToWindows(getAllWindows())
}

function setupIpc(): void {
  ipcMain.handle('game:get', () => getGameSave())

  ipcMain.handle('game:update', (_event, payload: string) => {
    const save = JSON.parse(payload) as GameSave
    return setGameSave(save)
  })

  ipcMain.handle('game:patch', async (_event, mutatorName: string, args: unknown[]) => {
    const save = updateSave((current) => applyGamePatch(current, mutatorName, args))
    if (mutatorName === 'setActivePet' && typeof args[0] === 'string' && isDbMode()) {
      try {
        await setActivePet(args[0])
      } catch (err) {
        console.error('[cloud] setActivePet failed:', err)
      }
    }
    return save
  })

  ipcMain.handle('minigame:finish', (_event, gameId: string, score: number) => {
    let finishResult: ReturnType<typeof applyFinishMinigame>['result'] | null = null
    const save = updateSave((current) => {
      const { save: next, result } = applyFinishMinigame(current, gameId as MinigameId, score)
      finishResult = result
      return next
    })
    return { save, result: finishResult }
  })

  ipcMain.handle('minigame:submitScore', async (_event, gameId: string, score: number) => {
    if (!isDbMode()) return null
    return submitMinigameScore(gameId, score)
  })

  ipcMain.handle('minigame:leaderboard', async (_event, gameId: string, limit?: number) => {
    if (!isSupabaseConfigured()) return []
    return getMinigameLeaderboard(gameId, limit ?? 50)
  })

  ipcMain.handle('activity:status', () => ({
    global: isGlobalActivityTracking(),
    fallback: needsRendererActivityFallback(),
    ready: isActivityTrackerReady()
  }))
  ipcMain.handle('activity:click', () => {
    recordActivityClick()
  })
  ipcMain.handle('activity:key', () => {
    recordActivityKey()
  })

  ipcMain.handle('pet:setIgnoreMouse', (_event, ignore: boolean) => {
    setPetIgnoreMouse(ignore, true)
  })
  ipcMain.handle('pet:resize', (_event, width: number, height: number, preserveLeft?: boolean) => {
    resizePetWindow(width, height, preserveLeft)
  })
  ipcMain.handle('pet:move', (_event, x: number, y: number) => movePetWindow(x, y))
  ipcMain.handle('pet:startDrag', () => startPetDrag())
  ipcMain.handle('pet:endDrag', () => endPetDrag(false))
  ipcMain.handle('pet:getBounds', () => getPetBounds())
  ipcMain.handle('pet:getWorkArea', () => getWorkArea())

  ipcMain.handle('hub:open', () => {
    createHubWindow()
  })

  ipcMain.handle('supabase:configured', () => isSupabaseConfigured())
  ipcMain.handle('cloud:isDbMode', () => isDbMode())
  ipcMain.handle('cloud:forceSave', async () => forceCloudSave())
  ipcMain.handle('cloud:clearMyData', async () => clearMyGameData())
  ipcMain.handle('cloud:reload', async () => hydrateFromSession())

  ipcMain.handle('auth:signup', async (_e, email: string, password: string, username: string) => {
    const data = await signUp(email, password, username)
    if (data.session?.user?.id) await setCurrentUser(data.session.user.id)
    return data
  })
  ipcMain.handle('auth:signin', async (_e, email: string, password: string) => {
    const data = await signIn(email, password)
    if (data.session?.user?.id) await setCurrentUser(data.session.user.id)
    return data
  })
  ipcMain.handle('auth:signout', async () => {
    await signOut()
    setSessionIsAdmin(false)
    await setCurrentUser(null)
  })
  ipcMain.handle('auth:updatePassword', async (_e, password: string) => {
    await updatePassword(password)
  })
  ipcMain.handle('auth:resetPasswordByBirthdate', async (_e, email: string) => {
    await resetPasswordByBirthdate(email)
  })
  ipcMain.handle('auth:session', async () => getSession())
  ipcMain.handle('auth:profile', async (_e, userId: string) => {
    const profile = await getProfile(userId)
    setSessionIsAdmin(isAdminRole((profile as { role?: string } | null)?.role))
    return profile
  })
  ipcMain.handle('auth:updateProfile', async (_e, userId: string, fields: { username?: string }) =>
    updateProfile(userId, fields)
  )
  ipcMain.handle('admin:listPlayers', async () => adminListPlayers())
  ipcMain.handle('admin:grantGems', async (_e, targetId: string, amount: number) =>
    adminGrantGems(targetId, amount)
  )
  ipcMain.handle('admin:grantItem', async (_e, targetId: string, itemType: string, qty: number) =>
    adminGrantItem(targetId, itemType, qty)
  )
  ipcMain.handle('admin:deleteUser', async (_e, targetId: string) => adminDeleteUser(targetId))
  ipcMain.handle('gameSpeed:get', async () => refreshGameSpeed())
  ipcMain.handle('gameSpeed:set', async (_e, multiplier: number) => {
    const next = await setGameSpeed(multiplier as 1 | 2 | 4 | 8 | 16)
    setGameSpeedMultiplier(next)
    for (const window of getAllWindows()) window.webContents.send('game:speedUpdated', next)
    return next
  })
  ipcMain.handle('locale:set', (_e, locale: 'en' | 'th') => {
    setMainLocale(locale)
    refreshTray(getGameSave)
  })

  ipcMain.handle('cloud:syncPet', async (_e, userId: string, pet: PetData) => {
    const mapped = {
      id: pet.id,
      name: pet.name,
      species: pet.character,
      gender: pet.gender,
      stage: pet.stage,
      health: pet.stats.health,
      emotion: pet.stats.emotion,
      evolution: pet.stats.evolution,
      hatched_at: pet.hatchedAt,
      created_at: pet.createdAt
    }
    return syncPetToCloud(userId, mapped)
  })

  ipcMain.handle('cloud:getPet', async (_e, userId: string) => getActivePet(userId))

  ipcMain.handle('friends:search', async (_e, code: string) => searchProfileByFriendCode(code))
  ipcMain.handle('friends:request', async (_e, userId: string, friendId: string) =>
    sendFriendRequest(userId, friendId)
  )
  ipcMain.handle('friends:respond', async (_e, requestId: string, accept: boolean) =>
    respondFriendRequest(requestId, accept)
  )
  ipcMain.handle('friends:list', async (_e, userId: string) => listFriends(userId))
  ipcMain.handle('friends:pending', async (_e, userId: string) => listPendingRequests(userId))
  ipcMain.handle('friends:pet', async (_e, ownerId: string) => getFriendPet(ownerId))

  ipcMain.handle('room:create', async (_e, name?: string) => {
    const room = await createBattleRoom(name)
    if (room && typeof room === 'object' && 'id' in room) {
      activeBattleRoomId = String((room as { id: string }).id)
    }
    return room
  })
  ipcMain.handle('room:join', async (_e, roomCode: string) => {
    const room = await joinBattleRoom(roomCode)
    if (room && typeof room === 'object' && 'id' in room) {
      activeBattleRoomId = String((room as { id: string }).id)
    }
    return room
  })
  ipcMain.handle('room:leave', async (_e, roomId: string) => {
    await leaveBattleRoom(roomId)
    if (activeBattleRoomId === roomId) activeBattleRoomId = null
  })
  ipcMain.handle('room:forfeit', async (_e, roomId: string) => {
    await forfeitBattleRoom(roomId)
    if (activeBattleRoomId === roomId) activeBattleRoomId = null
  })
  ipcMain.handle('room:listPublic', async () => listPublicRooms())
  ipcMain.handle('room:get', async (_e, roomId: string) => getBattleRoom(roomId))
  ipcMain.handle('room:getMembers', async (_e, roomId: string) => getRoomMembers(roomId))
  ipcMain.handle(
    'room:selectOpponent',
    async (_e, roomId: string, opponentUserId: string | null) =>
      selectRoomOpponent(roomId, opponentUserId)
  )
  ipcMain.handle('room:startDuel', async (_e, roomId: string, opponentUserId: string) =>
    startRoomDuel(roomId, opponentUserId)
  )
  ipcMain.handle('room:subscribe', (event, roomId: string) => {
    const wc = event.sender
    subscribeToBattleRoom(roomId, (payload) => {
      wc.send('battle:update', payload)
    })
    return true
  })

  ipcMain.handle('battle:submitAction', async (_e, sessionId: string, action: string) =>
    submitBattleAction(sessionId, action)
  )
  ipcMain.handle('battle:list', async () => listBattles())
  ipcMain.handle('battle:getTurns', async (_e, sessionId: string) => getBattleTurns(sessionId))
  ipcMain.handle('battle:subscribe', (event, userId: string) => {
    const wc = event.sender
    const unsubscribe = subscribeToBattles(userId, (payload) => {
      wc.send('battle:update', payload)
    })
    return true
  })
  ipcMain.handle('battle:setActiveRoom', (_e, roomId: string | null) => {
    activeBattleRoomId = roomId
  })

  ipcMain.handle('chatRoom:list', async () => listChatRooms())
  ipcMain.handle('chatRoom:join', async (_e, roomId: string) => joinChatRoom(roomId))
  ipcMain.handle('chatRoom:leave', async (_e, roomId: string) => {
    await leaveChatRoom(roomId)
    if (chatRoomUnsubscribe) {
      chatRoomUnsubscribe()
      chatRoomUnsubscribe = null
    }
  })
  ipcMain.handle('chatRoom:members', async (_e, roomId: string) => getChatRoomMembers(roomId))
  ipcMain.handle('chatRoom:send', async (_e, roomId: string, content: string) =>
    sendChatRoomMessage(roomId, content)
  )
  ipcMain.handle(
    'chatRoom:updatePosition',
    async (_e, roomId: string, pos: { x: number; y: number; facing: string; anim: string }) =>
      updateChatRoomPosition(roomId, pos)
  )
  ipcMain.handle('chatRoom:subscribe', (event, roomId: string) => {
    if (chatRoomUnsubscribe) chatRoomUnsubscribe()
    const wc = event.sender
    chatRoomUnsubscribe = subscribeToChatRoom(roomId, (payload) => {
      wc.send('chatRoom:update', payload)
    })
    return true
  })

  ipcMain.handle('cloud:syncInventory', async (_e, userId: string, inventory: GameSave['inventory']) =>
    syncInventory(
      userId,
      inventory.map((i) => ({ item_type: i.type, quantity: i.quantity }))
    )
  )

  ipcMain.handle(
    'gift:send',
    async (_e, recipientId: string, itemType: string, quantity: number) => {
      await sendGift(recipientId, itemType, quantity)
      return updateSave((save) => applyGamePatch(save, 'sendGiftLocal', [itemType, quantity]))
    }
  )
  ipcMain.handle('gift:listPending', async () => listPendingGifts())
  ipcMain.handle('gift:claimPending', async (_e, giftId?: string | null) => {
    const claimed = await claimPendingGifts(giftId)
    // Pull claimed items into the local save from cloud inventory.
    await hydrateFromSession()
    return { claimed, save: getGameSave() }
  })

  ipcMain.handle('cloud:syncMissions', async (_e, userId: string, missions: GameSave['missions']) =>
    syncMissions(
      userId,
      missions.map((m) => ({
        mission_id: m.missionId,
        progress: m.progress,
        completed: m.completed,
        reset_at: m.resetAt
      }))
    )
  )
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.taskino.app')
  app.dock?.setIcon(getAppIconPath())
  registerAppProtocolHandler()
  setupIpc()
  await startActivityTracker()
  await hydrateFromSession()
  try {
    await refreshGameSpeed()
    gameSpeedUnsubscribe = subscribeToGameSpeed((multiplier) => {
      setGameSpeedMultiplier(multiplier)
      for (const window of getAllWindows()) window.webContents.send('game:speedUpdated', multiplier)
    })
  } catch (error) {
    console.warn('[game-speed] using x1:', error)
  }

  createPetWindow()
  createTray({
    getSave: getGameSave,
    onTogglePet: () => {
      const win = getPetWindow()
      if (!win) return
      if (win.isVisible()) {
        win.hide()
        return
      }
      // Desktop pet stays hidden while the hub window is open.
      if (isHubWindowOpen()) return
      win.show()
    },
    onQuit: () => app.quit()
  })

  registerPlaytimeTick()

  onSaveChange(() => notifyAll())

  if (isDev) {
    createHubWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow()
    } else {
      getHubWindow()?.focus()
    }
  })
})

app.on('before-quit', () => {
  if (activeBattleRoomId) {
    forfeitBattleRoom(activeBattleRoomId).catch(() => undefined)
    activeBattleRoomId = null
  }
  stopActivityTracker()
  gameSpeedUnsubscribe?.()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
