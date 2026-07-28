import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsRoot = join(__dirname, '..', 'assets')

const REQUIRED_FILES = [
  'ui/taskino-logo.png',
  'ui/hud-icon-dino.png',
  'ui/hud-icon-collection.png',
  'ui/hud-icon-inventory.png',
  'ui/hud-icon-minigame.png',
  'ui/item-food-basic.png',
  'ui/item-water.png'
]

function main() {
  const missing = REQUIRED_FILES.filter(
    (relativePath) => !existsSync(join(assetsRoot, relativePath))
  )

  console.log('Taskino asset check')
  console.log(`Assets root: ${assetsRoot}`)
  console.log('')

  if (missing.length > 0) {
    console.log('Required UI assets: MISSING')
    for (const relativePath of missing) {
      console.log(`  - ${relativePath}`)
    }
    process.exit(1)
  }

  console.log(`Required UI assets: ${REQUIRED_FILES.length}/${REQUIRED_FILES.length} present.`)
  console.log('Creature strips are validated separately by npm run check:creatures.')
}

main()
