# Home animated element backgrounds — pipeline v5

## สิ่งที่เปลี่ยนจาก v4

| v4 (เก่า) | v5 (ใหม่) |
|-----------|-----------|
| Gen เป็น **2×2 sheet** แล้ว split | Gen **ทีละเฟรมเต็มจอ** 16:9 |
| Auto **shift + mirror-pad** หา stand | **ไม่ shift** — prompt lock พื้นยืน |
| Upscale cell เล็ก → เบลอ | Cover-crop เข้า 1672×941 |
| Process ทั้ง 9 บังคับ | **ทีละธาตุ** (`--element fire`) |

## Layout work

```text
assets/ui/home-bg-work/{element}/
  raw-0.png … raw-3.png     # mode A: 4 AI frames
  # OR
  raw-0.png + motion.txt    # mode B: master + locked particles (recommended for continuity)
  THEME.md
```

### motion.txt modes (geometry locked)

`snow_down` · `embers_up` · `sparks_up` · `bubbles_up` · `arcane_up` · `shadow_up` · `pollen_left` · `sand_right` · `leaves_left`

## Runtime output

```text
assets/ui/home-bg/{element}/frame-0..3.png
assets/ui/home-bg/manifest.json   # schema v5, merge ต่อธาตุ
```

## Commands

```bash
py scripts/home_bg_pipeline.py --init fire
# drop raw-0..3.png into assets/ui/home-bg-work/fire/
py scripts/home_bg_pipeline.py --element fire
npm run home-bg:process   # --all when every element is ready
```

## Contract

| Field | Value |
|-------|-------|
| Frame | 1672 × 941 |
| Stand | center X, y=790 (~84% — disc center, not back rim) |
| Frames | 4 ambient loop |
| Color | RGB 24-bit |
| Continuity | stand-band drift ≤ 12px |

## Gen tips

1. Generate **frame 0** first (best composition).
2. Generate 1–3 with frame 0 as visual reference: same camera, same stand, only ambient motion.
3. One motion story per element (embers up / leaves left / snow down).
4. Never put four panels in one image.
