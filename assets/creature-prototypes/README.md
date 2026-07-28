# Taskino creature prototypes

This folder contains static, non-runtime Egg, Baby and Adult 16-bit pixel-art
masters for the nine-element roster, plus accepted animation anchors. The
prototypes are intentionally not registered in the creature manifest yet.

| Element | Dinosaur family |
| --- | --- |
| `neutral` | Stegosaurus |
| `fire` | Carnotaurus |
| `grass` | Brachiosaurus |
| `ground` | Ankylosaurus |
| `electric` | Parasaurolophus |
| `water` | Spinosaurus |
| `ice` | Pachyrhinosaurus |
| `dragon` | Tyrannosaurus |
| `dark` | Velociraptor |

Each element folder contains:

- `source-original.png`: untouched built-in image-generation output.
- `raw.png`: deterministic nearest-neighbor `1024x1024` source.
- `master-baby.png`: transparent `192x192` RGBA master.
- `prompt-used.txt`: exact generation prompt.
- `qc.json`: processing and acceptance metadata.
- `source-original-adult.png`: untouched Adult image-generation output.
- `raw-adult.png`: deterministic nearest-neighbor `1024x1024` Adult source.
- `master-adult.png`: transparent `192x192` RGBA Adult master.
- `qc-adult.json`: Adult processing and acceptance metadata.
- `source-original-egg.png`: untouched Egg image-generation output.
- `raw-egg.png`: deterministic nearest-neighbor `1024x1024` Egg source.
- `master-egg.png`: transparent `192x192` RGBA Egg master.
- `qc-egg.json`: Egg processing and acceptance metadata.

The Egg, Baby and Adult contact sheets are review-only composites. They must
not be used as sprite-generation references; use the individual stage masters
instead.

Finalize a generated source:

```text
python scripts/finalize_creature_master.py finalize \
  --raw assets/creature-prototypes/<element>/source-original.png \
  --normalized-raw assets/creature-prototypes/<element>/raw.png \
  --output assets/creature-prototypes/<element>/master-baby.png \
  --qc assets/creature-prototypes/<element>/qc.json \
  --element <element>
```

Validate the complete roster:

```text
python scripts/finalize_creature_master.py validate \
  --root assets/creature-prototypes \
  --output assets/creature-prototypes/qc-summary.json
```

Validate the Adult roster:

```text
python scripts/finalize_creature_master.py validate \
  --root assets/creature-prototypes \
  --stage adult \
  --output assets/creature-prototypes/qc-summary-adult.json
```

Validate the Egg roster:

```text
python scripts/finalize_creature_master.py validate \
  --root assets/creature-prototypes \
  --stage egg \
  --output assets/creature-prototypes/qc-summary-egg.json
```

`animation-plan.json` records the completed per-action grid, frame, anchor and
transition contracts. All required prototype strips now pass QC. The roster
remains intentionally outside the runtime manifest pending a separate roster
approval and integration task.

## Completed roster

All nine elements now include accepted Egg, Baby and Adult animation sets:

- Egg: `move`, `hatch`
- Baby: `idle`, `move`, `hurt`, `bite`, `jump`
- Adult: `idle`, `move`, `hurt`, `bite`, `jump`

That is 108 accepted actions across 27 stage contracts. Every output frame is
`192x192` RGBA, uses nearest-neighbor normalization, has zero magenta fringe,
keeps the complete silhouette inside the canvas, and follows the shared
grounded baseline or an explicit jump trajectory. The consolidated result is
stored in `animation-qc-summary.json`; `runtime_registered` remains `false`.

## Accepted animation anchor

`neutral/animations/egg` is the reference implementation for Egg animation
processing:

- `move`: six frames in a `2x3` raw grid, shared bottom baseline.
- `hatch`: six transition frames from the Egg master to the Baby master.
- Each action retains its exact prompt, magenta raw sheet, transparent
  `192x192` frames, transparent sheet, GIF preview, pipeline metadata and
  `qc.json`.
- Hatch frame 6 uses the exact Baby master pixels translated to the shared
  animation baseline; it is not rescaled or redrawn.

Validate a processed prototype action:

```text
python scripts/validate_prototype_animation.py \
  --input-dir assets/creature-prototypes/neutral/animations/egg/move \
  --prefix move --frames 6 \
  --output assets/creature-prototypes/neutral/animations/egg/move/qc.json
```

For hatch, add:

```text
--identity-reference assets/creature-prototypes/neutral/master-baby.png
```

`neutral/animations/baby/idle` is the accepted Baby animation scale and
grounding anchor. Its four-frame `2x2` loop uses a fixed output baseline at
`y=176`, and its mean silhouette scale stays within 5% of `master-baby.png`.
Use `neutral/animations/baby/references/idle-anchor-2x2.png` to lock identity,
camera distance, torso root and safe padding for later grounded Baby actions.
Jump remains exempt from the grounded anchor.

Validate the Baby idle scale contract:

```text
python scripts/validate_prototype_animation.py \
  --input-dir assets/creature-prototypes/neutral/animations/baby/idle \
  --prefix idle --frames 4 \
  --scale-reference assets/creature-prototypes/neutral/master-baby.png \
  --max-reference-scale-drift 0.05 \
  --output assets/creature-prototypes/neutral/animations/baby/idle/qc.json
```

`neutral/animations/baby/move` is the accepted four-frame grounded quadruped
walk loop. It reuses the exact idle processing contract (`fit_scale=0.72`,
output baseline `y=176`) and stays within 5% of the Baby master silhouette
scale. Runtime translation must move the actor; the sprite frames keep the
torso centered and animate the legs in place.

