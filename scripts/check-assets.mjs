import { existsSync, readFileSync, readdirSync } from 'fs'
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

function catalogSkillIds() {
  const source = readFileSync(join(__dirname, '..', 'src', 'shared', 'battle', 'skillTrees.ts'), 'utf8')
  const baseBlock = source.match(/const BASE_SLUGS:[\s\S]*?= \{([\s\S]*?)\n\}/)?.[1]
  const ultBlock = source.match(/const ULT_SLUG:[\s\S]*?= \{([\s\S]*?)\n\}/)?.[1]
  if (!baseBlock || !ultBlock) throw new Error('Could not parse skill catalog source')

  const ids = []
  for (const match of baseBlock.matchAll(/^\s{2}(\w+): \[([\s\S]*?)^\s{2}\]/gm)) {
    const [, element, rows] = match
    for (const slug of rows.matchAll(/slug: '([^']+)'/g)) ids.push(`${element}_${slug[1]}`)
  }
  for (const match of ultBlock.matchAll(/^\s{2}(\w+): '([^']+)'/gm)) ids.push(`${match[1]}_${match[2]}`)
  return ids.sort()
}

function validateSkillIcons() {
  const iconRoot = join(assetsRoot, 'battle', 'skill-icons')
  const manifestPath = join(iconRoot, 'manifest.json')
  if (!existsSync(manifestPath)) return ['battle/skill-icons/manifest.json is missing']
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const expected = catalogSkillIds()
  const declared = manifest.icons.map((icon) => icon.pathId).sort()
  const actual = readdirSync(iconRoot).filter((name) => name.endsWith('.png')).map((name) => name.slice(0, -4)).sort()
  const errors = []
  if (manifest.schema !== 'taskino.skill-icons.v1') errors.push('skill icon manifest schema is invalid')
  if (manifest.count !== expected.length || declared.length !== expected.length) errors.push(`skill icon manifest count must be ${expected.length}`)
  for (const id of expected) {
    if (!declared.includes(id)) errors.push(`manifest missing ${id}`)
    if (!actual.includes(id)) errors.push(`icon missing ${id}.png`)
  }
  for (const id of actual) if (!expected.includes(id)) errors.push(`unexpected icon ${id}.png`)
  for (const id of actual) {
    const png = readFileSync(join(iconRoot, `${id}.png`))
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    const colorType = png[25]
    if (width !== 128 || height !== 128) errors.push(`${id}.png must be 128x128`)
    if (colorType !== 4 && colorType !== 6) errors.push(`${id}.png must contain an alpha channel`)
  }
  return errors
}

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

  const skillIconErrors = validateSkillIcons()
  if (skillIconErrors.length > 0) {
    console.log('Skill icons: INVALID')
    for (const error of skillIconErrors) console.log(`  - ${error}`)
    process.exit(1)
  }

  console.log(`Required UI assets: ${REQUIRED_FILES.length}/${REQUIRED_FILES.length} present.`)
  console.log(`Skill icons: ${catalogSkillIds().length}/${catalogSkillIds().length} present and valid.`)
  console.log('Creature strips are validated separately by npm run check:creatures.')
}

main()
