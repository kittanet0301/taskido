import type { SyntheticEvent } from 'react'

interface Props { pathId: string; className?: string }

export function skillIconSrc(pathId: string): string {
  return `/battle/skill-icons/${encodeURIComponent(pathId)}.png`
}

function useFallback(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  if (image.dataset.fallback === 'true') return
  image.dataset.fallback = 'true'
  image.src = '/battle/command-icons/attack.png'
}

/** Decorative artwork; the adjacent translated skill name remains the accessible label. */
export function SkillIcon({ pathId, className = '' }: Props) {
  return <img className={`skill-icon${className ? ` ${className}` : ''}`} src={skillIconSrc(pathId)} alt="" aria-hidden="true" draggable={false} onError={useFallback} />
}
