# Taskino — Technical Stack

> เอกสารอธิบายสถาปัตยกรรมและเทคโนโลยีฝั่ง technical — อัปเดตล่าสุด: ส.ค. 2026

---

## ภาพรวมสถาปัตยกรรม

Taskino เป็น **monorepo เดียว** ที่แชร์ game logic และ UI ระหว่าง 2 runtime:

```text
                    ┌─────────────────────────────────────┐
                    │         src/shared/ (domain)        │
                    │  types · rules · battle · missions  │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼────────┐  ┌────────▼────────┐  ┌───────▼───────┐
     │  Electron App   │  │   Web (Vite)    │  │   Supabase    │
     │  main/preload   │  │  web/src/*      │  │  Postgres+RLS │
     │  pet + hub UI   │  │  hub UI only    │  │  Auth+Realtime│
     └─────────────────┘  └─────────────────┘  └───────────────┘
```

| Surface | Entry | Output | บทบาท |
|---|---|---|---|
| **Desktop** | `electron/main/index.ts` | `out/` + `dist/` installer | Pet overlay, tray, global input, IPC |
| **Web** | `web/src/main.tsx` | `dist-web/` | Hub-only SPA บน Vercel |
| **Shared** | `src/` | bundled ใน renderer | React UI + pure TypeScript domain |

---

## Runtime & Toolchain

| รายการ | เวอร์ชัน / รายละเอียด |
|---|---|
| **Node.js** | ≥ 24 (`package.json` engines) |
| **TypeScript** | 5.9 — `strict: true`, project references |
| **Package manager** | npm (มี `package-lock.json`) |
| **Module system** | ESM (`"type"` implicit ผ่าน Vite/electron-vite) |

### Dependencies หลัก

| Package | ใช้ทำอะไร |
|---|---|
| `electron` 34 | Desktop shell |
| `electron-vite` 2.3 | Build main / preload / renderer |
| `electron-builder` 25 | Windows `.exe` / macOS `.dmg` |
| `vite` 5.4 | Web build + dev server |
| `@vitejs/plugin-react` 4.3 | JSX transform |
| `react` / `react-dom` 18.3 | UI |
| `@supabase/supabase-js` 2.109 | Auth, DB, Realtime |
| `i18next` + `react-i18next` | Localization EN/TH |
| `uiohook-napi` 1.5 | Global mouse/keyboard hooks (desktop) |
| `ws` 8.21 | WebSocket สำหรับ Supabase Realtime ใน Electron main |
| `vitest` 4.1 | Unit tests |

---

## Electron (Desktop)

### Process model

```text
┌──────────────────────────────────────────────────────────────┐
│ Main Process (electron/main/)                                │
│  · lifecycle, IPC, tray, windows                             │
│  · gameState (save + activity tracker)                       │
│  · Supabase client (file-backed auth storage)                │
│  · uiohook global input                                      │
└────────────┬─────────────────────────────┬───────────────────┘
             │ IPC invoke/on               │ IPC invoke/on
   ┌─────────▼─────────┐         ┌─────────▼─────────┐
   │ Preload (hub)     │         │ Preload (pet)     │
   │ preload/index.ts  │         │ preload/pet.ts    │
   │ contextBridge     │         │ contextBridge     │
   └─────────┬─────────┘         └─────────┬─────────┘
             │                           │
   ┌─────────▼─────────┐         ┌─────────▼─────────┐
   │ Hub Renderer      │         │ Pet Renderer      │
   │ src/main.tsx      │         │ src/pet/PetCanvas │
   │ ?view= (default)  │         │ ?view=pet         │
   └───────────────────┘         └───────────────────┘
```

### Build config (`electron.vite.config.ts`)

| Target | Input | Output |
|---|---|---|
| **main** | `electron/main/index.ts` | `out/main/` |
| **preload** | `preload/index.ts`, `preload/pet.ts` | `out/preload/` |
| **renderer** | `src/renderer/index.html` | `out/renderer/` |

