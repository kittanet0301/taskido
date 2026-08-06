import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { playSfx, unlockAudio } from '../shared/audio'

interface Props {
  onContinue: () => void
}

export function TitleScreen({ onContinue }: Props) {
  const { t } = useTranslation()

  useEffect(() => {
    const handleKey = () => {
      void unlockAudio()
      playSfx('title_start')
      onContinue()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onContinue])

  const handleContinue = () => {
    void unlockAudio()
    playSfx('title_start')
    onContinue()
  }

  return (
    <div className="title-screen" onClick={handleContinue} role="button" tabIndex={0}>
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
