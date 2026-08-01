import { useTranslation } from 'react-i18next'

interface Props {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function LeaveRoomDialog({ open, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="leave-dialog-overlay" role="presentation" onMouseDown={onCancel}>
      <div
        className="leave-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-room-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="leave-dialog__heading">
          <span className="leave-dialog__icon" aria-hidden>!</span>
          <h3 id="leave-room-title">{t('battle.leaveRoomConfirmTitle')}</h3>
        </div>
        <p>{t('battle.leaveRoomConfirmBody')}</p>
        <div className="leave-dialog__actions">
          <button type="button" className="leave-dialog__stay" onClick={onCancel}>
            {t('battle.stay')}
          </button>
          <button type="button" className="leave-dialog__confirm" onClick={onConfirm}>
            {t('battle.leaveRoom')}
          </button>
        </div>
      </div>
    </div>
  )
}
