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

### Generation pipeline

```text
assets/creature-prototypes/   → AI raw sheets + QC metadata
scripts/creature-manifest.mjs → source of truth (species, clips, grid, chroma)
scripts/*.mjs + *.py          → chroma key, crop, stitch, adaptive fit
sprite-output/                → intermediate
assets/creatures/             → final runtime strips
```

**Python deps (processors):** Pillow, NumPy

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
