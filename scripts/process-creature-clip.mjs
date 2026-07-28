import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { cropSettingsForStage, PROCESS_CELL_SIZE, clipGrid, chromaKeyForSpecies } from './creature-manifest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')

const CLIP_MODES = {
  idle: { align: 'feet' },
  move: { align: 'feet' },
  hurt: { align: 'feet' },
  bite: { align: 'feet' },
  jump: { align: 'feet' },
  hatch: { align: 'feet' }
}

function parseArgs(argv) {
  const options = {
    input: '',
    species: 'neutral',
    stage: 'baby',
    clip: 'idle',
    outputDir: '',
    cellSize: PROCESS_CELL_SIZE,
    rows: 0,
    cols: 0,
    labelPrefix: '',
    align: '',
    chromaKey: '',
    fitScale: 0,
    baselineY: -1,
    preserveCellPosition: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--input':
        options.input = resolve(next)
        i++
        break
      case '--species':
        options.species = next
        i++
        break
      case '--stage':
        options.stage = next
        i++
        break
      case '--clip':
        options.clip = next
        i++
        break
      case '--output-dir':
        options.outputDir = resolve(next)
        i++
        break
      case '--cell-size':
        options.cellSize = Number(next)
        i++
        break
      case '--rows':
        options.rows = Number(next)
        i++
        break
      case '--cols':
        options.cols = Number(next)
        i++
        break
      case '--label-prefix':
        options.labelPrefix = next
        i++
        break
      case '--align':
        options.align = next
        i++
        break
      case '--chroma-key':
        options.chromaKey = next
        i++
        break
      case '--fit-scale':
        options.fitScale = Number(next)
        i++
        break
      case '--baseline-y':
        options.baselineY = Number(next)
        i++
        break
      case '--preserve-cell-position':
        options.preserveCellPosition = true
        break
      default:
        break
    }
  }

  if (!options.input) {
    throw new Error('Missing required --input <raw-sheet.png>')
  }
  if (options.fitScale && (options.fitScale <= 0 || options.fitScale > 1)) {
    throw new Error('--fit-scale must be greater than 0 and at most 1')
  }
  if (options.baselineY >= options.cellSize) {
    throw new Error('--baseline-y must be smaller than --cell-size')
  }

  const preset = CLIP_MODES[options.clip] ?? CLIP_MODES.idle
  const grid = clipGrid(options.stage, options.clip)
  if (!options.outputDir) {
    options.outputDir = join(repoRoot, 'sprite-output', options.species, options.stage, options.clip)
  }
  if (!options.rows) options.rows = grid.rows
  if (!options.cols) options.cols = grid.cols
  if (!options.labelPrefix) options.labelPrefix = options.clip
  if (!options.align) options.align = preset.align ?? 'feet'

  return options
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Usage: node scripts/process-creature-clip.mjs --input <raw.png> --species neutral --stage baby --clip idle [--fit-scale 0.85] [--baseline-y 176] [--preserve-cell-position] [--align feet|bottom|center] [--chroma-key magenta] [--no-post] [--no-stitch]`)
    process.exit(0)
  }

  const options = parseArgs(argv)
  const crop = cropSettingsForStage(options.stage)
  const cropper = join(__dirname, 'creature_sheet_crop.py')
  const args = [
    cropper,
    '--input', options.input,
    '--output-dir', options.outputDir,
    '--cell-size', String(options.cellSize),
    '--rows', String(options.rows),
    '--cols', String(options.cols),
    '--label-prefix', options.labelPrefix,
    '--shared-scale',
    '--align', options.align,
    '--cell-inset-ratio', String(crop.cellInsetRatio),
    '--cell-inset-min', String(crop.cellInsetMin),
    '--trim-border', String(crop.trimBorder),
    '--edge-clean-depth', String(crop.edgeCleanDepth),
    '--min-component-area', String(crop.minComponentArea),
    '--component-padding', String(crop.componentPadding),
    '--component-mode', crop.componentMode,
    '--fit-scale', String(options.fitScale || crop.fitScale),
    '--threshold', String(crop.threshold),
    '--edge-threshold', String(crop.edgeThreshold),
    '--chroma-key', options.chromaKey || chromaKeyForSpecies(options.species)
  ]
  if (options.baselineY >= 0) {
    args.push('--baseline-y', String(options.baselineY))
  }
  if (options.preserveCellPosition) {
    args.push('--preserve-cell-position')
  }

  const python = process.env.PYTHON || 'python'
  const result = spawnSync(python, args, { stdio: 'inherit', cwd: repoRoot })
  if (result.status !== 0) process.exit(result.status ?? 1)

  const noPost = argv.includes('--no-post')
  const noStitch = argv.includes('--no-stitch')

  if (!noPost && options.stage === 'egg' && options.clip === 'hatch') {
    const moveRef = join(repoRoot, 'sprite-output', options.species, 'egg', 'move', 'move-1.png')
    const rawCandidates = [
      join(options.outputDir, 'raw-sheet-clean.png'),
      options.input
    ]
    const rawSheet = rawCandidates.find((path) => existsSync(path))
    if (existsSync(moveRef) && rawSheet) {
      const stagedDir = join(options.outputDir, '_processed')
      mkdirSync(stagedDir, { recursive: true })
      for (let i = 1; i <= options.rows * options.cols; i++) {
        const src = join(options.outputDir, `${options.labelPrefix}-${i}.png`)
        const dest = join(stagedDir, `${options.labelPrefix}-${i}.png`)
        if (existsSync(src)) copyFileSync(src, dest)
      }
      const finalize = spawnSync(
        python,
        [
          join(__dirname, 'finalize_creature_hatch.py'),
          '--raw-sheet', rawSheet,
          '--processed-dir', stagedDir,
          '--move-reference', moveRef,
          '--prefix', options.labelPrefix,
          '--in-place',
          '--output-dir', options.outputDir
        ],
        { stdio: 'inherit', cwd: repoRoot }
      )
      if (finalize.status !== 0) process.exit(finalize.status ?? 1)
    }
  }

  if (noStitch) process.exit(0)

  let frameSize = options.cellSize
  const adaptiveMeta = join(options.outputDir, 'adaptive-meta.json')
  if (existsSync(adaptiveMeta)) {
    const meta = JSON.parse(readFileSync(adaptiveMeta, 'utf8'))
    if (meta.frameSize) frameSize = meta.frameSize
  }

  const stitch = spawnSync(
    python,
    [
      join(__dirname, 'stitch_sprite_strip.py'),
      '--input-dir', options.outputDir,
      '--output', join(repoRoot, 'assets', 'creatures', options.species, options.stage, `${options.clip}.png`),
      '--prefix', options.labelPrefix,
      '--frame-size', String(frameSize)
    ],
    { stdio: 'inherit', cwd: repoRoot }
  )
  process.exit(stitch.status ?? 1)
}

main()
