import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { CREATURE_SPECIES, STAGE_CLIPS, clipGrid } from './creature-manifest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const assetsRoot = join(repoRoot, 'assets')

const ELEMENTS = [
  'fire',
  'grass',
  'ground',
  'electric',
  'water',
  'ice',
  'dragon',
  'dark',
  'neutral'
]

const RUNTIME_UI = new Set([
  'ui/taskino-logo.png',
  'ui/title-bg.png',
  'ui/hud-icon-dino.png',
  'ui/hud-icon-collection.png',
  'ui/hud-icon-inventory.png',
  'ui/hud-icon-minigame.png',
  'ui/hud-icon-market.png',
  'ui/hud-icon-community.png',
  'ui/hud-icon-battle.png',
  'ui/hud-icon-missions.png',
  'ui/hud-icon-settings.png',
  'ui/hud-icon-guide.png',
  'ui/hud-icon-audio-on.png',
  'ui/hud-icon-audio-off.png',
  'ui/hud-stat-gems.png',
  'ui/hud-stat-clicks.png',
  'ui/hud-stat-typing.png',
  'ui/hud-stat-activity.png',
  'ui/item-food-basic.png',
  'ui/item-food-premium.png',
  'ui/item-medicine.png',
  'ui/item-water.png',
  'ui/item-toy.png',
  'ui/item-dev-vitamin.png',
  'ui/item-battle-shield.png',
  'ui/item-breed-nest.png',
  'ui/item-skill-forget.png',
  'ui/home-bg/manifest.json'
])

const RUNTIME_BATTLE = new Set([
  'battle/forest-arena.png',
  'battle/command-icons/attack.png',
  'battle/command-icons/defend.png',
  'battle/command-icons/item.png',
  'battle/command-icons/flee.png',
  'battle/control-icons/speed.png',
  'battle/control-icons/pause.png',
  'battle/control-icons/log.png',
  'battle/generated-icons/battle-icon-1.png',
  'battle/generated-icons/battle-icon-2.png',
  'battle/generated-icons/battle-icon-4.png',
  'battle/skill-icons/manifest.json'
])

function walk(dir) {
  const entries = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) entries.push(...walk(path))
    else entries.push(path)
  }
  return entries
}

function rel(path) {
  return relative(assetsRoot, path).replace(/\\/g, '/')
}

function addHomeBgFrames(keep) {
  const manifestPath = join(assetsRoot, 'ui/home-bg/manifest.json')
  if (!existsSync(manifestPath)) return
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const element of Object.keys(manifest.elements ?? {})) {
    for (let frame = 0; frame < 4; frame += 1) {
      keep.add(`ui/home-bg/${element}/frame-${frame}.png`)
    }
  }
}

function addSkillIcons(keep) {
  const manifestPath = join(assetsRoot, 'battle/skill-icons/manifest.json')
  if (!existsSync(manifestPath)) return
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const icon of manifest.icons ?? []) {
    keep.add(`battle/skill-icons/${icon.file}`)
  }
}

function addCreatureStrips(keep) {
  keep.add('creatures/frame-manifest.json')
  for (const species of CREATURE_SPECIES) {
    for (const [stage, clips] of Object.entries(STAGE_CLIPS)) {
      for (const clip of clips) {
        keep.add(`creatures/${species}/${stage}/${clip}.png`)
      }
    }
  }
}

function addBattleFx(keep) {
  for (const element of ELEMENTS) {
    for (const kind of ['projectile', 'impact', 'aura']) {
      keep.add(`battle/fx/${element}/${kind}/animation.gif`)
    }
  }
}

function addPrototypePromoteArtifacts(keep) {
  keep.add('creature-prototypes/README.md')
  const prototypeRoot = join(assetsRoot, 'creature-prototypes')

  for (const species of CREATURE_SPECIES) {
    const speciesRoot = join(prototypeRoot, species)
    if (!existsSync(speciesRoot)) continue
    for (const name of readdirSync(speciesRoot)) {
      const lower = name.toLowerCase()
      if (
        lower.endsWith('.png')
        || (lower.startsWith('qc') && lower.endsWith('.json'))
        || lower === 'prompt-used.txt'
      ) {
        keep.add(`creature-prototypes/${species}/${name}`)
      }
    }

    for (const [stage, clips] of Object.entries(STAGE_CLIPS)) {
      for (const clip of clips) {
        const actionDir = join(speciesRoot, 'animations', stage, clip)
        if (!existsSync(actionDir)) continue
        keep.add(`creature-prototypes/${species}/animations/${stage}/${clip}/qc.json`)
        const frames = clipGrid(stage, clip).frames
        for (let frame = 1; frame <= frames; frame += 1) {
          keep.add(`creature-prototypes/${species}/animations/${stage}/${clip}/${clip}-${frame}.png`)
        }
      }
    }
  }
}

