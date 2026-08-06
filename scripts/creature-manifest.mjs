import { join } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const repoRoot = join(__dirname, '..')

/** Production roster promoted from assets/creature-prototypes. */
export const CREATURE_SPECIES = [
  'neutral',
  'fire',
  'grass',
  'ground',
  'electric',
  'water',
  'ice',
  'dragon',
  'dark',
  'kmutnb'
]

/** Clips per stage. Keys match folder names under assets/creatures/{species}/ */
export const STAGE_CLIPS = {
  egg: ['move', 'hatch'],
  baby: ['idle', 'move', 'hurt', 'bite', 'jump'],
  adult: ['idle', 'move', 'hurt', 'bite', 'jump']
}

/** Grid layout per clip (for raw generation). */
export const CLIP_GRID = {
  idle: { rows: 2, cols: 2, frames: 4 },
  move: { rows: 2, cols: 2, frames: 4 },
  hurt: { rows: 2, cols: 2, frames: 4 },
  bite: { rows: 2, cols: 2, frames: 4 },
  jump: { rows: 2, cols: 2, frames: 4 },
  hatch: { rows: 2, cols: 3, frames: 6 }
}

/** Stage+clip overrides (e.g. baby idle master sheet, egg strips). */
export const STAGE_CLIP_GRID = {
  'egg:move': { rows: 2, cols: 3, frames: 6 },
  'egg:hatch': { rows: 2, cols: 3, frames: 6 }
}

export function clipGrid(stage, clip) {
  return STAGE_CLIP_GRID[`${stage}:${clip}`] ?? CLIP_GRID[clip] ?? CLIP_GRID.idle
}

export const CLIP_ALIGN = {
  idle: 'feet',
  move: 'feet',
  hurt: 'feet',
  bite: 'feet',
  jump: 'feet',
  hatch: 'feet'
}

/** Interim process canvas before per-clip adaptive fit. */
export const PROCESS_CELL_SIZE = 192

/** Cropper tuning — cell inset avoids bleed from neighbouring grid cells. */
export const CROP_SETTINGS = {
  cellInsetRatio: 0.03,
  cellInsetMin: 10,
  trimBorder: 6,
  edgeCleanDepth: 2,
  minComponentArea: 96,
  componentPadding: 2,
  componentMode: 'largest',
  fitScale: 0.85,
  threshold: 100,
  edgeThreshold: 150,
  chromaKey: 'green'
}

/** Looser crop for long adult silhouettes (tail + dorsal sail). */
export const ADULT_CROP_SETTINGS = {
  ...CROP_SETTINGS,
  cellInsetRatio: 0.01,
  cellInsetMin: 4,
  trimBorder: 4,
  edgeCleanDepth: 1,
  componentPadding: 6,
  componentMode: 'all',
  fitScale: 0.78
}

export function cropSettingsForStage(stage) {
  return stage === 'adult' ? ADULT_CROP_SETTINGS : CROP_SETTINGS
}

/** Raw generation always uses the roster-wide #FF00FF contract. */
export const SPECIES_CHROMA_KEY = Object.fromEntries(
  CREATURE_SPECIES.map((species) => [species, 'magenta'])
)

export function chromaKeyForSpecies(species) {
  return SPECIES_CHROMA_KEY[species] ?? CROP_SETTINGS.chromaKey
}

const SPECIES_BOARD_FILES = {}

export function spriteOutputDir(species, stage, clip) {
  return join(repoRoot, 'sprite-output', species, stage, clip)
}

export function assetOutputPath(species, stage, clip) {
  return join(repoRoot, 'assets', 'creatures', species, stage, `${clip}.png`)
}

export function masterReferencePath(species, stage = 'baby') {
  return join(repoRoot, 'sprite-output', species, `master-${stage}.png`)
}

export function masterAdultRawPath(species = 'neutral') {
  return join(repoRoot, 'assets', 'raw-creatures', species, 'master-adult.png')
}

export function masterAdultPlanPath(species = 'neutral') {
  return join(repoRoot, 'sprite-output', species, 'master-adult-plan.json')
}

export function speciesBoardPath(species = 'neutral') {
  const file = SPECIES_BOARD_FILES[species] ?? `${species}-species-board.png`
  return join(repoRoot, 'assets', 'new', file)
}

export function frameManifestPath() {
  return join(repoRoot, 'assets', 'creatures', 'frame-manifest.json')
}

export function frameManifestTsPath() {
  return join(repoRoot, 'src', 'shared', 'creatureFrameManifest.ts')
}

export function megaSheetPath(species) {
  return join(repoRoot, 'assets', 'raw-creatures', species, 'mega-sheet.png')
}

/** Where to look for magenta raw sheets (first match wins). */
export function rawInputCandidates(species, stage, clip) {
  const cursorAssets = join(
    homedir(),
    '.cursor',
    'projects',
    'c-Users-Kittanet-OneDrive-Desktop-taskido',
    'assets'
  )
  return [
    join(repoRoot, 'assets', 'raw-creatures', species, `${stage}-${clip}.png`),
    join(repoRoot, 'assets', 'raw-creatures', species, stage, `${clip}.png`),
    join(spriteOutputDir(species, stage, clip), 'raw-sheet-clean.png'),
    join(spriteOutputDir(species, stage, clip), 'raw-sheet.png'),
    join(cursorAssets, `raw-${species}-${stage}-${clip}-v2.png`),
    join(cursorAssets, `raw-${species}-${stage}-${clip}.png`),
    join(cursorAssets, `${species}-${stage}-${clip}-raw.png`)
  ]
}

export function listJobs(species, stages = Object.keys(STAGE_CLIPS)) {
  const jobs = []
  for (const stage of stages) {
    for (const clip of STAGE_CLIPS[stage] ?? []) {
      jobs.push({ species, stage, clip, ...clipGrid(stage, clip) })
    }
  }
  return jobs
}
