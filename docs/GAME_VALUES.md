# ค่าต่างๆ ในเกม Taskino

> เอกสารอ้างอิงค่าคงที่และสูตรจาก source code — อัปเดตล่าสุด: ส.ค. 2026  
> ไฟล์ต้นทางหลัก: `src/shared/constants.ts`, `combatStats.ts`, `elements.ts`, `missions.ts`, `market.ts`, `battle/`

---

## สถานะดูแล (Care Stats)

| ค่า | ช่วง | คำอธิบาย |
|---|---|---|
| **Health** | 0–100 | สุขภาพ — ต่ำกว่า 30 = ป่วย |
| **Emotion** | 0–100 | อารมณ์ — ≥70 happy, ≥40 neutral, <40 sad |
| **Evolution** | 0–999 | ความก้าวหน้าเติบโต |

**ค่าเริ่มต้น (ไข่ใหม่):** Health 100, Emotion 80, Evolution 0

### Decay เมื่อไม่ได้เล่น

| ค่า | อัตราลด / ชั่วโมง |
|---|---|
| Emotion | −2 |
| Health | −0.5 |

---

## Evolution & การเติบโต

| ค่าคงที่ | ค่า | หมายเหตุ |
|---|---:|---|
| `DEV_POINTS_HATCH` | 100 | Evolution ขั้นต่ำเพื่อฟักไข่ |
| `DEV_POINTS_ADULT` | 500 | Evolution ขั้นต่ำเพื่อเป็นผู้ใหญ่ |
| `ADULT_MIN_HOURS` | 48 | ชั่วโมงหลังฟักก่อน evolve เป็น adult |
| `CLICKS_PER_DEV` | 100 | คลิกต่อ +1 Evolution |
| `KEYS_PER_DEV` | 500 | ปุ่มที่กดต่อ +1 Evolution |
| `MAX_DEV_PER_HOUR` | 10 | Evolution สูงสุดจาก activity / ชั่วโมง |
| `BREED_COOLDOWN_MS` | 6 ชม. | Cooldown ผสมพันธุ์ต่อตัว |
| `BREED_PURE_BONUS` | +5% | โบนัส pure element ตอนผสม (พ่อแม่ pure ธาตุเดียวกัน) |

**Game Speed (Admin):** ค่าข้างต้นหาร/คูณด้วย multiplier (1, 4, 8, 16, 32, 64) — ดู `src/shared/gameSpeed.ts`

### Activity Score

```text
Activity Score = clicks + floor(keystrokes / 10)
```

### Level

| Stage | สูตร Level |
|---|---|
| Egg | `1 + floor(evolution / DEV_POINTS_HATCH)` |
| Baby | `2 + floor(evolution / 80)` |
| Adult | `5 + floor(evolution / 40)` |

**รางวัลเมื่อ Level ขึ้น (baby/adult):**
- +1 Skill Upgrade Point ต่อ level
- Growth Card offers 3 ใบต่อ level (เลือกได้ 1)

---

## ไอเท็ม

| Item | Emotion | Health | Evolution | อื่นๆ |
|---|---:|---:|---:|---|
| `food_basic` | +15 | — | — | |
| `food_premium` | +30 | +10 | — | |
| `water` | +10 | +5 | — | |
| `medicine` | — | +40 | — | |
| `toy` | +25 | — | — | |
| `dev_vitamin` | — | — | +50 | |
| `battle_shield` | — | — | — | ลดดาเมจ 50% ใน battle (item action) |
| `breed_nest` | — | — | — | ใช้ผสมพันธุ์ 1 ครั้ง |
| `skill_forget` | — | — | — | reroll สกิล 1 ช่อง → rank 1 |

**ไอเท็มเริ่มต้น:** food_basic ×2, water ×2, medicine ×1  
**Quick Item Slots:** 6 ช่อง (`QUICK_ITEM_SLOT_COUNT`)

---

## Collection & Save

| ค่า | ค่า |
|---|---:|
| `SAVE_VERSION` | 7 |
| `PET_SLOT_BASE` | 5 |
| `PET_SLOT_MAX` | 36 |
| `PET_SLOTS_PER_PAGE` | 12 |
| `WEEKLY_SLOT_REWARD` | +5 ช่อง (mission) |

---

## Gems & Market

| แหล่ง Gems | จำนวน |
|---|---:|
| รับ Daily Mission | +5 |
| รับ Weekly Mission | +15 |
| Bot Battle (easy) | +4 |
| Bot Battle (normal) | +7 |
| Bot Battle (hard) | +12 |

### ราคา Market (Gems)

