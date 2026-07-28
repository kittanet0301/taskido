# Asset credits

## Creature assets (`assets/creatures/`)

Taskino creature sprites are project-owned generated assets processed through
the repository creature pipeline. Runtime strips live under
`assets/creatures/{species}/{egg|baby|adult}/`.

Static generation masters, exact prompts, raw sources, and QC artifacts live
under `assets/creature-prototypes/`.

## UI assets (`assets/ui/`)

Project UI art lives under `assets/ui/` (served as `/ui/...` in the app),
including:

- `taskino-logo.png` — top bar / title branding
- HUD icons for navigation, stats, collection, inventory, and other features
- item icons used by inventory and the home quickbar

Keep new UI PNGs in that folder and register critical paths in
`scripts/check-assets.mjs`.

## Fonts (not in `assets/`)

Loaded via Google Fonts in `src/styles.css`:

- **Mali** — Thai / primary UI
- **Press Start 2P** — pixel HUD labels, badges, and quickbar quantities
