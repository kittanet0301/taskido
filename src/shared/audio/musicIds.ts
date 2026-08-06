export const BGM_IDS = ['title', 'hub', 'battle', 'boss', 'minigame'] as const

export type BgmId = (typeof BGM_IDS)[number]