`neutral/animations/baby/hurt` is an accepted four-frame one-shot sequence:
impact, recoil, stagger and recovery. Crouching and tail tuck are authored pose
changes, so its master-scale limit is 8% rather than the 5% used by steady
idle/move loops. It still uses the shared grounded baseline at `y=176` and
contains no detached hit FX.

`neutral/animations/baby/bite` is an accepted body-only four-frame one-shot:
wind-up, open bite, snap and recovery. Its extended jaw made the ordinary
shared bbox fit shrink the torso, so it uses a containment-safe
`fit_scale=0.78`; this restores master-scale anatomy while preserving at least
22 pixels of horizontal output margin. No target, slash, impact or detached FX
is baked into the body sheet.

`neutral/animations/baby/jump` completes the Neutral Baby action set. Jump
does not use the grounded feet aligner. The first pass uses
`--preserve-cell-position`, then `finalize_creature_jump.py` applies one
nearest-neighbor anatomy scale and explicit baselines `[176, 132, 92, 176]`.
This preserves an 84-pixel airborne trajectory and returns to the exact
starting ground line without baking dust or impact FX into the body sheet.

`neutral/animations/adult/idle` is the accepted Adult animation scale and
grounding anchor. Its four-frame `2x2` loop uses one shared nearest-neighbor
scale (`fit_scale=0.87`) and the same output baseline as Egg/Baby at `y=176`.
The elongated Stegosaurus remains rooted while breathing, blinking and moving
only its attached plates and tail tip. Its mean silhouette scale stays within
8% of `master-adult.png`, with zero magenta fringe or edge contact. Reuse
`neutral/animations/adult/references/idle-anchor-2x2.png` and
`neutral/animations/adult/anchor-contract.json` for grounded Adult move, hurt
and bite generation; jump remains exempt from the grounded anchor.

`neutral/animations/adult/move` is the accepted four-frame heavy quadruped
walk loop. It reuses the Adult idle contract without action-specific scaling:
`fit_scale=0.87`, shared output baseline `y=176`, and one shared scale across
all frames. Contact and passing poses alternate the leg pairs while the torso
remains centered for runtime translation. The processed frames have zero
body-height variation, stay within 8% of `master-adult.png`, and contain no
detached dust, magenta fringe or edge contact.

`neutral/animations/adult/hurt` is an accepted body-only four-frame one-shot:
impact, recoil, full crouched stagger and recovery. It keeps the Adult
`fit_scale=0.87` and baseline `y=176` contract. The crouched frames deliberately
reduce the visible pose bbox, producing 15.56% mean master-bbox drift; the
action-specific 16% gate records that authored compression rather than
rescaling the anatomy. Visual review confirms consistent head, limb and plate
scale, safe margins, and no detached hit FX, magenta fringe or edge contact.

`neutral/animations/adult/bite` is an accepted compact body-only four-frame
one-shot: wind-up, modest open bite, snap and recovery. The first raw attempt
was rejected because excessive neck extension caused 21.51% master-scale
drift; its raw sheet, prompt and QC remain as `*-v1-rejected.*` audit files.
The accepted regeneration keeps body and plate height stable and uses one
shared `fit_scale=0.93` to compensate for the wider open jaw. It stays within
12% of `master-adult.png`, preserves at least six pixels of horizontal margin,
and contains no target, impact FX, magenta fringe or edge contact.

`neutral/animations/adult/jump` completes the Neutral Adult action set. Like
Baby jump, it bypasses the grounded feet aligner: the crop pass preserves the
authored cell position, then `finalize_creature_jump.py` applies one
nearest-neighbor anatomy scale and explicit baselines `[176, 142, 104, 176]`.
The resulting one-shot has a 72-pixel airborne span, returns to the starting
ground line with zero delta, stays within 12% of `master-adult.png`, preserves
at least eight pixels of horizontal margin, and has no dust, impact FX,
magenta fringe or edge contact.

`fire/animations/egg/move` begins application of the accepted animation
contracts to the remaining roster. Its six-frame `2x3` loop preserves the
charcoal volcanic shell, permanent orange-red magma seams, attached crown
horns and cream-gold base plates while wobbling in place. All frames use one
shared nearest-neighbor scale and the accepted Egg output baseline at `y=176`.
Body-height variation is 3.93%, with zero magenta fringe or edge contact.

`fire/animations/egg/hatch` completes the Fire Egg action set. Its six-frame
`2x3` one-shot opens the volcanic crown, keeps all shell pieces grouped, and
transitions through two compact emerging poses. The final frame uses the exact
Fire Baby master pixels translated to baseline `y=176`, so the stage change
has no identity or scale discontinuity. All frames pass containment and
magenta-fringe checks.

`fire/animations/baby` is complete with accepted `idle`, `move`, `hurt`,
body-only `bite`, and `jump` actions. All grounded actions share baseline
`y=176`; idle establishes `fit_scale=0.72`, while bite uses containment-safe
`fit_scale=0.78` for the open jaw. Jump uses explicit baselines
`[176, 140, 108, 176]`, producing a 68-pixel airborne span and zero ground
return delta. Every action has zero magenta fringe and no edge contact.

`fire/animations/adult` completes the Fire element. Grounded `idle`, `move`,
`hurt`, and body-only `bite` share baseline `y=176`; bite uses
`fit_scale=0.93` to preserve mature anatomy while retaining six pixels of
horizontal margin. Adult jump uses baselines `[176, 146, 116, 176]`, a
60-pixel airborne span, and one uniform anatomy scale. Its larger height drift
records authored leg tuck and landing compression rather than per-frame
resizing. All Adult frames have zero magenta fringe and no edge contact.
