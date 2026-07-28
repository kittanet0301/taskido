import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { buildMasterAdultPrompt } from './creature-gen-prompts.mjs'
import {
  masterAdultRawPath,
  masterReferencePath,
  repoRoot,
  speciesBoardPath
} from './creature-manifest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const species = process.argv[2] ?? 'neutral'

const board = speciesBoardPath(species)
const masterBaby = masterReferencePath(species, 'baby')
const masterAdult = masterReferencePath(species, 'adult')
const rawPath = masterAdultRawPath(species)
const outDir = join(repoRoot, 'sprite-output', species)

mkdirSync(dirname(rawPath), { recursive: true })
mkdirSync(outDir, { recursive: true })

if (!existsSync(masterBaby)) {
  console.error(`Missing master-baby: ${masterBaby}`)
  console.error('Process baby/idle first (egg chain → lock → master-baby).')
  process.exit(1)
}

const plan = {
  species,
  workflow:
    '1) Ensure master-baby exists. 2) GenerateImage with references below → save raw. 3) npm run creature:batch -- finalize-master-adult',
  masterBaby,
  masterAdult,
  speciesBoard: board,
  outputSize: '1024x1024',
  prompt: buildMasterAdultPrompt(species),
  references: [masterBaby, board].filter((p) => existsSync(p)),
  saveRawTo: rawPath,
  notes: 'Single portrait — NOT a sprite sheet. Attach master-baby + species board.'
}

const planPath = join(outDir, 'master-adult-plan.json')
writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8')
console.log(`Wrote ${planPath}`)
console.log(`  refs: ${plan.references.join(', ')}`)
console.log(`  raw  -> ${rawPath}`)
console.log(`  out  -> ${masterAdult}`)