Renderer ใช้:
- `root: src/`
- `publicDir: assets/` — sprite strips, UI icons, backgrounds
- Aliases: `@renderer` → `src/`, `@shared` → `src/shared/`

### Windows

| Window | ไฟล์ | คุณสมบัติ |
|---|---|---|
| **Hub** | `electron/main/hubWindow.ts` | React app เต็ม (login, collection, battle…) |
| **Pet** | `electron/main/petWindow.ts` | Always-on-top, transparent, draggable canvas |
| **Tray** | `electron/main/tray.ts` | System tray + context menu |

### IPC & API contract

Preload expose `window.electronAPI` ผ่าน `contextBridge` — type อยู่ที่ `src/api/types.ts` (`GameAPI`)

**กลุ่ม IPC หลัก:**

| Channel prefix | ตัวอย่าง | ฝั่ง main |
|---|---|---|
| `game:*` | `get`, `patch`, `update` | `gameState.ts` |
| `auth:*` | `signin`, `signup`, `session` | `supabase.ts` + service |
| `cloud:*` | `syncPet`, `forceSave`, `isDbMode` | `cloudStorage.ts` |
| `room:*` / `battle:*` | async PvP rooms | Supabase Realtime |
| `chatRoom:*` | lobby chat | Supabase Realtime |
| `hub:*` / `pet:*` | window control | window modules |

Renderer **ไม่** เรียก Supabase โดยตรงบน desktop — ทุก network/auth ผ่าน main process IPC

### Local persistence (Desktop)

| ไฟล์ | ที่เก็บ | เนื้อหา |
|---|---|---|
| `pet-save.json` | `app.getPath('userData')` | Offline `GameSave` |
| `supabase-auth.json` | userData | JWT session (custom file storage) |

Load path: `electron/main/storage.ts` → `migrateSave()` → `applyOfflineDecay()`

### Global activity tracking

- **Primary:** `uiohook-napi` ใน main process (`startActivityTracker`)
- **Fallback:** renderer นับคลิก/พิมพ์ในแอป (`src/desktopActivity.ts`) ถ้า hook ล้มเหลว
- **macOS:** ต้องมี Accessibility permission
- Evolution grant: ทุก `CLICKS_PER_DEV` คลิก / `KEYS_PER_DEV` ปุ่ม, cap `MAX_DEV_PER_HOUR`/ชม.

---

## Web (Browser)

### Entry & bootstrap

`web/src/main.tsx`:
1. Inject `window.electronAPI = createWebApi()` — **polyfill API เดียวกับ desktop**
2. `hydrateFromSession()` — โหลด cloud save ถ้า login
3. `startActivityTracking()` — นับ input เฉพาะในหน้าเว็บ
4. Render `<App variant="web" />`

### Vite config (`web/vite.config.ts`)

| Setting | ค่า |
|---|---|
| Dev port | 5174 |
| `envDir` | repo root (อ่าน `.env`) |
| `publicDir` | `assets/` |
| `outDir` | `dist-web/` |
| Aliases | `@shared`, `@hub`, `@api` |

### Web adapters (`web/src/`)

| Module | บทบาท |
|---|---|
| `webApi.ts` | สร้าง `GameAPI` — เรียก Supabase จาก browser โดยตรง |
| `gameStore.ts` | In-memory save + cloud hydrate (แทน `gameState.ts`) |
| `storage.ts` | `localStorage` key `taskino-save` |
| `activity.ts` | Page-scoped click/key counters |
| `supabase.ts` | Browser Supabase client |
| `cloudStorage.ts` | DB read/write mapping |

### Deploy

