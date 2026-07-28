import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildGenPrompt } from './creature-gen-prompts.mjs'
import { clipGrid, repoRoot, speciesBoardPath, spriteOutputDir } from './creature-manifest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const species = process.argv[2] ?? 'neutral'
const rawDir = join(repoRoot, 'assets', 'raw-creatures', species)
const outDir = join(repoRoot, 'sprite-output', species)

mkdirSync(rawDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const board = speciesBoardPath(species)
const moveRef = join(spriteOutputDir(species, 'egg', 'move'), 'move-1.png')
const hatchRef = join(spriteOutputDir(species, 'egg', 'hatch'), 'hatch-6.png')

function gridPixels(rows, cols) {
  const cell = 512
  return { width: cols * cell, height: rows * cell }
}

function entry(stage, clip, references, promptExtra = '') {
  const grid = clipGrid(stage, clip)
  const { width, height } = gridPixels(grid.rows, grid.cols)
  let prompt = buildGenPrompt(stage, clip, species)
  if (stage === 'egg' && clip === 'hatch') {
    prompt = prompt.replace(
      'Frame 6 baby MUST match baby master reference exactly.',
      'Frames 1-3 egg MUST match the attached egg move reference exactly (same shell, nest, height). Frame 6 baby MUST match BABY design from species board.'
    )
  }
  if (stage === 'baby' && clip === 'idle') {
    prompt = prompt.replace(
      'Use the attached species board and stage master reference for exact identity and proportions.',
      'Use the attached species board and hatch frame 6 reference for exact baby identity, silhouette, and height. Frame 4 idle MUST match hatch-6 reference proportions.'
    )
  }
  if (promptExtra) prompt += ` ${promptExtra}`

  return {
    species,
    stage,
    clip,
    grid: `${grid.rows}x${grid.cols}`,
    frames: grid.frames,
    outputSize: `${width}x${height}`,
    prompt,
    references,
    saveRawTo: join(rawDir, `${stage}-${clip}.png`),
    notes: 'Egg-first chain. Generate with GenerateImage; attach all references.'
  }
}

const plan = {
  species,
  workflow: '1) egg/move 2) egg/hatch (ref move-1) 3) baby/idle (ref hatch-6) 4) adaptive + stitch',
  speciesBoard: board,
  jobs: [
    entry('egg', 'move', [board]),
    entry('egg', 'hatch', [board, moveRef]),
    entry('baby', 'idle', [board, hatchRef])
  ]
}

const planPath = join(outDir, 'egg-chain-plan.json')
writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8')
console.log(`Wrote ${planPath}`)
for (const job of plan.jobs) {
  console.log(`  ${job.stage}/${job.clip} -> ${job.saveRawTo}`)
  console.log(`    refs: ${job.references.join(', ')}`)
}
