/** Phone shell when the viewport is narrow or a short landscape phone. */
export const PHONE_SHELL_QUERY = '(max-width: 900px), (max-height: 520px)'

export function matchesPhoneShell(
  matchMedia: ((query: string) => { matches: boolean }) | undefined = typeof window === 'undefined'
    ? undefined
    : window.matchMedia?.bind(window)
): boolean {
  if (!matchMedia) return false
  return matchMedia(PHONE_SHELL_QUERY).matches
}
