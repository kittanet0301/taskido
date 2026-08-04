import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chat } from './Chat'
import { Friends } from './Friends'

interface Props {
  onViewProfile: (userId: string) => void
  onClose: () => void
  onPendingChange?: () => void
}

type CommunityTab = 'friends' | 'chat'

export function Community({ onViewProfile, onClose, onPendingChange }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<CommunityTab>('friends')

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="hub-modal hub-modal--lg community-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="hub-modal-head">
          <h2>{t('tabs.friends')}</h2>
          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>
        <div className="community-view">
          <div className="community-tabs-card">
            <div className="battle-hub-tabs">
              <button
                type="button"
                className={`tab ${tab === 'friends' ? 'active' : ''}`}
                onClick={() => setTab('friends')}
              >
                {t('friends.title')}
              </button>
              <button
                type="button"
                className={`tab ${tab === 'chat' ? 'active' : ''}`}
                onClick={() => setTab('chat')}
              >
                {t('chat.title')}
              </button>
            </div>
          </div>
          {tab === 'friends' ? (
            <Friends key="friends" onViewProfile={onViewProfile} onPendingChange={onPendingChange} />
          ) : (
            <Chat key="chat" />
          )}
        </div>
      </div>
    </div>
  )
}
