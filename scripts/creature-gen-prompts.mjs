import { CLIP_GRID, clipGrid } from './creature-manifest.mjs'
import {
  MEGA_SHEET_CELL,
  MEGA_SHEET_LAYOUT,
  clipBlockSize,
  megaSheetCanvasSize
} from './mega-sheet-layout.mjs'

const ACTION_PROMPTS = {
  idle:
    'Four subtle idle frames: (1) mouth closed neutral, (2) mouth slightly open, (3) eyes blink closed, (4) neutral return — canonical standing baby pose. Minimal body motion. Frame 4 is the master identity reference.',
  move: 'Four walk cycle frames facing left: natural quadruped walk, consistent stride, feet on shared ground line.',
  hurt: 'Four hurt reaction frames: flinch, eyes squeezed, body recoils but stays facing left.',
  bite: 'Four attack/bite frames: lean forward, mouth opens wider each beat, short lunge without crossing cell edges.',
  jump: 'Four jump frames: crouch, takeoff, apex, land. Feet return to same baseline on last frame.',
  move_egg: 'Six egg idle/wobble frames: intact egg, subtle rocking only, same identity in all cells.',
  move_egg_6:
    'Six egg idle/wobble frames: intact egg in nest, subtle rocking and nest detail variations. Same egg identity throughout all six cells.',
  hatch:
    'Six hatch frames left to right top row then bottom: (1) whole egg, (2) eye peeks, (3) head and claw out, (4) sitting in broken shell, (5) stepping out, (6) baby stands beside shell remains. Frame 6 baby MUST match baby master reference exactly.'
}

function rosterRules(displayName, family, identity) {
  return {
    displayName,
    egg: [
      `${displayName} egg using the same limited palette and attached body details as the creature.`,
      `Shell markings clearly foreshadow ${identity}.`,
      'No detached sparks, smoke, particles, floating leaves, or separate elemental effects.',
      'Subject must occupy ~70–72% of each cell envelope, centered on the shared baseline.'
    ],
    baby: [
      `Baby ${family} silhouette — large head, short limbs, cute compact proportions.`,
      identity,
      'Match the BABY master reference exactly for palette, outline weight, pixel density, and lighting.',
      'Subject must stay inside the central ~70–72% safe envelope; feet on the shared ground line.'
    ],
    adult: [
      `Adult ${family} silhouette — clearly mature while preserving the same species anatomy.`,
      identity,
      'Match the ADULT master reference exactly for palette, outline weight, pixel density, and lighting.',
      'Entire body, tail, horns, plates, fins, and crest must fit with transparent margin on every side.'
    ]
  }
}

/** Per-species identity rules for the accepted nine-element roster. */
export const SPECIES_STAGE_RULES = {
  neutral: rosterRules(
    'Neutral Stegosaurus',
    'Stegosaurus',
    'Classic natural-color back plates with no supernatural glow or detached effects.'
  ),
  fire: rosterRules(
    'Fire Carnotaurus',
    'Carnotaurus',
    'Carnotaurus brow horns and attached ember-red flame-like ridges integrated into the body.'
  ),
  grass: rosterRules(
    'Grass Brachiosaurus',
    'Brachiosaurus',
    'Long neck with leaf and sprout shapes integrated into scales; no floating foliage.'
  ),
  ground: rosterRules(
    'Ground Ankylosaurus',
    'Ankylosaurus',
    'Low armored body, rock-like plates, and a heavy club tail.'
  ),
  electric: rosterRules(
    'Electric Parasaurolophus',
    'Parasaurolophus',
    'Lightning-bolt head crest and charge markings painted into the skin; no floating bolts.'
  ),
  water: rosterRules(
    'Water Spinosaurus',
    'Spinosaurus',
    'Aquatic sail, webbed fins, and semi-aquatic anatomy integrated into the silhouette.'
  ),
  ice: rosterRules(
    'Ice Pachyrhinosaurus',
    'Pachyrhinosaurus',
    'Ice-like frill and nasal armor attached to the head, with no detached crystals.'
  ),
  dragon: rosterRules(
    'Dragon Tyrannosaurus',
    'Tyrannosaurus rex',
    'Recognizable T. rex anatomy with attached dragon scales, horns, and dorsal ridges.'
  ),
  dark: rosterRules(
    'Dark Velociraptor',
    'Velociraptor',
    'Lean feathered raptor silhouette with dark plumage and moon-shaped body markings.'
  )
}

