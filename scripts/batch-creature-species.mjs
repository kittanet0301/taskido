import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { buildGenPlanEntry, buildMegaSheetPrompt } from './creature-gen-prompts.mjs'
import {
  CLIP_ALIGN,
  PROCESS_CELL_SIZE,
  assetOutputPath,
  chromaKeyForSpecies,
  frameManifestPath,
  frameManifestTsPath,
  listJobs,
  masterAdultRawPath,
  masterReferencePath,
  megaSheetPath,
  rawInputCandidates,
  repoRoot,
  speciesBoardPath,
  spriteOutputDir,
  STAGE_CLIPS
} from './creature-manifest.mjs'
import {
  MEGA_SHEET_CELL,
  MEGA_SHEET_LAYOUT,
  megaGenPlanPath,
  megaSheetCanvasSize,
  rawClipPath
} from './mega-sheet-layout.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const options = {
    species: 'neutral',
    command: 'all',
    stages: '',
    reference: ''
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--species':
        options.species = next
        i++
        break
      case '--stages':
        options.stages = next
        i++
        break
      case '--reference':
        options.reference = next
        i++
        break
      case 'plan':
      case 'plan-master-adult':
      case 'plan-mega':
      case 'compose-mega':
      case 'process':
      case 'normalize':
      case 'adaptive':
      case 'slice':
      case 'stitch':
      case 'finalize-master-adult':
      case 'mega':
      case 'all':
        options.command = arg
        break
      default:
        break
    }
  }

  return options
}