| สินค้า | ราคา |
|---|---:|
| ไข่สุ่ม | 25 |
| ช่อง Collection +1 | 12 |
| ช่อง Collection +5 | 50 |
| food_basic | 2 |
| water | 2 |
| medicine | 3 |
| toy | 3 |
| food_premium | 5 |
| battle_shield | 8 |
| skill_forget | 12 |
| breed_nest | 15 |
| Care Bundle | 8 |

**Care Bundle:** food_basic ×3, water ×2, medicine ×1

---

## Missions

### Daily

| ID | เป้าหมาย | รางวัล |
|---|---|---|
| `daily_type_500` | พิมพ์ 500 ครั้ง | food_basic ×1 |
| `daily_click_200` | คลิก 200 ครั้ง | toy ×1 |
| `daily_feed_3` | ให้อาหาร 3 ครั้ง | Emotion +10 |
| `daily_play_1h` | เล่น 3,600 วินาที | Evolution +5 |

### Weekly

| ID | เป้าหมาย | รางวัล |
|---|---|---|
| `weekly_dev_100` | Evolution จาก activity 100 | breed_nest ×1 |
| `weekly_daily_5` | รับ daily ใน 5 วัน | skill_forget ×1 |
| `weekly_hatch_1` | ฟักไข่ 1 ฟอง | ไข่ใหม่ |
| `weekly_slots_5` | ทำ daily 5 วัน | ช่อง +5 |
| `weekly_egg_1` | Evolution สะสม 50 | ไข่ใหม่ |
| `weekly_battle_win_3` | ชนะ battle 3 ครั้ง | battle_shield ×1 |

**Reset:** Daily = เที่ยงคืนท้องถิ่น, Weekly = วันจันทร์เที่ยงคืน

---

## Minigames

| เกม | Score threshold | รางวัล / วัน / เกม |
|---|---:|---:|
| Dino Jump | 1,000 | 3 ไอเทม |
| Rock Dodge | 100 | 3 ไอเทม |

**Reward pool:** food_basic, water, medicine, toy (สุ่ม 1 ชิ้น)

---

## ธาตุ (Elements)

### ตารางแพ้/เก่ง

| ธาตุ | แรงกว่า (SE) |
|---|---|
| fire | grass, ice |
| grass | ground |
| ground | electric |
| electric | water |
| water | fire |
| ice | dragon |
| dragon | dark |
| dark | neutral |
| neutral | — |

### ตัวคูณ

| สถานการณ์ | ตัวคูณ |
|---|---:|
| Super Effective (SE) | ×1.5 |
| Resist (อ่อนกว่าทั้ง 2 ช่อง) | ×0.75 |
| Pure damage bonus | ×1.25 |
| Neutral / ไม่มี advantage | ×1.0 |

| ค่าคงที่ | ค่า | หมายเหตุ |
|---|---:|---|
| `PURE_CHANCE` | 60% | โอกาส pure (dual 40%) |
| `FORCE_PURE_ELEMENTS` | `true` | บังคับ pure ชั่วคราว |
| `BATTLE_HEALTH_MIN` | 30 | Health ขั้นต่ำเข้า battle |
| `BATTLE_EMOTION_MIN` | 30 | Emotion ขั้นต่ำเข้า battle |

---

## Primary Stats ตามธาตุ (ตอนฟัก)

| ธาตุ | STR | DEX | INT | CON | รวม |
|---:|---:|---:|---:|---:|---:|
| fire | 28 | 18 | 20 | 14 | 80 |
| grass | 16 | 18 | 22 | 24 | 80 |
| ground | 22 | 12 | 14 | 32 | 80 |
| electric | 18 | 30 | 22 | 10 | 80 |
| water | 18 | 20 | 24 | 18 | 80 |
| ice | 16 | 16 | 28 | 20 | 80 |
| dragon | 26 | 16 | 18 | 20 | 80 |
| dark | 20 | 24 | 22 | 14 | 80 |
| neutral | 20 | 20 | 20 | 20 | 80 |

**Dual element:** เฉลี่ย primary + secondary ± noise(−1/0/+1) ต่อ stat

---

## Derived Combat Stats

```text
Max HP  = 40 + CON × 5
Max MP  = INT × 10
ATK     = STR
DEF     = CON
EVA     = clamp(0.05 + DEX × 0.003, 0.05, 0.35)
```

---

## Growth Cards

| ID | ผล | Weight |
|---|---|---:|
| `power_up` | STR +3 | 3 |
| `swift` | DEX +3 | 3 |
| `focus` | INT +3 | 3 |
| `tough` | CON +3 | 3 |
| `bruiser` | STR +2, CON +1 | 2 |
| `magelet` | INT +2, DEX +1 | 2 |
| `all_round` | STR/DEX/INT/CON +1 | 1 |