const GRID_LAYOUT_RULES = {
  '2x2':
    'CRITICAL LAYOUT: exactly 2 rows and 2 columns — NOT a single horizontal strip of 4. ' +
    'Reading order left-to-right, top-to-bottom: top-left=frame 1, top-right=frame 2, bottom-left=frame 3, bottom-right=frame 4. ' +
    'Visual grid: [1][2] on top row, [3][4] on bottom row.',
  '2x3':
    'CRITICAL LAYOUT: exactly 2 rows and 3 columns — NOT a single row of 6. ' +
    'Reading order left-to-right, top-to-bottom: top row frames 1-2-3, bottom row frames 4-5-6. ' +
    'Visual grid: [1][2][3] on top row, [4][5][6] on bottom row.'
}

const BASE_RULES_MAGENTA = [
  'Solid flat chroma-key magenta #FF00FF background only in gaps between cells.',
  'Clean crisp 16-bit pixel-art game creature sprite, 192px cell output target.',
  'Hard pixel edges only — no motion blur, no soft anti-aliasing, no depth-of-field, no painterly softness.',
  'Identical rendering sharpness, pixel density, and edge crispness in every cell of this sheet.',
  'Side view facing LEFT in every cell unless noted.',
  'Full subject centered in each cell; nothing crosses cell edges.',
  'Consistent character scale and feet baseline across all cells in this sheet.',
  'No text, labels, grid lines, borders, numbers, digits, frame indices, or watermarks of any kind.'
]

function baseRulesFor(_species) {
  return BASE_RULES_MAGENTA
}

function chromaBgPhrase(_species) {
  return 'Solid flat chroma-key magenta #FF00FF background ONLY (full square background).'
}

function gridPixels(rows, cols) {
  const cell = 512
  return { width: cols * cell, height: rows * cell, cell }
}

function speciesRules(species) {
  const rules = SPECIES_STAGE_RULES[species]
  if (!rules) throw new Error(`Unknown species for prompts: ${species}`)
  return rules
}

function displayName(species) {
  return speciesRules(species).displayName
}

function stageRulesFor(species, stage) {
  const rules = speciesRules(species)
  return rules[stage] ?? rules.baby
}

/** Single master-adult portrait evolved from master-baby (not a sprite sheet). */
export function buildMasterAdultPrompt(species = 'neutral') {
  const name = displayName(species)
  const stageRules = stageRulesFor(species, 'adult').join(' ')
  return [
    'Single pixel-art game creature sprite — ONE character only, NOT a sprite sheet.',
    `Adult ${name} evolved from the attached master-baby reference.`,
    'Side view facing LEFT, canonical standing idle pose, mouth closed neutral, feet on ground line.',
    'Centered in frame with generous padding on all sides.',
    stageRules,
    'Evolve the baby into adult while keeping the same palette, eye color, and pixel density as master-baby.',
    chromaBgPhrase(species),
    'Clean crisp pixel-art game creature sprite. Hard pixel edges only — no motion blur, no soft anti-aliasing.',
    'Side view facing LEFT. No text, labels, grid lines, borders, numbers, digits, or watermarks.'
  ].join(' ')
}