function run(cmd, args, label) {
  console.log(`\n>> ${label}`)
  const result = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot })
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status ?? 1})`)
  }
}

function findRaw(species, stage, clip) {
  return rawInputCandidates(species, stage, clip).find((path) => existsSync(path)) ?? null
}

function ensureMasterFromFrame(species, stage, framePath) {
  const master = masterReferencePath(species, stage)
  if (!existsSync(framePath)) {
    throw new Error(`Missing frame for master-${stage}: ${framePath}`)
  }
  mkdirSync(dirname(master), { recursive: true })
  copyFileSync(framePath, master)
  console.log(`Master ${stage}: ${master}`)
  return master
}

function ensureMasterReference(species, stage, explicitRef) {
  if (explicitRef && existsSync(explicitRef)) return explicitRef

  const master = masterReferencePath(species, stage)
  if (existsSync(master)) return master

  if (stage === 'egg') {
    const move1 = join(spriteOutputDir(species, 'egg', 'move'), 'move-1.png')
    if (existsSync(move1)) return ensureMasterFromFrame(species, 'egg', move1)
  }

  if (stage === 'baby') {
    const idle4 = join(spriteOutputDir(species, 'baby', 'idle'), 'idle-4.png')
    const idle1 = join(spriteOutputDir(species, 'baby', 'idle'), 'idle-1.png')
    const hatch6 = join(spriteOutputDir(species, 'egg', 'hatch'), 'hatch-6.png')
    if (existsSync(idle4)) return ensureMasterFromFrame(species, 'baby', idle4)
    if (existsSync(idle1)) return ensureMasterFromFrame(species, 'baby', idle1)
    if (existsSync(hatch6)) return ensureMasterFromFrame(species, 'baby', hatch6)
  }

  if (stage === 'adult') {
    throw new Error(
      `Master adult missing for ${species}. Gen from master-baby:\n` +
        `  npm run creature:batch -- plan-master-adult --species ${species}\n` +
        `  (GenerateImage using master-adult-plan.json, save raw)\n` +
        `  npm run creature:batch -- finalize-master-adult --species ${species}`
    )
  }

  throw new Error(`Master reference missing for ${stage}. Process ${stage}/idle first.\n  Expected: ${master}`)
}

function selectedStages(stagesArg) {
  if (!stagesArg) return Object.keys(STAGE_CLIPS)
  return stagesArg.split(',').map((s) => s.trim()).filter(Boolean)
}

function writeGenPlan(species, jobs) {
  const board = speciesBoardPath(species)
  const rawDir = join(repoRoot, 'assets', 'raw-creatures', species)
  mkdirSync(rawDir, { recursive: true })
  mkdirSync(join(repoRoot, 'sprite-output', species), { recursive: true })

  const pathCtx = {
    speciesBoard: existsSync(board) ? board : null,
    masterBaby: masterReferencePath(species, 'baby'),
    masterAdult: masterReferencePath(species, 'adult'),
    saveRawTo: ''
  }

  const plan = {
    species,
    workflow:
      '1) Egg chain → master-baby. 2) plan-master-adult → gen master-adult from master-baby. 3) adult clips. 4) npm run creature:batch -- all',
    masters: {
      baby: pathCtx.masterBaby,
      adult: pathCtx.masterAdult
    },
    speciesBoard: pathCtx.speciesBoard,
    jobs: jobs.map(({ stage, clip }) =>
      buildGenPlanEntry(species, stage, clip, {
        ...pathCtx,
        saveRawTo: join(rawDir, `${stage}-${clip}.png`)
      })
    )
  }

  const planPath = join(repoRoot, 'sprite-output', species, 'gen-plan.json')
  writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8')
  console.log(`Wrote ${planPath}`)
  console.log('\nGen order (recommended):')
  console.log('  1. egg chain → master-baby')
  console.log('  2. plan-master-adult → gen master-adult from master-baby')
  console.log('  3. adult/idle + remaining adult clips')
  console.log('  4. remaining baby clips')
  console.log('\nGen checklist:')
  for (const job of plan.jobs) {
    const raw = findRaw(species, job.stage, job.clip)
    const status = raw ? 'RAW OK' : 'NEEDS GEN'
    console.log(`  [${status}] ${job.stage}/${job.clip} -> ${job.saveRawTo}`)
    console.log(`    grid ${job.grid} (${job.outputSize})`)
  }
}

function processJobs(species, jobs) {
  let processed = 0
  for (const { stage, clip } of jobs) {
    const raw = findRaw(species, stage, clip)
    if (!raw) {
      console.warn(`Skip process ${stage}/${clip}: no raw sheet found`)
      continue
    }
    run(
      'node',
      [
        join(__dirname, 'process-creature-clip.mjs'),
        '--input', raw,
        '--species', species,
        '--stage', stage,
        '--clip', clip,
        '--cell-size', String(PROCESS_CELL_SIZE),
        '--no-post',
        '--no-stitch'
      ],
      `process ${stage}/${clip}`
    )
    processed++
  }
  console.log(`\nProcessed ${processed}/${jobs.length} clips`)
  return processed
}

function finalizeHatch(species) {
  const hatchDir = spriteOutputDir(species, 'egg', 'hatch')
  const moveRef = join(spriteOutputDir(species, 'egg', 'move'), 'move-1.png')
  const rawSheet = [join(hatchDir, 'raw-sheet-clean.png'), ...rawInputCandidates(species, 'egg', 'hatch')].find(
    (path) => existsSync(path)
  )
  if (!rawSheet || !existsSync(moveRef)) {
    console.warn('Skip hatch finalize: missing hatch raw or egg/move reference')
    return
  }

  const stagedDir = join(hatchDir, '_processed')
  mkdirSync(stagedDir, { recursive: true })
  for (let i = 1; i <= 6; i++) {
    const src = join(hatchDir, `hatch-${i}.png`)
    const dest = join(stagedDir, `hatch-${i}.png`)
    if (existsSync(src)) copyFileSync(src, dest)
  }

  run(
    'python',
    [
      join(__dirname, 'finalize_creature_hatch.py'),
      '--raw-sheet', rawSheet,
      '--processed-dir', stagedDir,
      '--move-reference', moveRef,
      '--prefix', 'hatch',
      '--in-place',
      '--output-dir', hatchDir
    ],
    'finalize egg/hatch'
  )

  const hatch6 = join(hatchDir, 'hatch-6.png')
  if (existsSync(hatch6)) {
    lockBabyIdleToHatch(species)
  }
}

/** Lock baby/idle frame 4 height + canvas to processed egg/hatch frame 6. */
function lockBabyIdleToHatch(species) {
  const hatch6 = join(spriteOutputDir(species, 'egg', 'hatch'), 'hatch-6.png')
  const idleDir = spriteOutputDir(species, 'baby', 'idle')
  const idle4 = join(idleDir, 'idle-4.png')

  if (!existsSync(hatch6)) {
    console.warn('Skip baby idle lock: missing hatch-6')
    return
  }
  if (!existsSync(idle4)) {
    console.warn('Skip baby idle lock: missing baby/idle frames')
    return
  }

  run(
    'python',
    [
      join(__dirname, 'normalize_creature_clip_to_ref.py'),
      '--reference-frame', hatch6,
      '--input-dir', idleDir,
      '--prefix', 'idle',
      '--scale-from-frame', '4',
      '--pad', '6',
      '--in-place'
    ],
    'lock baby/idle to hatch-6'
  )

  ensureMasterFromFrame(species, 'baby', join(idleDir, 'idle-4.png'))
}

function planMasterAdult(species) {
  run('node', [join(__dirname, 'write-master-adult-plan.mjs'), species], 'write master-adult plan')
}

function finalizeMasterAdult(species) {
  const masterBaby = masterReferencePath(species, 'baby')
  const masterAdult = masterReferencePath(species, 'adult')
  const raw = masterAdultRawPath(species)

  if (!existsSync(masterBaby)) {
    throw new Error(`Missing master-baby: ${masterBaby}`)
  }
  if (!existsSync(raw)) {
    throw new Error(`Missing master-adult raw: ${raw}\nGen with master-adult-plan.json first.`)
  }

  run(
    'python',
    [
      join(__dirname, 'finalize_master_adult.py'),
      '--raw', raw,
      '--baby-reference', masterBaby,
      '--output', masterAdult,
      '--canvas', String(PROCESS_CELL_SIZE),
      '--pad', '6',
      '--height-multiplier', '1.4',
      '--chroma-key', chromaKeyForSpecies(species)
    ],
    'finalize master-adult from master-baby'
  )
}

/** Per-stage normalize: egg uses egg/move ref; baby baseline; adult 1.4x baby height. */
const STAGE_NORMALIZE = {
  egg: { heightMultiplier: 1.0, heightOnly: false },
  baby: { heightMultiplier: 1.0, heightOnly: false },
  adult: { heightMultiplier: 1.4, heightOnly: true }
}

function normalizeStage(species, stage, stageJobs, options = {}) {
  const availableJobs = stageJobs.filter(({ clip }) =>
    existsSync(join(spriteOutputDir(species, stage, clip), `${clip}-1.png`))
  )
  if (availableJobs.length === 0) return

  const stageDefaults = STAGE_NORMALIZE[stage] ?? STAGE_NORMALIZE.baby
  const heightMultiplier = options.heightMultiplier ?? stageDefaults.heightMultiplier
  const heightOnly = options.heightOnly ?? stageDefaults.heightOnly
  const master =
    options.reference ??
    ensureMasterReference(species, stage === 'adult' ? 'adult' : stage === 'egg' ? 'egg' : 'baby')

  const config = {
    species,
    stage,
    reference: master,
    heightMultiplier,
    heightOnly,
    clips: availableJobs.map(({ clip }) => ({
      stage,
      clip,
      inputDir: spriteOutputDir(species, stage, clip),
      prefix: clip,
      align: CLIP_ALIGN[clip] ?? 'feet'
    }))
  }

  const configPath = join(repoRoot, 'sprite-output', species, `normalize-${stage}.json`)
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

  const args = [
    join(__dirname, 'normalize_creature_species.py'),
    '--reference-frame', master,
    '--config', configPath,
    '--pad', '6',
    '--height-multiplier', String(heightMultiplier)
  ]
  if (heightOnly) args.push('--height-only')

  run('python', args, `normalize ${stage} clips`)
}

function hatchChainFrameSize(species) {
  const metaPath = join(spriteOutputDir(species, 'egg', 'hatch'), 'adaptive-meta.json')
  if (!existsSync(metaPath)) return null
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  return meta.frameSize ?? null
}

function normalizeJobs(species, jobs) {
  if (jobs.some((j) => j.stage === 'egg' && j.clip === 'hatch')) {
    finalizeHatch(species)
  } else if (
    jobs.some((j) => j.stage === 'baby') &&
    existsSync(join(spriteOutputDir(species, 'egg', 'hatch'), 'hatch-6.png'))
  ) {
    lockBabyIdleToHatch(species)
  }

  const eggMoveRef = join(spriteOutputDir(species, 'egg', 'move'), 'move-1.png')
  const babyIdleRef = ensureMasterReference(species, 'baby')

  // Hatch frames are finalized separately; only normalize egg/move to egg scale.
  const eggClips = jobs.filter((j) => j.stage === 'egg' && j.clip !== 'hatch')
  const babyClips = jobs.filter((j) => j.stage === 'baby')
  const adultClips = jobs.filter((j) => j.stage === 'adult')

  if (eggClips.length > 0 && existsSync(eggMoveRef)) {
    normalizeStage(species, 'egg', eggClips, { reference: eggMoveRef })
  }

  normalizeStage(species, 'baby', babyClips, { reference: babyIdleRef })
  if (adultClips.length > 0) {
    const adultRef = ensureMasterReference(species, 'adult')
    normalizeStage(species, 'adult', adultClips, { reference: adultRef, heightMultiplier: 1.0 })
  }
}

function adaptiveJobs(species, jobs) {
  const manifest = { [species]: {} }

  for (const { stage, clip } of jobs) {
    const inputDir = spriteOutputDir(species, stage, clip)
    const frame1 = join(inputDir, `${clip}-1.png`)
    if (!existsSync(frame1)) {
      console.warn(`Skip adaptive ${stage}/${clip}: no processed frames`)
      continue
    }

    const args = [
      join(__dirname, 'adaptive_frame_fit.py'),
      '--input-dir', inputDir,
      '--prefix', clip,
      '--align', CLIP_ALIGN[clip] ?? 'feet'
    ]
    // Keep hatch → baby transition on the same on-screen canvas size.
    if (stage === 'baby' && clip === 'idle') {
      const hatchFrameSize = hatchChainFrameSize(species)
      if (hatchFrameSize) {
        args.push('--min-size', String(hatchFrameSize), '--max-size', String(hatchFrameSize))
      }
    }
    if (stage === 'adult') {
      args.push('--min-size', String(PROCESS_CELL_SIZE))
    }

    run('python', args, `adaptive ${stage}/${clip}`)

    const metaPath = join(inputDir, 'adaptive-meta.json')
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    if (!manifest[species][stage]) manifest[species][stage] = {}
    manifest[species][stage][clip] = {
      frameSize: meta.frameSize,
      frames: meta.frames
    }
  }

  return manifest
}

function writeFrameManifest(manifest) {
  const jsonPath = frameManifestPath()
  mkdirSync(dirname(jsonPath), { recursive: true })

  let merged = manifest
  if (existsSync(jsonPath)) {
    try {
      const existing = JSON.parse(readFileSync(jsonPath, 'utf8'))
      merged = { ...existing }
      for (const [species, stages] of Object.entries(manifest)) {
        merged[species] = { ...(merged[species] ?? {}), ...stages }
        for (const [stage, clips] of Object.entries(stages)) {
          merged[species][stage] = { ...(merged[species][stage] ?? {}), ...clips }
        }
      }
    } catch {
      merged = manifest
    }
  }

  writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf8')
  console.log(`Wrote ${jsonPath}`)

  const tsPath = frameManifestTsPath()
  const ts = `// Auto-generated by scripts/batch-creature-species.mjs — do not edit by hand.
