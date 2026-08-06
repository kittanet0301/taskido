import type { GameAPI } from './api/types'

declare global {
  interface Window {
    electronAPI: GameAPI
  }
}

declare module '*.md?raw' {
  const content: string
  export default content
}

export {}
