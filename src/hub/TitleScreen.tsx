import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { playSfx, setBgmTrack, unlockAudio } from '../shared/audio'

interface Props {
  onContinue: () => void
}

export function TitleScreen({ onContinue }: Props) {
  const { t } = useTranslation()

  useEffect(() => {
    setBgmTrack('title')
  }, [])

  const continueFromTitle = useCallback(async () => {
    const unlocked = await unlockAudio()
    if (unlocked) {
      setBgmTrack('title')
      playSfx('title_start')
    }
    onContinue()
  }, [onContinue])

  useEffect(() => {
    const handleKey = () => {
      void continueFromTitle()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [continueFromTitle])

  return (
    <div
      className="title-screen"
      onClick={() => void continueFromTitle()}
      role="button"
      tabIndex={0}
    >
      <div className="title-screen-bg" aria-hidden />
      <div className="title-screen-content">
        <img
          className="title-screen-logo"
          src="/ui/taskino-logo.png"
          alt="TASKINO"
          draggable={false}
        />
        <p className="title-screen-prompt">{t('title.pressAnyKey')}</p>
      </div>
    </div>
  )
}