function shouldRemovePath(relativePath) {
  if (relativePath.startsWith('ui/home-bg-work/')) return true
  if (relativePath.includes('-work/')) return true
  if (relativePath.startsWith('creature-prototypes/boss-kmutnb/')) return true
  if (relativePath.includes('-prev/')) return true
  if (relativePath.startsWith('battle/skill-icons/raw/')) return true
  if (relativePath.startsWith('battle/skill-icons/prompts/')) return true
  if (relativePath === 'battle/battle-icon-pack-raw.png') return true
  if (relativePath === 'ui/dash-bg-hatch-v2.png') return true

  if (relativePath.startsWith('battle/fx/')) {
    return !relativePath.endsWith('/animation.gif')
  }

  if (relativePath.startsWith('battle/generated-icons/')) {
    return !['battle/generated-icons/battle-icon-1.png', 'battle/generated-icons/battle-icon-2.png', 'battle/generated-icons/battle-icon-4.png'].includes(relativePath)
  }

  if (relativePath.startsWith('battle/control-icons/')) {
    return !['battle/control-icons/speed.png', 'battle/control-icons/pause.png', 'battle/control-icons/log.png'].includes(relativePath)
  }

  if (relativePath.startsWith('creature-prototypes/')) {
    if (relativePath === 'creature-prototypes/README.md') return false
    if (/^creature-prototypes\/[^/]+\.(json|md)$/.test(relativePath)) {
      return relativePath !== 'creature-prototypes/README.md'
    }
    if (relativePath.includes('/references/')) return true
    const base = relativePath.split('/').pop() ?? ''
    if (
      base.startsWith('raw-sheet')
      || base === 'sheet-transparent.png'
      || base === 'animation.gif'
      || base === 'pipeline-meta.json'
      || base === 'prompt-used.txt'
      || base === 'anchor-contract.json'
      || base.endsWith('-finalize-meta.json')
    ) {
      return true
    }
  }

  return false
}

function buildKeepSet() {
  const keep = new Set([...RUNTIME_UI, ...RUNTIME_BATTLE])
  addHomeBgFrames(keep)
  addSkillIcons(keep)
  addCreatureStrips(keep)
  addBattleFx(keep)
  addPrototypePromoteArtifacts(keep)
  return keep
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const keep = buildKeepSet()
  const allFiles = walk(assetsRoot)
  const toRemove = []

  for (const filePath of allFiles) {
    const relativePath = rel(filePath)
    if (keep.has(relativePath)) continue
    if (shouldRemovePath(relativePath)) toRemove.push(filePath)
  }

  toRemove.sort()

  console.log(`Keep set: ${keep.size} files`)
  console.log(`${dryRun ? 'Would remove' : 'Removing'}: ${toRemove.length} files`)

  const sample = toRemove.slice(0, 20).map((path) => rel(path))
  if (sample.length > 0) {
    console.log('Sample:')
    for (const path of sample) console.log(`  - ${path}`)
    if (toRemove.length > sample.length) {
      console.log(`  ... and ${toRemove.length - sample.length} more`)
    }
  }

  if (dryRun) return

  for (const filePath of toRemove) {
    rmSync(filePath, { force: true })
  }

  pruneEmptyDirs(join(assetsRoot, 'ui'))
  pruneEmptyDirs(join(assetsRoot, 'battle'))
  pruneEmptyDirs(join(assetsRoot, 'creature-prototypes'))

  console.log('Done.')
}

function pruneEmptyDirs(root) {
  if (!existsSync(root)) return
  for (const name of readdirSync(root)) {
    const path = join(root, name)
    if (!statSync(path).isDirectory()) continue
    pruneEmptyDirs(path)
    if (readdirSync(path).length === 0) rmSync(path, { recursive: true, force: true })
  }
}

main()
