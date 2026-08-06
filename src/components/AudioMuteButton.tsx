import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isMuted, playSfx, soundManager, toggleMuted } from '../shared/audio'

interface Props {
  className?: string
  variant?: 'hub' | 'pet'
}

const ICON_SRC = {
  on: '/ui/hud-icon-audio-on.png',
  off: '/ui/hud-icon-audio-off.png'
} as const

export function AudioMuteButton({ className = '', variant = 'hub' }: Props) {
  const { t } = useTranslation()
  const [muted, setMutedState] = useState(isMuted())

  useEffect(() => {
    setMutedState(isMuted())
    return soundManager.subscribeMute(setMutedState)
  }, [])

  const label = muted ? t('audio.unmute') : t('audio.mute')

  return (
    <button
      type="button"
      className={`audio-mute-btn audio-mute-btn--${variant}${className ? ` ${className}` : ''}`}
      onClick={() => {
        const next = toggleMuted()
        setMutedState(next)
        if (!next) playSfx('ui_confirm')
      }}
      title={label}
      aria-label={label}
      aria-pressed={muted}
    >
      <img
        className="audio-mute-btn-icon hud-icon"
        src={muted ? ICON_SRC.off : ICON_SRC.on}
        alt=""
        draggable={false}
      />
    </button>
  )
}