| รายการ | ค่า |
|---|---|
| Platform | Vercel |
| Config | `vercel.json` |
| Build | `npm run build:web` |
| Output | `dist-web/` |
| Production | [taskimon.vercel.app](https://taskimon.vercel.app) |

Env ที่ต้องมี: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Shared Frontend (`src/`)

### โครงสร้างหลัก

```text
src/
├── App.tsx              # Router หลัก (auth gate → hub views)
├── main.tsx             # Desktop renderer entry (hub | pet)
├── styles.css           # Global + pixel theme (--pixel-*)
├── hub/                 # React pages & battle/chat/minigame UI
├── pet/                 # PetCanvas (desktop overlay only)
├── shared/              # Pure game domain (NO React)
│   ├── types.ts
│   ├── gameMutators.ts  # Save mutations (patchGame API)
│   ├── battle/          # Engine, damage, skills, bot
│   ├── audio/           # Procedural chiptune SFX + BGM (Web Audio API)
│   └── supabaseService.ts
├── components/          # Reusable UI
├── i18n/                # en.json, th.json
└── api/types.ts         # GameAPI interface
```

### Design principle

> **Game rules อยู่ใน `src/shared/` เท่านั้น** — UI components เรียกผ่าน mutators/tests ไม่ duplicate logic

`applyGamePatch(save, mutatorName, args)` ใน `gameMutators.ts` เป็น single mutation router สำหรับ feed, hatch, market, missions, bot battle ฯลฯ

### i18n

- **Library:** i18next + react-i18next
- **Locales:** `src/i18n/locales/en.json`, `th.json`
- **Storage key:** `taskino-lang`
- **Usage:** `useTranslation()` ใน React; `tDefaultPetName()` ใน shared code

### Rendering

- **Pet sprites:** Canvas 2D — `src/pet/PetCanvas.tsx`, `src/components/DinoSprite.tsx`
- **Frame data:** `src/shared/creatureFrameManifest.ts` (sync กับ `assets/creatures/frame-manifest.json`)
- **Battle FX:** sprite atlas จาก `src/shared/battle/battleFx.ts`
- **Minigames:** dedicated canvas components (`DinoJumpCanvas`, `RockDodgeCanvas`)

---

## Audio — Procedural Chiptune (Web Audio API)

Taskino **ไม่ใช้ไฟล์เสียง (.mp3 / .wav / .ogg)** — SFX และ BGM ทั้งหมดสังเคราะห์แบบ real-time ผ่าน **Web Audio API** ใน renderer (desktop + web) สไตล์ chiptune/8-bit โดยไม่มี dependency เพิ่มเติม

### สถาปัตยกรรม

```text
src/shared/audio/
├── soundManager.ts       ← singleton: unlock, mute, playSfx, setBgmTrack
├── chiptuneSynth.ts      ← one-shot SFX (oscillator / noise buffer)
├── chiptuneSequencer.ts  ← looping BGM scheduler
├── soundPresets.ts       ← SFX preset catalog (freq, wave, ADSR, sequence)
├── musicTracks.ts        ← BGM track definitions (BPM, channels, patterns)
├── soundIds.ts           ← typed SfxId list (40 รายการ)
├── musicIds.ts           ← typed BgmId list (5 แทร็ก)
├── audioLevels.ts        ← global gain constants + peak limiter
├── elementPitch.ts       ← pitch multiplier ตาม element ของ creature
├── battleSfx.ts          ← map battle FX phases → SFX + timing offset
├── careSfx.ts            ← map care item type → SFX
└── index.ts              ← public exports

src/components/AudioMuteButton.tsx   ← HUD mute toggle
```

```text
┌─────────────────────────────────────────────────────────────┐
│  SoundManager (singleton)                                   │
│  · AudioContext lifecycle + browser unlock                  │
│  · mute state → localStorage `taskino-audio-muted`          │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │  ChiptuneSynth      │    │  ChiptuneSequencer  │
    │  one-shot SFX       │    │  looping BGM        │
    │  max 8 voices       │    │  max 6 voices       │
    └──────────┬──────────┘    └──────────┬──────────┘
               │                          │
    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │  SOUND_PRESETS      │    │  MUSIC_TRACKS       │
    │  (soundPresets.ts)  │    │  (musicTracks.ts)   │
    └─────────────────────┘    └─────────────────────┘
               │                          │
               └──────────┬───────────────┘
                          ▼
                 Web Audio API → destination
```

### หลักการ gen เสียง

| หลักการ | รายละเอียด |
|---|---|
| **Procedural only** | ไม่ bundle asset เสียง — ทุกเสียง gen จาก oscillator / noise buffer ตอน runtime |
| **Preset-as-data** | เพิ่ม/แก้เสียงโดยแก้ TypeScript preset ไม่ต้อง export WAV |
| **Chiptune waves** | `square`, `triangle`, `sawtooth`, `noise` (noise ผ่าน bandpass filter) |
| **ADSR envelope** | `attack`, `decay`, `sustain`, `release`, `gain` ต่อ preset |
| **Melodic sequences** | SFX แบบ arpeggio ใช้ `sequence: ToneStep[]` + `noteDuration` |
| **Element pitch** | battle/creature SFX ปรับ pitch ตาม element (`elementPitch.ts`) |
| **Peak limiting** | `AUDIO_PEAK_LIMIT` กัน clipping บน Web Audio bus |

### SFX preset model (`SoundPreset`)

```typescript
interface SoundPreset {
  wave?: 'square' | 'triangle' | 'sawtooth' | 'noise'
  freq?: number          // Hz เริ่มต้น
  freqEnd?: number       // pitch slide ตอนจบ (optional)
  duration?: number      // วินาที
  attack?: number
  decay?: number
  sustain?: number
  release?: number
  gain?: number
  sequence?: { freq: number; duration?: number }[]  // arpeggio
  noteDuration?: number
}
```

**ตัวอย่าง preset:**

| Preset | รูปแบบ |
|---|---|
| `ui_click` | single tone — triangle 880 Hz, 40 ms |
| `battle_impact` | pitch slide — square 440→110 Hz |
| `level_up` | arpeggio — C5→E5→G5→B5 |
| `battle_travel` | noise sweep — bandpass 600→200 Hz |

**SFX catalog (40 รายการ)** แบ่งตาม domain:

| กลุ่ม | ตัวอย่าง ID |
|---|---|
| UI | `ui_click`, `ui_confirm`, `ui_cancel`, `ui_tab`, `ui_error`, `title_start` |
| Care | `care_eat`, `care_drink`, `care_medicine`, `care_toy`, `care_happy` |
| Progression | `level_up`, `evolve`, `hatch`, `egg_notify`, `mission_claim` |
| Battle | `battle_windup`, `battle_travel`, `battle_impact`, `battle_recover`, `battle_guard`, `battle_dodge`, `battle_heal`, `battle_flee`, `battle_ko`, `battle_win`, `battle_lose` |
| Minigame | `jump`, `land`, `minigame_hit`, `minigame_over` |
| Economy / social | `collect`, `market_buy`, `item_use`, `breed`, `release`, `chat_dash`, `chat_bite`, `notification_pop` |

ทุก `SfxId` ใน `soundIds.ts` ต้องมี entry ใน `SOUND_PRESETS` — ตรวจด้วย Vitest (`soundManager.test.ts`)

### BGM track model (`MusicTrack`)

```typescript
interface MusicTrack {
  bpm: number
  beatsPerBar: number
  bars: number
  masterGain: number
  channels: {
    wave: WaveType
    gain: number
    pattern: { freq: number | null; beats: number }[]  // null = rest
  }[]
}
```

Sequencer วน loop ตาม `beatsPerBar × bars` โดย schedule note ล่วงหน้า 200 ms (`LOOKAHEAD_SEC`) ผ่าน interval tick 25 ms — crossfade 400 ms ตอนเปลี่ยน/หยุดแทร็ก

| BgmId | BPM | บทบาท | ใช้ที่ |
|---|---|---|---|
| `title` | 90 | เปิดเกม / intro | `TitleScreen` |
| `hub` | 110 | เมนูหลัก / home | hub views ทั่วไป |
| `battle` | 140 | ต่อสู้ปกติ | `BotBattle`, PvP |
| `boss` | 168 | ต่อสู้ boss / intense | boss encounters |
| `minigame` | 130 | มินิเกม | `DinoJump`, `RockDodge` |

### API ที่ UI เรียกใช้

| Function | หน้าที่ |
|---|---|
| `playSfx(id, { element?, pitchMultiplier? })` | เล่น one-shot SFX |
| `setBgmTrack(id \| null)` | สลับ/หยุด BGM (crossfade) |
| `pauseBgm()` / `stopBgm()` | หยุด playback โดยไม่ลืม track ที่เลือก / ล้าง selection |
| `unlockAudio()` | resume `AudioContext` หลัง user gesture (browser autoplay policy) |
| `toggleMuted()` / `isMuted()` | mute ทั้ง SFX + BGM, persist ใน localStorage |

**Browser autoplay:** `SoundManager` attach `pointerdown` / `keydown` listener ครั้งแรกเพื่อ unlock — `TitleScreen` เรียก `unlockAudio()` ก่อนเล่นเสียง

**Battle integration:** `battleSfx.ts` map FX phase (`windup`, `travel`, `impact`, `recover`) → SFX พร้อม delay offset ตาม `fx.durationMs`; guard/dodge ใช้ role-based mapping

### Gain staging (`audioLevels.ts`)

| Constant | ค่า | ใช้กับ |
|---|---|---|
| `SFX_OUTPUT_GAIN` | 1.55 | peak gain ของ one-shot SFX |
| `BGM_BUS_GAIN` | 2.0 | master bus ของ sequencer |
| `BGM_NOTE_GAIN` | 0.42 | gain ต่อ note ใน channel |
| `AUDIO_PEAK_LIMIT` | 0.48 | hard ceiling กัน clipping |

### วิธีเพิ่มเสียงใหม่

```text
1. เพิ่ม id ใน soundIds.ts (หรือ musicIds.ts สำหรับ BGM)
2. เพิ่ม preset/track ใน soundPresets.ts (หรือ musicTracks.ts)
3. เรียก playSfx('new_id') / setBgmTrack('new_id') จาก UI
4. npm test -- src/shared/audio/   ← ตรวจ catalog coverage
```

**Tips ออกแบบ preset chiptune:**

- UI click สั้น (~40–60 ms), gain ต่ำ (~0.10–0.14)
- Impact ใช้ pitch slide (`freq` → `freqEnd` ต่ำลง) + square wave
- Victory fanfare ใช้ `sequence` arpeggio ขึ้น
- Defeat ใช้ arpeggio ลง
- Noise channel เหมาะกับ whoosh / hi-hat — ใส่ `freq` เป็น center frequency ของ bandpass

### Tests

| ไฟล์ | ตรวจอะไร |
|---|---|
| `soundManager.test.ts` | SFX catalog completeness, mute persistence |
| `musicManager.test.ts` | BGM track switching, sequencer lifecycle |

---

## Backend — Supabase

### Stack

| Component | ใช้งาน |
|---|---|
| **PostgreSQL** | Game state, profiles, pets, inventory, battles |
| **Supabase Auth** | Email/password, recovery flow |
| **Row Level Security** | ทุกตาราง — owner-only writes |
| **RPC functions** | `breed_pets`, `check_signup_availability`, battle actions, admin ops |
| **Realtime** | Battle rooms, chat rooms, game speed broadcast |
| **Migrations** | `supabase/migrations/` (001–056+) |

### Client architecture

```text
src/shared/supabaseService.ts   ← factory: createSupabaseService({ getSupabase })
         ▲                                    ▲
         │                                    │
electron/main/supabase.ts          web/src/supabase.ts
(file auth storage + ws)           (localStorage session)
```

Service layer รวม: auth, friends, battle rooms, chat, cloud save, admin — **ไม่ expose service_role ไป renderer**

### Cloud save mapping

`src/shared/dbMapper.ts` แปลง:
- `GameSave` ↔ DB rows (`pets`, `inventory`, `missions`, `player_activity`, …)
- Legacy column names (`dev_points` → `evolution`) handled ใน mapper + migrations

Desktop sync: debounced write จาก `electron/main/cloudStorage.ts` หลัง `setGameSave()`

### Environment

```env
# Browser / Vite (public)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Electron main (build-time / .env.production bundle)
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Production Electron bundle: `.env.production` → `resources/.env` via `electron-builder extraResources`

---

## Asset Pipeline

### Runtime assets

```text
assets/creatures/{species}/{stage}/{clip}.png   ← sprite strips (production)
assets/ui/                                       ← HUD icons, logos, home backgrounds
assets/creatures/frame-manifest.json             ← per-frame dimensions
```

### Agent Sprite Forge (`generate2dsprite`)

**Agent Sprite Forge** คือ workflow สร้าง sprite/animation sheet แบบ 2 ชั้น ที่ Taskino ใช้สำหรับ creature, FX และ asset 2D อื่นๆ — skill อยู่ที่ `.agents/skills/generate2dsprite/` (ชื่อ skill: `generate2dsprite`, invoke ด้วย `$generate2dsprite`)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1 — Creative (Agent + built-in image_gen)                │
│  · เขียน prompt เอง (ไม่ใช้ script สร้าง prompt เป็นค่าเริ่มต้น) │
│  · สร้าง raw sheet พื้นหลัง solid magenta (#FF00FF)           │
│  · grid หลายแถว (2×2, 2×3 …) — ห้าม 1×N สำหรับตัวละคร         │
└────────────────────────────┬────────────────────────────────────┘
                             │ raw-sheet.png
┌────────────────────────────▼────────────────────────────────────┐
│  Layer 2 — Deterministic postprocess (generate2dsprite.py)      │
│  · chroma key cleanup · แยก frame · crop/align · shared scale   │
│  · QC metadata · transparent sheet · GIF preview                │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  Layer 3 — Taskino project scripts (repo-specific)              │
│  · creature-manifest.mjs เป็น source of truth                   │
│  · process-creature-clip.mjs → creature_sheet_crop.py → stitch  │
│  · validate / promote → assets/creatures/                       │
└─────────────────────────────────────────────────────────────────┘
```

#### หลักการสำคัญ

| หลักการ | รายละเอียด |
|---|---|
| **AI สร้างภาพ, script ประมวลผล** | ห้ามใช้ Canvas/SVG/PIL วาด sprite แทน image_gen |
| **หนึ่ง action ต่อหนึ่ง raw sheet** | ไม่รวม idle+attack+run ใน sheet เดียว |
| **Body-only สำหรับ attack** | slash arc / projectile / dust แยกเป็น FX sheet |
| **Anchor contract** | grounded action ใช้ feet baseline (`y=176` บน cell 192px) |
| **Scale profile** | idle/run ที่ pass QC กลายเป็น reference สำหรับ action อื่น |
| **Taskino override** | กฎ repo (`creature-manifest.mjs`) ชนะ default ของ skill |

#### ไฟล์ skill หลัก

| Path | บทบาท |
|---|---|
| `.agents/skills/generate2dsprite/SKILL.md` | กฎ workflow สำหรับ agent |
| `.agents/skills/generate2dsprite/scripts/generate2dsprite.py` | Postprocessor หลัก (Pillow + NumPy) |
| `.agents/skills/generate2dsprite/scripts/make_layout_guide.py` | Layout guide สำหรับ image_gen |
| `.agents/skills/generate2dsprite/scripts/make_anchor_layout.py` | Character anchor sheet (lock scale/feet) |
| `.agents/skills/generate2dsprite/references/prompt-rules.md` | กฎเขียน prompt |
| `.agents/skills/generate2dsprite/references/modes.md` | เลือก bundle/mode เมื่อ request คลุมเครือ |

Script ค้นหา skill จาก (ลำดับความสำคัญ):

1. `~/.agents/skills/generate2dsprite/scripts/`
2. `~/.codex/skills/generate2dsprite/scripts/`
3. `.agents/skills/generate2dsprite/scripts/` (ใน repo)

#### CLI ของ `generate2dsprite.py`

```bash
# ดู target/mode ที่รองรับ
python .agents/skills/generate2dsprite/scripts/generate2dsprite.py list-options

# Postprocess raw sheet (ใช้บ่อยที่สุด)
python .agents/skills/generate2dsprite/scripts/generate2dsprite.py process \
  --input raw-sheet.png \
  --target creature --mode idle \
  --rows 2 --cols 2 \
  --output-dir ./output \
  --cell-size 192 \
  --align feet \
  --fit-scale 0.85 \
  --component-mode largest \
  --strict-qc

# สร้าง scale profile จาก action ที่ accept แล้ว
python .../generate2dsprite.py process \
  ... \
  --scale-strategy preserve \
  --write-scale-profile ./character-scale-profile.json

# Godot Sprite3D contract (ไม่ใช่ runtime หลักของ Taskino แต่ skill รองรับ)
python .../generate2dsprite.py build-godot-bundle \
  --action idle=.../godot-sprite3d.json \
  --output ./godot-sprite3d-bundle.json
```

**Python dependencies:** Pillow, NumPy

#### Workflow สำหรับ Taskino creatures

```text
1. สร้าง/แก้ master ต่อ element
   assets/creature-prototypes/{species}/master-{egg|baby|adult}.png
   python scripts/finalize_creature_master.py finalize ...

2. สร้าง animation ต่อ clip (agent + image_gen)
   assets/creature-prototypes/{species}/animations/{stage}/{clip}/
     ├── prompt-used.txt
     ├── raw-sheet.png          ← จาก image_gen (magenta bg)
     ├── raw-sheet-clean.png    ← หลัง chroma key
     ├── {clip}-1.png …         ← frames 192×192 RGBA
     ├── sheet-transparent.png
     ├── animation.gif          ← preview
     ├── pipeline-meta.json
     └── qc.json                ← pass/fail + metrics

3. Postprocess ผ่าน project wrapper
   npm run creature:process -- \
     --input raw-sheet.png \
     --species dragon --stage baby --clip idle

   ภายในเรียก creature_sheet_crop.py → (import จาก generate2dsprite) → stitch_sprite_strip.py

4. Validate prototype
   python scripts/validate_prototype_animation.py \
     --input-dir assets/creature-prototypes/dragon/animations/baby/idle \
     --prefix idle --frames 4 \
     --scale-reference assets/creature-prototypes/dragon/master-baby.png

5. Promote ไป runtime (เมื่อ roster approve)
   node scripts/promote-creature-prototypes.mjs
   → assets/creatures/{species}/{stage}/{clip}.png
   → sync frame-manifest.json + src/shared/creatureFrameManifest.ts

6. ตรวจ coverage
   npm run check:creatures
   npm run check:assets
```

#### Clip / grid ตาม `creature-manifest.mjs`

| Stage | Clips | Grid | Frames |
|---|---|---|---|
| `egg` | move, hatch | 2×3 | 6 |
| `baby` | idle, move, hurt, bite, jump | 2×2 | 4 |
| `adult` | idle, move, hurt, bite, jump | 2×2 | 4 |

- **Chroma key ปัจจุบัน:** green (runtime cropper) — prototype บางชุดใช้ magenta ตอน generate
- **Process cell size:** 192px
- **Jump clips:** ใช้ `--preserve-cell-position` + `finalize_creature_jump.py` (ไม่ใช้ feet aligner)
- **Hatch frame 6:** ต้องตรง pixel กับ baby idle master (transition ไม่กระโดดขนาด)

#### npm scripts ที่เกี่ยวข้อง

| Command | หน้าที่ |
|---|---|
| `npm run creature:process` | Process clip เดียว → runtime strip |
| `npm run creature:stitch` | Stitch frames เป็น horizontal strip |
| `npm run creature:batch -- <cmd>` | Batch pipeline (`plan`, `process`, `all`, …) |
| `npm run check:creatures` | ตรวจ strips + adaptive frame sizes |
| `npm run check:assets` | ตรวจ UI asset references |

#### Output artifacts ที่ agent ควรเก็บ

| ไฟล์ | เนื้อหา |
|---|---|
| `qc.json` | edge touch, scale drift, anchor std, pass/fail |
| `pipeline-meta.json` | rows/cols, fit_scale, baseline_y, chroma settings |
| `anchor-contract.json` | feet line, scale profile, reference paths |
| `prompt-used.txt` | prompt ที่ใช้ generate (audit/repro) |
| `animation.gif` | preview loop สำหรับ review |

#### เมื่อไหร่ invoke skill

| งาน | Skill |
|---|---|
| สร้าง/แก้ creature animation sheet | `generate2dsprite` (+ อ่าน `taskido` skill) |
| Battle FX, projectiles, skill icons | `generate2dsprite` |
| Map backgrounds / props | `generate2dmap` (ไม่ใช่ Sprite Forge) |

ดูรายละเอียด prototype roster: [assets/creature-prototypes/README.md](../assets/creature-prototypes/README.md)

### Generation pipeline (สรุป)

```text
assets/creature-prototypes/   → AI raw sheets + QC metadata
scripts/creature-manifest.mjs → source of truth (species, clips, grid, chroma)
scripts/*.mjs + *.py          → chroma key, crop, stitch, adaptive fit
sprite-output/                → intermediate
assets/creatures/             → final runtime strips
```

**Validation:**
- `npm run check:assets` — UI asset coverage
- `npm run check:creatures` — strip + frame manifest consistency

---

## Testing

| Tool | Config |
|---|---|
| **Vitest** 4.1 | default config (inline ใน package.json scripts) |
| **Run** | `npm test` / `npm run test:watch` |

Tests อยู่ข้าง source (`*.test.ts`) — เน้น pure logic:
- `shared/battle/` — damage, engine, bot
- `shared/` — elements, combatStats, growth, minigame, market
- `hub/` — dashSceneBackgrounds

**ไม่มี** E2E / Playwright ใน repo ปัจจุบัน

---

## Build & Release

### Commands

| Command | ผลลัพธ์ |
|---|---|
| `npm run dev` | Electron HMR (main + renderer) |
| `npm run dev:web` | Vite dev :5174 |
| `npm run build` | `out/` (Electron bundles) |
| `npm run build:web` | `dist-web/` |
| `npm run build:win` | NSIS installer → `dist/Taskino Setup 0.1.0.exe` |
| `npm run build:mac` | DMG (macOS only) |
| `npm run typecheck` | `tsc --noEmit` |

### electron-builder highlights

| Setting | ค่า |
|---|---|
| `appId` | `com.taskino.app` |
| `asarUnpack` | `uiohook-napi` (native module) |
| Icons | `build/icons/taskino.ico` / `.icns` |
| Extra resources | `.env`, tray icon |

---

## Security notes

| หัวข้อ | แนวทาง |
|---|---|
| Supabase keys | เฉพาะ anon/publishable ใน client — **ไม่มี service_role ใน renderer/web** |
| IPC | `contextBridge` only — ไม่เปิด `nodeIntegration` |
| RLS | ทุก mutation ผ่าน policies + RPC ownership checks |
| Auth storage | Desktop: encrypted file ใน userData; Web: Supabase default localStorage |

---

## TypeScript project layout

```text
tsconfig.json          → references only
tsconfig.web.json      → src/** + electron/preload types
tsconfig.node.json     → electron/main, scripts, vite configs
```

Path aliases (compile-time):

| Alias | Path |
|---|---|
| `@renderer/*` | `src/*` |
| `@shared/*` | `src/shared/*` |
| `@hub/*` | `src/hub/*` (web only) |
| `@api/*` | `src/api/*` (web only) |

---

## เอกสารที่เกี่ยวข้อง

| เอกสาร | เนื้อหา |
|---|---|
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | ภาพรวมโปรเจกต์ |
| [GAME_VALUES.md](./GAME_VALUES.md) | ค่าคงที่ในเกม |
| [GAME_GUIDE_TH.md](./GAME_GUIDE_TH.md) | คู่มือผู้เล่น |
| [supabase/SETUP.md](../supabase/SETUP.md) | DB setup |
| [web/DEPLOY.md](../web/DEPLOY.md) | Web deploy |
| [.agents/skills/taskido/references/project-map.md](../.agents/skills/taskido/references/project-map.md) | Agent project map |
