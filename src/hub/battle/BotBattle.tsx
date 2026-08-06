import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PetData } from '../../shared/types'
import type { BattleActionPayload, BattleSession, BattleSessionState, BattleTurn } from '../../shared/battle/types'
import { applyAction } from '../../shared/battle/engine'
import {
  BOT_DIFFICULTY_RULES,
  BOT_USER_ID,
  calculateBotBattleReward,
  chooseBotAction,
  createBotBattleState,
  createBotPet,
  createNextWaveState,
  DEFAULT_BATTLE_CONSUMABLES,
  HARD_FINAL_WAVE_BOSS,
  isHardFinalBossWave,
  LOCAL_PLAYER_USER_ID,
  type BattleConsumableCounts,
  type BotBattleReward,
  type BotDifficulty
} from '../../shared/battle/bot'
import { BATTLE_DEFEAT_HOLD_MS } from '../../shared/battle/constants'
import { setBgmTrack, getCurrentBgmTrack } from '../../shared/audio'
import { BattleArena } from './BattleArena'

interface Props {
  pet: PetData
  onComplete?: (difficulty: BotDifficulty, dropRoll: number) => void | Promise<void>
  onStartedChange?: (started: boolean) => void
}

interface LocalMatch {
  bot: PetData
  state: BattleSessionState
  playerItems: BattleConsumableCounts
  botItems: BattleConsumableCounts
}

function newMatch(pet: PetData, difficulty: BotDifficulty): LocalMatch {
  const bot = createBotPet(pet, { difficulty, wave: 1 })
  return {
    bot,
    state: createBotBattleState(pet, bot),
    playerItems: { ...DEFAULT_BATTLE_CONSUMABLES },
    botItems: { health_potion: 1, mana_potion: 1 }
  }
}

function asSession(state: BattleSessionState): BattleSession {
  return {
    id: state.sessionId, roomId: null,
    challengerUserId: state.challenger.userId, defenderUserId: state.defender.userId,
    challengerPetId: state.challenger.petId, defenderPetId: state.defender.petId,
    challengerHp: state.challenger.hp, defenderHp: state.defender.hp,
    challengerHpStart: state.challenger.hpStart, defenderHpStart: state.defender.hpStart,
    challengerMp: state.challenger.mp, defenderMp: state.defender.mp,
    challengerTp: state.challenger.tp, defenderTp: state.defender.tp,
    challengerEnergy: state.challenger.tp, defenderEnergy: state.defender.tp,
    challengerDefending: state.challenger.defending, defenderDefending: state.defender.defending,
    challengerAvoiding: state.challenger.avoiding, defenderAvoiding: state.defender.avoiding,
    status: state.status, turnUserId: state.turnUserId,
    winnerUserId: state.winnerUserId, fledUserId: state.fledUserId,
    expiresAt: null, createdAt: new Date().toISOString()
  }
}

function turnFrom(state: BattleSessionState, actor: string, action: BattleActionPayload, damage: number, message: string, index: number): BattleTurn {
  return {
    id: `${state.sessionId}-${index}-${actor}`, sessionId: state.sessionId,
    actorUserId: actor, action: action.command, skillId: action.skillId ?? null, damage,
    challengerHpAfter: state.challenger.hp, defenderHpAfter: state.defender.hp,
    message, createdAt: new Date().toISOString()
  }
}

