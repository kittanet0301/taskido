import { describe, expect, it } from 'vitest'
import { matchesPhoneShell, PHONE_SHELL_QUERY } from './phoneShell'

describe('phoneShell', () => {
  it('targets narrow widths or short landscape heights', () => {
    expect(PHONE_SHELL_QUERY).toBe('(max-width: 900px), (max-height: 520px)')
  })

  it('returns false when matchMedia is missing', () => {
    expect(matchesPhoneShell(undefined)).toBe(false)
  })

  it('reads the media query result', () => {
    expect(matchesPhoneShell(() => ({ matches: true }))).toBe(true)
    expect(matchesPhoneShell(() => ({ matches: false }))).toBe(false)
  })
})
