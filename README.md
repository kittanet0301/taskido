# Taskino

Tamagotchi-style desktop pet game with dino characters — desktop (Electron) + web.

**เวอร์ชันเว็บ (production):** [https://taskimon.vercel.app](https://taskimon.vercel.app)

## Features

- Transparent always-on-top pet window on desktop
- **ก่อน login:** สัตว์แสดงเป็นไข่, tray ไม่โชว์สถิติ — **หลัง login** โหลดสัตว์จริงจาก cloud
- Random egg hatch → one of 9 elemental dinosaur species, male/female
- Growth: Egg → Baby → Adult
- **Care stats:** Health, Emotion, Evolution (เดิม HP / mood / development)
- **RPG combat stats:** STR / DEX / INT / CON + ธาตุ (pure / dual) → Battle HP / MP / EVA
- **เลเวลอัพ:** เลือก Growth Card 1 จาก 3 + แต้มอัปแรงค์สกิล (สูงสุด 8)
- **สกิล:** โหลดเอาต์ 3 สกิล + 1 Ultimate ตามธาตุ (สุ่มตอนฟัก)
- **ผสมพันธุ์ (breeding):** สร้างไข่จากสัตว์สองตัว (cooldown + nest item)
- Global click/keyboard activity tracking for evolution (desktop, หลัง login เท่านั้น)
- Items, quick-care slots, daily/weekly missions (local + cloud sync)
- Gems, gifts, friends, chat, profile, collection slots
- Mini-games (เช่น Dino Jump) + ranking
- **ต่อสู้ (PvP แบบ async):**
  - ห้องต่อสู้ — สร้าง/เข้าร่วมด้วยรหัส, 1v1 ในห้อง
  - การกระทำ: Attack / Skill / Item / Defend / Flee
  - ลำดับเทิร์นตาม DEX, ดาเมจจาก STR/INT + ธาตุ + แรงค์สกิล
  - HP / MP / TP (เทคนิค) บน session
  - จบดวล → popup ผลชนะ/แพ้ + กลับแท็บห้องอัตโนมัติ

## UI

ธีม **retro pixel art dino** ใช้ทั้งแอปหลังเปิด:

**Auth (ก่อนเข้า Hub)** — `.pixel-cover` บน Login / Sign up / Forgot password / Get Started:
- พื้นหลังท้องฟ้า + หญ้า + เมฆ pixel
- โลโก้ **animated egg sprite** จาก creature pipeline ใน `assets/creatures/`
- ปุ่ม blocky 3D, input มุมคม, สลับภาษา EN/TH มุมขวาบนการ์ด

**Hub (หลัง login)** — `.pixel-hub` + home scene HUD:
- แถบบน: โลโก้ Taskino, Gems / Clicks / Typing / Activity, ชื่อผู้เล่นด้านขวา, EN/TH
- เมนูซ้าย: ไอคอนลอยโปร่งใสบนฉาก home — กดรูปมังกรเพื่อโหมดโฟกัส (ซ่อนเมนู เหลือแค่ตัวละคร; กดอีกครั้งหรือ Esc เพื่อคืน)
- แผง Daily/Weekly, สถานะสัตว์ + Combat stats, quickbar ไอเท็ม (ตัวเลข **Press Start 2P**)
- เลเวลอัพ: ป๊อปอัปเลือก Growth Card + อัปสกิล (ฟอนต์ **Mali**)
- Collection / Profile: แผงโหลดเอาต์สกิล + growth cards
- ฟอนต์: **Mali** (ข้อความไทย / UI หลัก) + **Press Start 2P** (HUD pixel / badge / qty)

Palette ร่วมกันผ่าน CSS variables (`--pixel-*`) ใน `styles.css` — desktop pet overlay ไม่ได้รับผลกระทบ

## Quick Start

```bash
npm install
npm run dev
```

เปิดแอป → หน้า **Login** (หรือสมัคร/ลืมรหัส) → หลัง login ครั้งแรกจะเจอ **Get Started** → เข้า Hub

- สมัคร/เข้าสู่ระบบได้จากหน้า gate ก่อนเข้า Hub (หรือเล่น offline ก่อนได้ — สัตว์บนจอยังเป็นไข่จนกว่าจะ login)
- จัดการบัญชีเพิ่มเติมได้ที่แท็บ **บัญชี** ใน Settings หลัง login

## Asset Setup

Creature sprites อยู่ใน `assets/creatures/{species}/{egg|baby|adult}/` และสร้างผ่าน
project-local creature pipeline เท่านั้น เพิ่มไฟล์ UI ภายใต้ `assets/ui/` แล้วตรวจด้วย
`npm run check:assets` และ `npm run check:creatures`

ถ้าไฟล์บางส่วนหาย เกมจะ fallback เป็นวงกลมสีแทน sprite บางตัว

## Environment (Database)

ดูคู่มือเต็ม: [supabase/SETUP.md](supabase/SETUP.md)

คัดลอก `.env.example` → `.env` (dev) หรือใช้ `.env.production` (build/deploy):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

รัน SQL ทุกไฟล์ใน `supabase/migrations/` ตามลำดับชื่อไฟล์ (ถึง `045_force_pure_elements.sql`) แล้ว login — ข้อมูลจะบันทึกลง DB อัตโนมัติ

สำคัญล่าสุด:
- **`044_rpg_battle_stats_skills_breeding.sql`** — care rename + RPG columns + battle Attack/Skill/Item + `breed_pets`
- **`045_force_pure_elements.sql`** — บังคับธาตุ pure ชั่วคราวตอนผสมพันธุ์ (คู่กับ `FORCE_PURE_ELEMENTS` ใน client)

### Password reset และ rate limits

- ระบบลืมรหัสผ่านใช้ **Supabase recovery email** แล้ว ไม่รีเซ็ตรหัสผ่านเป็นวันเกิดอีกต่อไป
- โปรเจกต์ใหม่ควรตั้งค่า **Site URL / Redirect URLs** ใน Supabase Auth ให้ชี้กลับมายังเว็บแอป
- ผู้ให้บริการอีเมลเริ่มต้นของ Supabase จำกัดอีเมล auth ประมาณ 2 ฉบับต่อชั่วโมง และ endpoint recovery มี cooldown ต่อผู้ใช้
- ถ้าใช้งานจริง ควรตั้ง **custom SMTP** และตรวจค่าใน **Authentication > Rate Limits**

## Web Version

เวอร์ชันเบราว์เซอร์ใช้ UI และ game logic ร่วมกับ desktop (`src/hub/`, `src/shared/`) แต่ไม่มี pet overlay บนจอ / global input / system tray

```bash
npm run dev:web    # http://localhost:5174
npm run build:web  # output → dist-web/
npm run test       # unit tests (Vitest)
```

ใช้ env เดียวกัน (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — login แล้ว sync DB เหมือน desktop

**ความต่างจาก desktop:**

| Desktop | Web |
|---|---|
| นับคลิก/พิมพ์ทั้งเครื่อง (หลัง login) | นับเฉพาะในหน้าเว็บ |
| สัตว์เลี้ยงลอยบนจอ + system tray | Hub UI เท่านั้น |
| ก่อน login: ไข่ + tray ไม่โชว์สถิติ | ไม่มี pet overlay |
| เก็บ offline ใน `pet-save.json` | เก็บ offline ใน `localStorage` |

**Deploy:** [web/DEPLOY.md](web/DEPLOY.md) — production อยู่ที่ Vercel (auto deploy จาก `main`)

## Build (Desktop)

Requires **Node.js 24+**. Use the system Node binary if nvm shims conflict with npm.

```bash
npm install
npm run build
# Windows installer
set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:win
# macOS (on Mac only)
npm run build:mac
```

Output: `dist/Taskino Setup 0.1.0.exe` (Windows) or `.dmg` (macOS).

Installer อ่าน Supabase จาก `resources/.env` (bundle จาก `.env.production` ตอน build)

## Demo Milestones

- **Demo 1 (Jul 20):** Offline core — pet on desktop, egg, growth, stats, items, missions, save/load
- **Demo 2 (Aug 7):** Online — auth ✅, friends, battle rooms + async PvP ✅, chat ✅, profile sync ✅
- **หลัง Demo 2:** RPG stats / skills / growth cards / breeding, combat HUD, home focus mode

## macOS Note

Global input tracking requires **Accessibility** permission in System Settings.

## Project Structure

- `electron/main/` — Main process, windows, tray, activity tracker, Supabase
- `src/hub/` — Hub UI (React)
- `src/hub/LoginGate.tsx` — Login / sign up / forgot password (pixel theme)
- `src/hub/PixelCoverShell.tsx` — Shared pixel cover layout (auth + Get Started)
- `src/hub/GetStarted.tsx` — Post-login onboarding (pixel theme)
- `src/hub/HomeDashboard.tsx` — Home scene HUD (missions, status, quickbar, level-up)
- `src/hub/HubSidebar.tsx` / `HubTopBar.tsx` — เมนูซ้าย + แถบสถิติบน
- `src/components/CombatStatCheck.tsx` — แผง STR/DEX/INT/CON + derived
- `src/components/GrowthLevelUpModal.tsx` — ป๊อปอัปเลเวลอัพ (การ์ด + สกิล)
- `src/components/PetLoadoutPanel.tsx` — สกิล / growth บน detail
- `src/components/AuthEggSprite.tsx` — Animated egg sprite for auth screens
- `src/hub/battle/` — ห้องต่อสู้, สนามดวล, ประวัติ, guard ออกจากห้อง
- `src/pet/` — Desktop pet canvas renderer
- `src/shared/` — Game logic shared across processes
- `src/shared/combatStats.ts` — Primaries, growth cards, derived combat
- `src/shared/elements.ts` — ธาตุ, effectiveness, `FORCE_PURE_ELEMENTS`
- `src/shared/battle/` — Battle engine, skill trees, damage, rewards, mappers
- `src/styles.css` — Global styles + `.pixel-cover` / `.pixel-hub` / home HUD
- `web/` — Vite config สำหรับเวอร์ชันเบราว์เซอร์
- `assets/creatures/` — Runtime creature animation strips
- `assets/creature-prototypes/` — Static generation masters and QC artifacts
- `assets/ui/` — Logo, HUD icons, item icons
- `supabase/migrations/` — SQL schema + RLS + battle / breed RPCs (ถึง `045`)

## Credits

- **Fonts:** [Mali](https://fonts.google.com/specimen/Mali), [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (Google Fonts)