สุ่ม 3 ใบไม่ซ้ำเมื่อ level up

---

## สกิล (Skills)

| ค่า | ค่า |
|---|---|
| `SKILL_RANK_MAX` | 8 |
| Rank multiplier | `0.85 + rank × 0.15` |
| Ultimate TP cost | 100 |
| Loadout | 3 skills + 1 ultimate (สุ่มตอนฟัก) |

### Power / MP ตาม Role

| Role | Power | MP |
|---|---:|---:|
| basic | 18 | 8 |
| heavy | 26 | 14 |
| pierce | 20 | 12 |
| burst | 28 | 16 |
| guard | 0 | 10 |
| dodge | 0 | 8 |
| support | 0 | 12 |
| mark | 12 | 10 |
| ultimate | 40 | 0 (ใช้ TP) |

### Ultimate ตามธาตุ

| ธาตุ | Ultimate |
|---|---|
| fire | solar_eruption |
| grass | overgrowth |
| ground | terra_break |
| electric | storm_crown |
| water | abyss_roar |
| ice | absolute_zero |
| dragon | elder_wrath |
| dark | eclipse_fang |
| neutral | finishing_blow |

---

## Battle

### การกระทำ

| Action | รายละเอียด |
|---|---|
| **Attack** | Power 20, ใช้ STR, สะสม TP 15–30 |
| **Skill** | ใช้ MP ตาม skill, สะสม TP 10–25 |
| **Defend** | ลดดาเมจ ×0.5, สะสม TP 10–20 |
| **Item** | health_potion (+90 HP) / mana_potion (+60 MP) / battle_shield |
| **Flee** | จบดวล, Emotion −3 |

### สูตรดาเมจ

```text
damage = round(power × (atkStat / max(defenderDef, 1)) × elemMult × pureBonus × randomFactor)
```

| พารามิเตอร์ | ค่า |
|---|---|
| `BASE_ATTACK_POWER` | 20 |
| Attack stat | STR |
| Skill stat | round((STR + INT) / 2) |
| `randomFactor` | 0.9 – 1.1 |
| `DEFEND_REDUCTION` | ×0.5 |
| `SHIELD_ITEM_REDUCTION` | ×0.5 (ซ้อน defend ได้) |

### TP (Technique Points)

| ค่า | ค่า |
|---|---:|
| `TP_MAX` | 100 |
| Attack gain | 15–30 |
| Skill gain | 10–25 |
| Defend gain | 10–20 |

### รางวัล/โทษหลัง Battle

| ผล | ผลกระทบ |
|---|---|
| ชนะ | Emotion +5 |
| หนี | Emotion −3 |
| แพ้ | Health ไม่ลด (REWARD_LOSE_HP = 0) |

### Bot Battle

| ความยาก | Waves | Stat scale | Gems | Evolution | Drop chance |
|---|---:|---:|---:|---:|---:|
| easy | 2 | 0.82 | 4 | 2 | 25% |
| normal | 3 | 1.00 | 7 | 4 | 40% |
| hard | 4 | 1.18 | 12 | 7 | 60% |

**Drop pool:** battle_shield, food_premium, dev_vitamin, skill_forget  
**Consumables ใน bot battle:** health_potion ×3, mana_potion ×3 (session-only)

### ห้องต่อสู้

| ค่า | ค่า |
|---|---:|
| `ROOM_MAX_MEMBERS` | 8 |
| `ROOM_IDLE_MINUTES` | 30 |
| `CHALLENGE_EXPIRE_DAYS` | 7 |
| `BATTLE_MIN_HP` (session) | 10 |

---

## Breeding

| เงื่อนไข | รายละเอียด |
|---|---|
| Stage | Adult ทั้งคู่ |
| เพศ | คนละเพศ |
| Item | breed_nest ×1 |
| ช่อง | Collection ว่าง ≥1 |
| Cooldown | 6 ชม. / ตัว |
| Species ลูก | 50/50 จากพ่อหรือแม่ |
| ธาตุลูก | ตาม species (pure, fixed element) |

---

## เอกสารที่เกี่ยวข้อง

| เอกสาร | เนื้อหา |
|---|---|
| [GAME_GUIDE_TH.md](./GAME_GUIDE_TH.md) | คู่มือผู้เล่น (ภาษาไทย) |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | สรุปโปรเจกต์ repo |
| [README.md](../README.md) | Quick start & build |
