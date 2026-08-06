import type { BattleFxDescriptor, BattleFxPhase } from '../battle/battleFx'
import type { SfxId } from './soundIds'
import { playSfx } from './soundManager'

const ROLE_SFX: Partial<Record<BattleFxDescriptor['role'], SfxId>> = {
  guard: 'battle_guard',
  dodge: 'battle_dodge'
}

const PHASE_SFX: Partial<Record<BattleFxPhase, SfxId>> = {
  windup: 'battle_windup',
  travel: 'battle_travel',
  impact: 'battle_impact',
  recover: 'battle_recover'
}

const PHASE_OFFSETS: Record<BattleFxPhase, number> = {
  windup: 0,
  travel: 0.12,
  impact: 0.28,
  recover: 0.52
}

export function playBattleFxSounds(fx: BattleFxDescriptor): void {
  const roleSfx = ROLE_SFX[fx.role]
  if (roleSfx) {
    playSfx(roleSfx, { element: fx.element })
    return
  }

  for (const phase of fx.phases) {
    const sfx = PHASE_SFX[phase]
    if (!sfx) continue
    const delayMs = Math.round((PHASE_OFFSETS[phase] ?? 0) * fx.durationMs)
    window.setTimeout(() => {
      playSfx(sfx, { element: fx.element })
    }, delayMs)
  }

  if (fx.damage > 0 && fx.phases.includes('impact')) {
    window.setTimeout(() => {
      playSfx('battle_ko', { element: fx.element, pitchMultiplier: 0.85 })
    }, Math.round(0.28 * fx.durationMs))
  }
}

export function playBattleOutcome(won: boolean): void {
  playSfx(won ? 'battle_win' : 'battle_lose')
}
