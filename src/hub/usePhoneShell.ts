import { useEffect, useState } from 'react'
import { matchesPhoneShell, PHONE_SHELL_QUERY } from './phoneShell'

export { PHONE_SHELL_QUERY }

export function usePhoneShell(): boolean {
  const [isPhoneShell, setIsPhoneShell] = useState(matchesPhoneShell)

  useEffect(() => {
    const media = window.matchMedia(PHONE_SHELL_QUERY)
    const sync = () => setIsPhoneShell(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return isPhoneShell
}