import type { CreatureSpecies } from './creatureCharacters'
import { CREATURE_FRAME_SIZE } from './creatureCharacters'

export type CreatureClipEntry = { frameSize: number; frames: number }

export const CREATURE_FRAME_MANIFEST = ${JSON.stringify(merged, null, 2)} as const satisfies Record<
  CreatureSpecies,
  Record<string, Record<string, CreatureClipEntry>>
>

export function creatureFrameSize(
  species: CreatureSpecies,
  stage: string,
  clip: string
): number | undefined {
  return CREATURE_FRAME_MANIFEST[species]?.[stage]?.[clip]?.frameSize
}

export function creatureMaxFrameSize(species: CreatureSpecies, stage: string): number {
  const clips = CREATURE_FRAME_MANIFEST[species]?.[stage]
  if (!clips) return CREATURE_FRAME_SIZE
  const sizes = Object.values(clips).map((entry) => entry.frameSize)
  return sizes.length > 0 ? Math.max(...sizes) : CREATURE_FRAME_SIZE
}
`
  writeFileSync(tsPath, ts, 'utf8')
  console.log(`Wrote ${tsPath}`)
}

function writeMegaGenPlan(species) {
  const board = speciesBoardPath(species)
  const saveTo = megaSheetPath(species)
  const canvas = megaSheetCanvasSize()
  mkdirSync(dirname(saveTo), { recursive: true })
  mkdirSync(dirname(megaGenPlanPath(species)), { recursive: true })

  const plan = {
    species,
    workflow:
      '1) Gen mega-sheet.png once from species board. 2) npm run creature:batch -- slice. 3) npm run creature:batch -- all',
    canvas,
    cellSize: MEGA_SHEET_CELL,
    layout: MEGA_SHEET_LAYOUT,
    speciesBoard: existsSync(board) ? board : null,
    prompt: buildMegaSheetPrompt(species),
    saveRawTo: saveTo,
    slicedOutputs: MEGA_SHEET_LAYOUT.map((entry) => ({
      ...entry,
      path: rawClipPath(species, entry.stage, entry.clip)
    })),
    notes: 'Generate with image_gen. Attach species board only. Then run slice + all.'
  }

  const planPath = megaGenPlanPath(species)
  writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8')
  console.log(`Wrote ${planPath}`)
  console.log(`\nMega sheet: ${canvas.width}x${canvas.height}px → ${saveTo}`)
  console.log(`Reference: ${plan.speciesBoard ?? '(missing species board)'}`)
  console.log('\nAfter gen, run:')
  console.log(`  npm run creature:batch -- slice --species ${species}`)
  console.log(`  npm run creature:batch -- all --species ${species}`)
}

function composeMegaSheet(species) {
  const layoutPath = megaGenPlanPath(species)
  if (!existsSync(layoutPath)) {
    writeMegaGenPlan(species)
  }
  const outputDir = join(repoRoot, 'assets', 'raw-creatures', species)
  run(
    'python',
    [
      join(__dirname, 'compose_mega_creature_sheet.py'),
      '--layout-json', layoutPath,
      '--input-dir', outputDir,
      '--output', megaSheetPath(species)
    ],
    'compose mega sheet from per-clip raws'
  )
}

function sliceMegaSheet(species) {
  const input = megaSheetPath(species)
  if (!existsSync(input)) {
    throw new Error(`Mega sheet missing: ${input}\nRun plan-mega, generate the image, then slice.`)
  }

  const layoutPath = megaGenPlanPath(species)
  if (!existsSync(layoutPath)) {
    writeMegaGenPlan(species)
  }

  const outputDir = join(repoRoot, 'assets', 'raw-creatures', species)
  run(
    'python',
    [
      join(__dirname, 'slice_mega_creature_sheet.py'),
      '--input', input,
      '--layout-json', layoutPath,
      '--output-dir', outputDir,
      '--cell-size', String(MEGA_SHEET_CELL)
    ],
    'slice mega sheet'
  )
}

function stitchJobs(species, jobs) {
  for (const { stage, clip } of jobs) {
    const inputDir = spriteOutputDir(species, stage, clip)
    const output = assetOutputPath(species, stage, clip)
    const frame1 = join(inputDir, `${clip}-1.png`)
    if (!existsSync(frame1)) {
      console.warn(`Skip stitch ${stage}/${clip}: no processed frames`)
      continue
    }

    const metaPath = join(inputDir, 'adaptive-meta.json')
    let frameSize = PROCESS_CELL_SIZE
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      if (meta.frameSize) frameSize = meta.frameSize
    }

    run(
      'python',
      [
        join(__dirname, 'stitch_sprite_strip.py'),
        '--input-dir', inputDir,
        '--output', output,
        '--prefix', clip,
        '--frame-size', String(frameSize)
      ],
      `stitch ${stage}/${clip}`
    )
  }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Usage:
  npm run creature:batch -- plan
  npm run creature:batch -- plan-master-adult
  npm run creature:batch -- finalize-master-adult
  npm run creature:batch -- plan-mega
  npm run creature:batch -- compose-mega
  npm run creature:batch -- slice
  npm run creature:batch -- process
  npm run creature:batch -- normalize
  npm run creature:batch -- adaptive
  npm run creature:batch -- stitch
  npm run creature:batch -- mega
  npm run creature:batch -- all

Options:
  --species neutral
  --stages egg,baby,adult`)
    process.exit(0)
  }

  const options = parseArgs(argv)
  const stages = selectedStages(options.stages)
  const jobs = listJobs(options.species, stages)

  switch (options.command) {
    case 'plan':
      writeGenPlan(options.species, jobs)
      break
    case 'plan-master-adult':
      planMasterAdult(options.species)
      break
    case 'finalize-master-adult':
      finalizeMasterAdult(options.species)
      break
    case 'plan-mega':
      writeMegaGenPlan(options.species)
      break
    case 'compose-mega':
      composeMegaSheet(options.species)
      break
    case 'slice':
      sliceMegaSheet(options.species)
      break
    case 'process':
      processJobs(options.species, jobs)
      break
    case 'normalize':
      normalizeJobs(options.species, jobs)
      break
    case 'adaptive': {
      const manifest = adaptiveJobs(options.species, jobs)
      writeFrameManifest(manifest)
      break
    }
    case 'stitch':
      stitchJobs(options.species, jobs)
      break
    case 'mega': {
      writeMegaGenPlan(options.species)
      const megaInput = megaSheetPath(options.species)
      if (!existsSync(megaInput)) {
        console.warn(`\nMega sheet not found: ${megaInput}`)
        console.warn('Generate it with image_gen using mega-gen-plan.json, then re-run mega.')
        process.exit(1)
      }
      sliceMegaSheet(options.species)
      processJobs(options.species, jobs)
      normalizeJobs(options.species, jobs)
      const manifest = adaptiveJobs(options.species, jobs)
      writeFrameManifest(manifest)
      stitchJobs(options.species, jobs)
      run('node', [join(__dirname, 'check-creature-assets.mjs')], 'check:creatures')
      break
    }
    case 'all': {
      writeGenPlan(options.species, jobs)
      processJobs(options.species, jobs)
      normalizeJobs(options.species, jobs)
      const manifest = adaptiveJobs(options.species, jobs)
      writeFrameManifest(manifest)
      stitchJobs(options.species, jobs)
      run('node', [join(__dirname, 'check-creature-assets.mjs')], 'check:creatures')
      break
    }
    default:
      throw new Error(`Unknown command: ${options.command}`)
  }
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
