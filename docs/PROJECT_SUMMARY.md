# Taskido / Taskino — สรุปโปรเจกต์

> เอกสารอ้างอิงภาพรวม repo — อัปเดตล่าสุด: ส.ค. 2026

## ภาพรวม

| รายการ | รายละเอียด |
|---|---|
| **ชื่อ repo** | `taskido` |
| **ชื่อผลิตภัณฑ์ / package** | Taskino (`taskino` v0.1.0) |
| **ประเภท** | เกมสัตว์เลี้ยงเสมือน (Tamagotchi-style) ธีมไดโนเสาร์ธาตุ |
| **แพลตฟอร์ม** | Desktop (Electron) + Web (Vite) |
| **Production Web** | [https://taskimon.vercel.app](https://taskimon.vercel.app) |
| **Backend** | Supabase (Auth, Database, Realtime, Storage) |
| **Node.js** | ≥ 24 |
| **License** | MIT |
| **Author** | kittanet0301 |

เกมที่ผู้เล่นดูแลสัตว์เลี้ยงไดโนเสาร์ธาตุ ฟักไข่ → เติบโต → ต่อสู้ PvP แบบ async → เล่นมินิเกม → สังคม (เพื่อน/แชท/ของขวัญ) รองรับทั้ง **แอป desktop ลอยบนจอ** และ **เว็บเบราว์เซอร์**

---

## Tech Stack

| ชั้น | เทคโนโลยี |
|---|---|
| **Desktop shell** | Electron 34, electron-vite, electron-builder |
| **Frontend** | React 18, TypeScript 5.9 |
| **Build (Web)** | Vite 5 |
| **i18n** | i18next + react-i18next (TH / EN) |
| **Database / Auth** | @supabase/supabase-js 2.109 |
| **Global input (Desktop)** | uiohook-napi (คลิก/พิมพ์ทั้งเครื่อง) |
| **Realtime** | WebSocket (ws) |
| **Testing** | Vitest (18 test files) |
| **Asset pipeline** | Node.js scripts + Python (Pillow, NumPy) |

---

## ฟีเจอร์หลัก

### 1. ระบบสัตว์เลี้ยง (Pet Care)

- **ก่อน login:** สัตว์แสดงเป็นไข่, tray ไม่โชว์สถิติ
- **หลัง login:** โหลดสัตว์จริงจาก cloud
- **วงจรชีวิต:** Egg → Baby → Adult
- **สุ่มฟัก:** 1 ใน 9 สายพันธุ์ + เพศ (male/female)
- **Care stats:** Health, Emotion, Evolution
- **Global activity tracking (Desktop, หลัง login):** นับคลิก/พิมพ์ทั้งเครื่อง → ส่งผลต่อ evolution

### 2. ระบบ RPG / Combat

- **Primary stats:** STR / DEX / INT / CON (กำหนดตามธาตุตอนฟัก)
- **Derived stats:** Battle HP / MP / ATK / DEF / EVA
- **ธาตุ 9 ชนิด:** fire, grass, ground, electric, water, ice, dragon, dark, neutral
- **Element system:** แรง/อ่อน, pure (60%) / dual (40% — ปิดชั่วคราวด้วย `FORCE_PURE_ELEMENTS`)
- **เลเวลอัพ:** เลือก Growth Card 1 จาก 3 + อัปแรงค์สกิล (สูงสุด 8 แต้ม)
- **Growth Cards:** power_up, swift, focus, tough, bruiser, magelet, all_round
- **สกิล:** โหลดเอาต์ 3 สกิล + 1 Ultimate ตามธาตุ (สุ่มตอนฟัก)

### 3. การต่อสู้ (Async PvP)

- สร้าง/เข้าร่วมห้องต่อสู้ด้วยรหัส (1v1)
- การกระทำ: Attack / Skill / Item / Defend / Flee
- ลำดับเทิร์นตาม DEX
- ดาเมจจาก STR/INT + ธาตุ + แรงค์สกิล
- HP / MP / TP (Technique Points) บน session
- Bot battle สำหรับฝึก
- ประวัติดวล + popup ผลชนะ/แพ้

### 4. ผสมพันธุ์ (Breeding)

- สร้างไข่จากสัตว์ 2 ตัว
- ต้องใช้ item `breed_nest`
- มี cooldown (`lastBredAt`)
- บังคับธาตุ pure ชั่วคราว (migration `045` + `FORCE_PURE_ELEMENTS`)

### 5. ไอเท็ม & กระเป๋า

| Item | หน้าที่ |
|---|---|
| `food_basic` | อาหารพื้นฐาน (+15 feed) |
| `food_premium` | อาหารพรีเมียม (+30 feed, +10 heal) |
| `medicine` | รักษา (+40 heal) |
| `water` | น้ำ (+10 feed, +5 heal) |
| `toy` | ของเล่น (+25 feed) |
| `dev_vitamin` | วิตามินพัฒนาการ (+50 evolution) |
| `battle_shield` | โล่ต่อสู้ |
| `breed_nest` | รังผสมพันธุ์ |
| `skill_forget` | ลืมสกิล |

- Quick-care slots (4 ช่อง)
- Market (ซื้อขาย)
- Gems (สกุลเงินพิเศษ)

### 6. ภารกิจ (Missions)

- Daily / Weekly missions
- Sync ทั้ง local + cloud

### 7. สังคม & ชุมชน

- ระบบเพื่อน (friend code)
- แชทห้อง (Chat Rooms + lobby canvas)
- ส่งของขวัญ (Gifts)
- โปรไฟล์ผู้เล่น + Collection slots

### 8. มินิเกม

| เกม | ID |
|---|---|
| Dino Jump | `dino_jump` |
| Rock Dodge | `rock_dodge` |

- Ranking + best scores
- รางวัลไอเท็มรายวัน

### 9. Admin

- Admin Panel (role-based)
- Global game speed multiplier (x1–x16)
- ลบ user (migration `052`)

---

## สายพันธุ์สัตว์ (9 Species)

| Species | ธาตุ | สี preview |
|---|---|---|
| `neutral` | neutral | `#a9a38f` |
| `fire` | fire | `#e85d3f` |
| `grass` | grass | `#55a85b` |
| `ground` | ground | `#9a724e` |
| `electric` | electric | `#f2cf42` |
| `water` | water | `#3d8ed0` |
| `ice` | ice | `#82d6e8` |
| `dragon` | dragon | `#f0940f` |
| `dark` | dark | `#4b405f` |

**Legacy migration:** `garden`→grass, `blaze-crest`→fire, `crag-shell`→ground, `tide-fin`→water, `volt-wing`→electric

**Animation clips ต่อ stage:**

| Stage | Clips |
|---|---|
| `egg` | move (6 frames), hatch (6 frames) |
| `baby` | idle, move, hurt, bite, jump (4 frames แต่ละ clip) |
| `adult` | idle, move, hurt, bite, jump (4 frames แต่ละ clip) |

**Display size:** egg/baby = 250px, adult = 500px

---

## UI / ธีม

### Auth screens (`.pixel-cover`)

- พื้นหลังท้องฟ้า + หญ้า + เมฆ pixel
- Animated egg sprite
- ปุ่ม blocky 3D, input มุมคม
- สลับภาษา EN/TH

### Hub (`.pixel-hub`)

- **Top bar:** โลโก้, Gems/Clicks/Typing/Activity, ชื่อผู้เล่น, EN/TH
- **Sidebar:** Collection, Inventory, Market, Community, Minigame, Battle, Settings (+ Admin)
- **Focus mode:** กดไอคอนมังกร → ซ่อนเมนู เหลือแค่ตัวละคร (Esc คืน)
- **Home HUD:** Daily/Weekly, สถานะสัตว์, Combat stats, quickbar ไอเท็ม

### Fonts

- **Mali** — ข้อความไทย / UI หลัก
- **Press Start 2P** — HUD pixel / badge / qty

### CSS Variables

- Palette ร่วมกันผ่าน `--pixel-*` ใน `src/styles.css`

---

## โครงสร้างโปรเจกต์

```text
taskido/
├── electron/
│   ├── main/          # Main process: windows, tray, activity, Supabase, storage
│   └── preload/       # IPC bridges (hub + pet)
├── src/
│   ├── hub/           # React Hub UI
│   │   ├── battle/    # ห้องต่อสู้, arena, history, bot
│   │   ├── chat/      # Chat rooms, lobby canvas
│   │   └── minigame/  # Dino Jump, Rock Dodge
│   ├── pet/           # Desktop pet canvas renderer
│   ├── shared/        # Game logic ร่วม (rules, types, battle engine)
│   │   └── battle/    # Engine, damage, skill trees, rewards, bot
│   ├── components/    # Shared UI components
│   ├── i18n/          # TH/EN locales
│   ├── api/           # Renderer-facing types
│   └── styles.css     # Global + pixel theme
├── web/               # Browser adapter (Vite config, storage, activity)
├── assets/
│   ├── creatures/     # Runtime sprite strips (production)
│   ├── creature-prototypes/  # AI generation masters + QC
│   ├── raw-creatures/ # Raw inputs
│   └── ui/            # Logo, HUD icons, item icons, home backgrounds
├── scripts/           # Asset validation + creature pipeline (37 scripts)
├── supabase/
│   └── migrations/    # 56 SQL migration files
├── build/icons/       # App icons (.ico, .icns)
└── .agents/skills/    # Agent skills (taskido, generate2dsprite, etc.)
```

---

## Desktop vs Web

| ความสามารถ | Desktop | Web |
|---|---|---|
| Pet overlay ลอยบนจอ | ✅ | ❌ |
| Global click/keyboard tracking | ✅ (หลัง login) | ❌ (เฉพาะในหน้าเว็บ) |
| System tray + สถิติ | ✅ | ❌ |
| Hub UI ทุกแท็บ | ✅ | ✅ |
| Login / Sign up / DB sync | ✅ | ✅ |
| Offline save | `pet-save.json` | `localStorage` |
| Dev server | `npm run dev` | `npm run dev:web` (port 5174) |
| Build output | `dist/` (.exe / .dmg) | `dist-web/` |

---

## Supabase / Database

- **Production URL:** `https://novdkkhgztlskcnjzott.supabase.co`
- **Migrations:** 56 ไฟล์ (001 → 056)
- **Migration ล่าสุด:**
  - `044` — RPG stats, skills, growth cards, battle actions, breeding
  - `045` — Force pure elements (ชั่วคราว)
  - `046`–`056` — Admin role, creature species rename, battle room fixes, game speed

### ตาราง / ฟีเจอร์ DB หลัก

- `profiles` — ผู้เล่น, username, friend_code, role
- `pets` — สัตว์เลี้ยง + RPG columns
- `inventory`, `quick_item_slots`
- `missions`, `player_activity`
- `friendships`, `gifts`, `gems`
- `battle_rooms`, `battle_sessions`, `battle_actions`
- `chat_rooms`, `chat_messages`
- `minigame_scores`, `minigame_state`
- `pet_collection_slots`
- RPCs: `breed_pets`, `claim_pending_gifts`, `admin_delete_user`, etc.
- RLS policies ทุกตาราง

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

ดูคู่มือเต็ม: [supabase/SETUP.md](../supabase/SETUP.md)

---

## คำสั่งพัฒนา

| คำสั่ง | หน้าที่ |
|---|---|
| `npm install` | ติดตั้ง dependencies |
| `npm run dev` | Electron dev mode |
| `npm run dev:web` | Web dev (localhost:5174) |
| `npm run build` | Build Electron |
| `npm run build:web` | Build web → `dist-web/` |
| `npm run build:win` | Windows installer (.exe) |
| `npm run build:mac` | macOS installer (.dmg) |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run check:assets` | ตรวจ UI assets |
| `npm run check:creatures` | ตรวจ creature strips |
| `npm run creature:process` | Process creature clip |
| `npm run creature:batch` | Batch creature pipeline |
| `npm run home-bg:process` | Process home background |

---

## Creature Asset Pipeline

```text
assets/creature-prototypes/{species}/  →  AI generation + QC
         ↓ (promote + process)
assets/raw-creatures/{species}/        →  Raw inputs
         ↓ (chroma key, crop, align)
sprite-output/{species}/               →  Intermediate output
         ↓ (stitch, adaptive fit)
assets/creatures/{species}/{stage}/    →  Runtime strips
         ↓ (manifest sync)
src/shared/creatureFrameManifest.ts    →  Frame sizes for renderer
```

- **Source of truth:** `scripts/creature-manifest.mjs`
- **Chroma key:** green (ปัจจุบัน)
- **Process cell size:** 192px
- **Frame manifest:** `assets/creatures/frame-manifest.json`

---

## Testing

18 test files ครอบคลุม:

- `combatStats`, `elements`, `growth`
- `battle/damage`, `battle/engine`, `battle/bot`, `battle/battleFx`
- `gameMutators`, `gameSpeed`, `minigame`
- `dinoJumpPhysics`, `rockDodgePhysics`, `dinoTiming`
- `market`, `inventorySync`, `eggNotifications`
- `dashSceneBackgrounds`

---

## Deploy

| แพลตฟอร์ม | วิธี |
|---|---|
| **Web (Production)** | Vercel auto deploy จาก `main` → [taskimon.vercel.app](https://taskimon.vercel.app) |
| **Desktop Windows** | `npm run build:win` → `dist/Taskino Setup 0.1.0.exe` |
| **Desktop macOS** | `npm run build:mac` → `.dmg` (ต้อง Accessibility permission) |

Installer อ่าน Supabase จาก `resources/.env` (bundle จาก `.env.production`)

ดูคู่มือ deploy web: [web/DEPLOY.md](../web/DEPLOY.md)

---

## Demo Milestones

| Demo | วันที่ | เนื้อหา |
|---|---|---|
| **Demo 1** | Jul 20 | Offline core — pet, egg, growth, stats, items, missions, save/load |
| **Demo 2** | Aug 7 | Online — auth, friends, battle, chat, profile sync |
| **หลัง Demo 2** | — | RPG stats/skills/growth cards/breeding, combat HUD, home focus mode |

---

## Agent Skills (Project-local)

| Skill | ใช้เมื่อ |
|---|---|
| `taskido` | งาน repo ทั่วไป, debugging, testing, release |
| `generate2dsprite` | สร้าง/แก้ creature sprites, animations, FX |
| `generate2dmap` | Battle arenas, map backgrounds, collision |
| `supabase` | Auth, DB, migrations, RLS, RPC |
| `supabase-postgres-best-practices` | SQL, indexing, performance |

---

## เอกสารที่เกี่ยวข้อง

| เอกสาร | เนื้อหา |
|---|---|
| [README.md](../README.md) | Quick start, features, build |
| [docs/GAME_GUIDE_TH.md](./GAME_GUIDE_TH.md) | คู่มือการเล่น (ภาษาไทย) |
| [docs/GAME_VALUES.md](./GAME_VALUES.md) | ค่าคงที่และสูตรในเกม (อ้างอิงจาก source) |
| [supabase/SETUP.md](../supabase/SETUP.md) | ตั้งค่า Supabase + migrations |
| [web/DEPLOY.md](../web/DEPLOY.md) | Deploy เวอร์ชัน web |
| [.agents/skills/taskido/references/project-map.md](../.agents/skills/taskido/references/project-map.md) | Project map สำหรับ agent |