function consume(items: BattleConsumableCounts, type?: string): BattleConsumableCounts {
  if (type !== 'health_potion' && type !== 'mana_potion') return items
  return { ...items, [type]: Math.max(0, items[type] - 1) }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function BotBattle({ pet, onComplete, onStartedChange }: Props) {
  const { t, i18n } = useTranslation()
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal')
  const [started, setStarted] = useState(false)
  const [wave, setWave] = useState(1)
  const [paused, setPaused] = useState(false)
  const [auto, setAuto] = useState(false)
  const [speed, setSpeed] = useState<1 | 1.5>(1)
  const [turns, setTurns] = useState<BattleTurn[]>([])
  const [reward, setReward] = useState<BotBattleReward | null>(null)
  const [waveNotice, setWaveNotice] = useState<string | null>(null)
  const [match, setMatch] = useState(() => newMatch(pet, 'normal'))
  const actionLock = useRef(false)
  const completed = useRef(false)
  const totalWaves = BOT_DIFFICULTY_RULES[difficulty].waves

  const reset = useCallback((nextDifficulty = difficulty) => {
    setMatch(newMatch(pet, nextDifficulty))
    setTurns([]); setWave(1); setPaused(false); setAuto(false); setReward(null)
    actionLock.current = false; completed.current = false
  }, [difficulty, pet])

  useEffect(() => {
    reset(difficulty)
    setStarted(false)
  }, [pet.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onStartedChange?.(started)
  }, [onStartedChange, started])

  useEffect(() => {
    if (!started) return
    setBgmTrack(isHardFinalBossWave(difficulty, wave) ? 'boss' : 'battle')
  }, [difficulty, started, wave])

  useEffect(() => () => {
    if (getCurrentBgmTrack() === 'boss') {
      setBgmTrack('battle')
    }
  }, [])

  useEffect(() => {
    if (wave <= 1) {
      setWaveNotice(null)
      return
    }
    setWaveNotice(
      isHardFinalBossWave(difficulty, wave)
        ? t('battle.bot.bossIncoming', { name: t(`defaultPetNames.${HARD_FINAL_WAVE_BOSS}`) })
        : t('battle.bot.waveIncoming', { wave })
    )
    const id = window.setTimeout(() => setWaveNotice(null), 1100)
    return () => window.clearTimeout(id)
  }, [difficulty, t, wave])

  const finishWave = useCallback(async (state: BattleSessionState) => {
    if (state.status !== 'completed' || state.winnerUserId !== LOCAL_PLAYER_USER_ID) return
    await delay(BATTLE_DEFEAT_HOLD_MS)
    if (wave < totalWaves) {
      const nextWave = wave + 1
      const bot = createBotPet(pet, {
        difficulty,
        wave: nextWave,
        excludeCharacters: [match.bot.character]
      })
      setWave(nextWave)
      setMatch((current) => ({ ...current, bot, state: createNextWaveState(state, bot), botItems: { health_potion: 1, mana_potion: 1 } }))
      return
    }
    if (completed.current) return
    completed.current = true
    const roll = Math.random()
    setReward(calculateBotBattleReward(difficulty, roll))
    try { await onComplete?.(difficulty, roll) } catch { /* Keep the earned local result visible. */ }
  }, [difficulty, match.bot.character, onComplete, pet, totalWaves, wave])

  const act = useCallback(async (command: BattleActionPayload['command'], extra?: { skillId?: string; itemType?: string }) => {
    if (!started || actionLock.current || paused || match.state.status !== 'active' || match.state.turnUserId !== LOCAL_PLAYER_USER_ID) return
    actionLock.current = true
    try {
      const action: BattleActionPayload = { command, ...extra }
      const rank = action.skillId ? pet.skillLoadout?.slots.find((s) => s.pathId === action.skillId)?.rank : undefined
      const result = applyAction(match.state, LOCAL_PLAYER_USER_ID,
        action.skillId ? `skill:${action.skillId}` : action.itemType ? `item:${action.itemType}` : command,
        { skillId: action.skillId, itemType: action.itemType, skillRank: rank })
      setMatch((current) => ({ ...current, state: result.state, playerItems: consume(current.playerItems, action.itemType) }))
      setTurns((current) => [...current, turnFrom(result.state, LOCAL_PLAYER_USER_ID, action, result.damage, result.logMessage, current.length)])
      await finishWave(result.state)
    } finally {
      actionLock.current = false
    }
  }, [finishWave, match.state, paused, pet.skillLoadout?.slots, started])

  useEffect(() => {
    if (!started || paused || match.state.status !== 'active' || match.state.turnUserId !== BOT_USER_ID) return
    const id = window.setTimeout(() => {
      const action = chooseBotAction(match.state, match.bot, match.botItems)
      const rank = action.skillId ? match.bot.skillLoadout?.slots.find((s) => s.pathId === action.skillId)?.rank : undefined
      const result = applyAction(match.state, BOT_USER_ID,
        action.skillId ? `skill:${action.skillId}` : action.itemType ? `item:${action.itemType}` : action.command,
        { skillId: action.skillId, itemType: action.itemType, skillRank: rank })
      setMatch((current) => ({ ...current, state: result.state, botItems: consume(current.botItems, action.itemType) }))
      setTurns((current) => [...current, turnFrom(result.state, BOT_USER_ID, action, result.damage, result.logMessage, current.length)])
    }, Math.round(520 / speed))
    return () => window.clearTimeout(id)
  }, [match, paused, speed, started])

  useEffect(() => {
    if (!started || !auto || paused || match.state.status !== 'active' || match.state.turnUserId !== LOCAL_PLAYER_USER_ID) return
    const id = window.setTimeout(() => void act('attack'), Math.round(420 / speed))
    return () => window.clearTimeout(id)
  }, [act, auto, match.state.status, match.state.turnUserId, paused, speed, started])

  const resultText = useMemo(() => {
    if (match.state.status === 'fled') return t('battle.bot.resultFled')
    if (match.state.status !== 'completed') return null
    if (match.state.winnerUserId !== LOCAL_PLAYER_USER_ID) return t('battle.bot.resultLose')
    return wave === totalWaves ? t('battle.bot.resultWin') : null
  }, [match.state.status, match.state.winnerUserId, t, totalWaves, wave])

  const defenderPet = useMemo(
    () => ({
      ...match.bot,
      name: t(`defaultPetNames.${match.bot.character}`)
    }),
    [match.bot, i18n.language, t]
  )

  if (!started) {
    return <section className="bot-battle-setup" aria-labelledby="bot-difficulty-title">
      <div className="bot-setup-heading">
        <img src="/battle/generated-icons/battle-icon-4.png" alt="" />
        <div>
          <h3 id="bot-difficulty-title">{t('battle.bot.selectDifficulty')}</h3>
          <p>{t('battle.bot.selectDifficultyHint')}</p>
        </div>
      </div>
      <div className="bot-difficulty-cards">
        {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((level) => {
          const rule = BOT_DIFFICULTY_RULES[level]
          return <button
            key={level}
            type="button"
            className={`bot-difficulty-card bot-difficulty-card--${level}${difficulty === level ? ' active' : ''}`}
            aria-pressed={difficulty === level}
            onClick={() => setDifficulty(level)}
          >
            <strong>{t(`battle.bot.difficulties.${level}`)}</strong>
            <span>{t('battle.bot.enemyPower', { power: Math.round(rule.statScale * 100) })}</span>
            <span>{t('battle.bot.waveCount', { count: rule.waves })}</span>
            <div className="bot-difficulty-rewards">
              <span><img src="/ui/hud-stat-gems.png" alt="" />{rule.gems} {t('battle.bot.gems')}</span>
              <span>EXP {rule.evolution}</span>
              <span>{t('battle.bot.dropChance', { chance: Math.round(rule.dropChance * 100) })}</span>
            </div>
          </button>
        })}
      </div>
      <p className="bot-setup-items">
        <img src="/battle/generated-icons/battle-icon-1.png" alt="" />
        <img src="/battle/generated-icons/battle-icon-2.png" alt="" />
        {t('battle.bot.battleItemsIncluded', { count: DEFAULT_BATTLE_CONSUMABLES.health_potion })}
      </p>
      <button type="button" className="primary bot-start-button" onClick={() => { reset(difficulty); setStarted(true) }}>
        ⚔ {t('battle.bot.startBattle')}
      </button>
    </section>
  }

  return <div className="bot-battle-shell">
    <BattleArena
      session={asSession(match.state)} turns={turns} userId={LOCAL_PLAYER_USER_ID}
      challengerName={pet.name} defenderName={defenderPet.name} challengerPet={pet} defenderPet={defenderPet}
      battleItemCounts={match.playerItems} mode="bot" onAction={act}
      wave={wave} totalWaves={totalWaves} difficulty={difficulty}
      paused={paused} auto={auto} speed={speed}
      onTogglePause={() => setPaused((v) => !v)} onToggleAuto={() => setAuto((v) => !v)}
      onToggleSpeed={() => setSpeed((v) => v === 1 ? 1.5 : 1)}
      rewardPreview={BOT_DIFFICULTY_RULES[difficulty]}
      announcement={waveNotice}
    />
    {resultText && <div className="bot-result-overlay">
      <section className="bot-battle-result" role="dialog" aria-modal="true" aria-labelledby="bot-result-title">
        <div className="bot-result-title">
          <img src={reward ? '/battle/generated-icons/battle-icon-4.png' : '/battle/generated-icons/battle-icon-1.png'} alt="" />
          <strong id="bot-result-title">{resultText}</strong>
        </div>
        {reward && <div className="bot-reward-row">
          <span><img src="/ui/hud-stat-gems.png" alt="" />+{reward.gems} {t('battle.bot.gems')}</span>
          <span>+{reward.evolution} EXP</span>
          {reward.drop && <span><img src="/battle/generated-icons/battle-icon-4.png" alt="" />{t(`items.${reward.drop}.label`)}</span>}
        </div>}
        <div className="bot-result-actions">
          <button type="button" className="primary" autoFocus onClick={() => reset()}>{t('battle.bot.playAgain')}</button>
          <button type="button" className="secondary" onClick={() => setStarted(false)}>{t('battle.bot.changeDifficulty')}</button>
        </div>
      </section>
      </div>
    }
  </div>
}
