import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAuthError } from '../shared/formatError'
import { PixelCoverShell } from './PixelCoverShell'

interface Props {
  onLoggedIn: () => void
}

/** Re-enable when password recovery flow is ready. */
const SHOW_FORGOT_PASSWORD = false

function AuthShell({
  tagline,
  message,
  children,
  footer
}: {
  tagline: string
  message: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <PixelCoverShell tagline={tagline} message={message || undefined} footer={footer}>
      {children}
    </PixelCoverShell>
  )
}

type AuthView = 'login' | 'signup' | 'forgot'

function LoginPage({
  onLoggedIn,
  onGoSignUp,
  onGoForgot
}: {
  onLoggedIn: () => void
  onGoSignUp: () => void
  onGoForgot?: () => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    setMessage('')
    try {
      await window.electronAPI.signIn(email, password)
      await window.electronAPI.reloadFromCloud()
      onLoggedIn()
    } catch (e) {
      setMessage(formatAuthError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      tagline={t('auth.taglineLogin')}
      message={message}
      footer={
        <>
          {t('auth.switchNoAccount')}{' '}
          <button type="button" className="auth-link" onClick={onGoSignUp} disabled={loading}>
            {t('common.signUp')}
          </button>
        </>
      }
    >
      <div className="form-row">
        <label>{t('auth.emailLabel')}</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('common.placeholderEmail')}
          disabled={loading}
          autoComplete="email"
        />
      </div>
      <div className="form-row">
        <label>{t('auth.passwordLabel')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.passwordLabel')}
          disabled={loading}
          autoComplete="current-password"
        />
      </div>

      {onGoForgot && (
        <p className="pixel-forgot-link">
          <button type="button" className="auth-link" onClick={onGoForgot} disabled={loading}>
            {t('auth.forgotPassword')}
          </button>
        </p>
      )}

      <button className="primary cover-btn pixel-btn" onClick={signIn} disabled={loading}>
        {loading ? t('auth.loadingLogin') : t('common.login')}
      </button>
    </AuthShell>
  )
}

function ForgotPasswordPage({ onGoLogin }: { onGoLogin: () => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const reset = async () => {
    if (!email.trim()) {
      setMessage(t('auth.needEmail'))
      return
    }
    setLoading(true)
    setMessage('')
    try {
      await window.electronAPI.resetPasswordByBirthdate(email.trim())
      setDone(true)
      setMessage(t('auth.resetPasswordDone'))
    } catch (e) {
      setMessage(formatAuthError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      tagline={done ? t('auth.forgotPasswordDoneTitle') : t('auth.forgotPasswordTitle')}
      message={message}
      footer={
        <button type="button" className="auth-link" onClick={onGoLogin} disabled={loading}>
          {t('common.backToLogin')}
        </button>
      }
    >
      {!done && (
        <>
          <p className="pixel-hint">{t('auth.forgotPasswordHint')}</p>
          <div className="form-row">
            <label>{t('auth.emailLabel')}</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('common.placeholderEmail')}
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <button type="button" className="primary cover-btn pixel-btn" onClick={() => void reset()} disabled={loading}>
            {loading ? t('auth.resettingPassword') : t('auth.resetPassword')}
          </button>
        </>
      )}
      {done && (
        <button type="button" className="primary cover-btn pixel-btn" onClick={onGoLogin}>
          {t('common.goToLogin')}
        </button>
      )}
    </AuthShell>
  )
}

function SignUpPage({
  onLoggedIn,
  onGoLogin
}: {
  onLoggedIn: () => void
  onGoLogin: () => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const signUp = async () => {
    if (!username.trim()) {
      setMessage(t('auth.needUsername'))
      return
    }
    if (!email.trim()) {
      setMessage(t('auth.needEmail'))
      return
    }
    if (password.length < 6) {
      setMessage(t('auth.passwordMin'))
      return
    }
    if (password !== confirmPassword) {
      setMessage(t('auth.passwordMismatch'))
      return
    }
    setLoading(true)
    setMessage('')
    try {
      const data = (await window.electronAPI.signUp(email, password, username)) as {
        session: { user: { id: string } } | null
      }
      if (data.session?.user?.id) {
        await window.electronAPI.reloadFromCloud()
        onLoggedIn()
        return
      }
      setMessage(t('auth.signUpSuccessVerifyEmail'))
    } catch (e) {
      setMessage(formatAuthError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      tagline={t('auth.taglineSignup')}
      message={message}
      footer={
        <>
          {t('auth.switchHaveAccount')}{' '}
          <button type="button" className="auth-link" onClick={onGoLogin} disabled={loading}>
            {t('common.login')}
          </button>
        </>
      }
    >
      <div className="form-row">
        <label>{t('auth.usernameLabel')}</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('auth.usernameLabel')}
          disabled={loading}
          autoComplete="username"
          maxLength={32}
        />
      </div>
      <div className="form-row">
        <label>{t('auth.emailLabel')}</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('common.placeholderEmail')}
          disabled={loading}
          autoComplete="email"
        />
      </div>
      <div className="form-row">
        <label>{t('auth.passwordLabel')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.passwordMin')}
          disabled={loading}
          autoComplete="new-password"
        />
      </div>
      <div className="form-row">
        <label>{t('auth.confirmPasswordLabel')}</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('auth.confirmPasswordLabel')}
          disabled={loading}
          autoComplete="new-password"
        />
      </div>

      <button className="primary cover-btn pixel-btn" onClick={signUp} disabled={loading}>
        {loading ? t('auth.loadingSignUp') : t('common.signUp')}
      </button>
    </AuthShell>
  )
}

export function LoginGate({ onLoggedIn }: Props) {
  const [view, setView] = useState<AuthView>('login')

  if (view === 'signup') {
    return <SignUpPage onLoggedIn={onLoggedIn} onGoLogin={() => setView('login')} />
  }

  if (SHOW_FORGOT_PASSWORD && view === 'forgot') {
    return <ForgotPasswordPage onGoLogin={() => setView('login')} />
  }

  return (
    <LoginPage
      onLoggedIn={onLoggedIn}
      onGoSignUp={() => setView('signup')}
      onGoForgot={SHOW_FORGOT_PASSWORD ? () => setView('forgot') : undefined}
    />
  )
}