export function buildGenPrompt(stage, clip, species = 'neutral') {
  const grid = clipGrid(stage, clip)
  if (!grid) throw new Error(`Unknown clip: ${stage}/${clip}`)

  const { rows, cols } = grid
  const { width, height, cell } = gridPixels(rows, cols)
  let actionKey = clip
  if (stage === 'egg' && clip === 'move' && grid.frames === 6) actionKey = 'move_egg_6'
  else if (stage === 'egg' && clip === 'move') actionKey = 'move_egg'
  const action = ACTION_PROMPTS[actionKey] ?? ACTION_PROMPTS.idle
  const stageRules = stageRulesFor(species, stage)
  const name = displayName(species)

  const layoutKey = `${rows}x${cols}`
  const layoutRule = GRID_LAYOUT_RULES[layoutKey] ?? ''

  return [
    `${name} creature sprite sheet — ${stage} stage, ${clip} animation.`,
    `${rows}x${cols} sprite sheet (${grid.frames} cells), total image ${width}x${height}px, each cell ${cell}x${cell}px.`,
    layoutRule,
    ...baseRulesFor(species),
    ...stageRules,
    `Action: ${action}`,
    stage === 'adult' && clip === 'idle'
      ? 'Use the attached master-adult and species board for exact adult identity and proportions.'
      : 'Use the attached species board and stage master reference for exact identity and proportions.'
  ].join(' ')
}

export function referencesForStage(stage, clip, paths) {
  const refs = [paths.speciesBoard]
  if (stage === 'baby' && clip === 'idle') {
    return refs.filter(Boolean)
  }
  if (stage === 'adult' && clip === 'idle') {
    if (paths.masterAdult) refs.unshift(paths.masterAdult)
    return refs.filter(Boolean)
  }
  if (stage === 'baby' && paths.masterBaby) refs.unshift(paths.masterBaby)
  if (stage === 'adult' && paths.masterAdult) refs.unshift(paths.masterAdult)
  if (stage === 'egg') {
    if (paths.masterBaby) refs.unshift(paths.masterBaby)
  }
  return refs.filter(Boolean)
}

export function buildGenPlanEntry(species, stage, clip, paths) {
  const grid = clipGrid(stage, clip)
  const { width, height } = gridPixels(grid.rows, grid.cols)
  return {
    species,
    stage,
    clip,
    grid: `${grid.rows}x${grid.cols}`,
    frames: grid.frames,
    outputSize: `${width}x${height}`,
    prompt: buildGenPrompt(stage, clip, species),
    references: referencesForStage(stage, clip, paths),
    saveRawTo: paths.saveRawTo,
    notes: 'Generate with Cursor GenerateImage. Attach all listed references.'
  }
}

function actionPromptFor(stage, clip) {
  const actionKey = stage === 'egg' && clip === 'move' ? 'move_egg' : clip
  return ACTION_PROMPTS[actionKey] ?? ACTION_PROMPTS.idle
}

function describeClipBlock(entry, species) {
  const { stage, clip, x, y, rows, cols } = entry
  const { width, height } = clipBlockSize(entry)
  const action = actionPromptFor(stage, clip)
  const stageRules = stageRulesFor(species, stage).join(' ')
  return [
    `BLOCK at pixel (${x},${y}) size ${width}x${height}px = ${rows}x${cols} grid of ${MEGA_SHEET_CELL}px cells.`,
    `${stage}/${clip}: ${stageRules}`,
    `Action: ${action}`
  ].join(' ')
}

export function buildMegaSheetPrompt(species = 'neutral') {
  const { width, height } = megaSheetCanvasSize()
  const blockDescriptions = MEGA_SHEET_LAYOUT.map((entry) => describeClipBlock(entry, species))

  return [
    `${species} creature MEGA animation atlas — single combined sprite sheet.`,
    `Total canvas ${width}x${height}px.`,
    `Every animation cell is ${MEGA_SHEET_CELL}x${MEGA_SHEET_CELL}px.`,
    'Solid flat chroma-key magenta #FF00FF background in all gaps between cells and blocks.',
    'Clean crisp pixel-art game creature sprites — hard edges, no blur, identical sharpness in every cell.',
    'Side view facing LEFT in every cell.',
    'Full subject centered in each cell; nothing crosses cell edges.',
    'Consistent character identity and scale within each block; feet on shared baseline per block.',
    'No text, labels, grid lines, borders, or decorative frames between blocks.',
    'Use the attached species board reference for exact egg, baby, and adult identity.',
    'Layout — place each block at exact pixel origin (top-left of block):',
    ...blockDescriptions
  ].join(' ')
}
