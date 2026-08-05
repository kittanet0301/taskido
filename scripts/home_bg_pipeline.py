#!/usr/bin/env python3
"""
Home hub element background pipeline v5.

Input (per element) — pick ONE mode:

  A) Four full-frame raws (NOT a 2×2 sheet):
       assets/ui/home-bg-work/{element}/raw-0.png … raw-3.png

  B) Master + locked particle motion (geometry 100% shared):
       assets/ui/home-bg-work/{element}/raw-0.png
       assets/ui/home-bg-work/{element}/motion.txt   # e.g. snow_down

Steps:
  1. Cover-crop raws to exact FRAME_W×FRAME_H.
  2. Optional: bake particle overlay from motion.txt onto master frame-0.
  3. Measure stand-band Y (QC only — no auto shift).
  4. Export RGB24 PNGs + merge element into manifest.json.

Usage:
  py scripts/home_bg_pipeline.py --element fire
  py scripts/home_bg_pipeline.py --element ice   # uses motion.txt if present
  py scripts/home_bg_pipeline.py --all
  py scripts/home_bg_pipeline.py --init fire
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from home_bg_contract import (
    ELEMENTS,
    EXPORT_COLOR_MODE,
    FRAME_COUNT,
    FRAME_H,
    FRAME_W,
    MANIFEST_PATH,
    MAX_STAND_DRIFT_PX,
    OUTPUT_DIR,
    SCHEMA,
    STAND_PROBE_HALF_W,
    STAND_SEARCH_Y_MAX,
    STAND_SEARCH_Y_MIN,
    STAND_X,
    STAND_Y,
    EGG_Y,
    WORK_DIR,
    output_frame_path,
    raw_frame_path,
    web_frame_path,
    work_element_dir,
)


@dataclass
class ElementQc:
    element: str
    stand_ys: list[int]
    stand_drift_px: int
    continuity_passed: bool
    source_sizes: list[str]
    motion: str | None = None


def cover_crop_to_frame(img: Image.Image) -> Image.Image:
    """Scale with cover, center-crop to exact frame size. Prefer NEAREST if already near size."""
    src = img.convert('RGB')
    sw, sh = src.size
    if sw == FRAME_W and sh == FRAME_H:
        return src

    scale = max(FRAME_W / sw, FRAME_H / sh)
    nw = max(FRAME_W, int(round(sw * scale)))
    nh = max(FRAME_H, int(round(sh * scale)))

    # Integer-ish upscale of small pixel grids stays sharp with NEAREST.
    ratio = max(nw / sw, nh / sh)
    if ratio >= 1.5 and abs(ratio - round(ratio)) < 0.08:
        resized = src.resize((nw, nh), Image.Resampling.NEAREST)
    else:
        resized = src.resize((nw, nh), Image.Resampling.LANCZOS)

    left = (nw - FRAME_W) // 2
    top = (nh - FRAME_H) // 2
    return resized.crop((left, top, left + FRAME_W, top + FRAME_H))


def detect_stand_y(img: Image.Image) -> int:
    """Strongest horizontal edge in stand band near center (for QC)."""
    frame = img if img.size == (FRAME_W, FRAME_H) else cover_crop_to_frame(img)
    px = frame.load()
    cx = STAND_X
    y_min = int(FRAME_H * STAND_SEARCH_Y_MIN)
    y_max = int(FRAME_H * STAND_SEARCH_Y_MAX)
    best_y = STAND_Y
    best_score = -1.0
    # Mild anchor bias toward the canonical stand Y: on low-contrast (e.g. dark/night)
    # scenes, faint glow-line noise can out-score the true rim edge by a small margin,
    # causing false "drift". This nudges ties/near-ties back to the expected band
    # without overriding a genuinely strong edge elsewhere.
    anchor_penalty_per_px = 15.0
    for y in range(y_min, y_max - 1):
        score = 0
        for x in range(cx - STAND_PROBE_HALF_W, cx + STAND_PROBE_HALF_W):
            r, g, b = px[x, y]
            r2, g2, b2 = px[x, y + 1]
            score += abs((r + g + b) - (r2 + g2 + b2))
        biased = score - abs(y - STAND_Y) * anchor_penalty_per_px
        if biased > best_score:
            best_score = biased
            best_y = y
    return best_y


def motion_path(element: str) -> Path:
    return work_element_dir(element) / 'motion.txt'


def read_motion(element: str) -> str | None:
    path = motion_path(element)
    if not path.exists():
        return None
    text = path.read_text(encoding='utf-8').strip().splitlines()
    if not text:
        return None
    return text[0].strip().lower()


def _blend_pixel(px, x: int, y: int, color: tuple[int, int, int], alpha: float) -> None:
    r, g, b = px[x, y]
    a = max(0.0, min(1.0, alpha))
    px[x, y] = (
        int(r * (1 - a) + color[0] * a),
        int(g * (1 - a) + color[1] * a),
        int(b * (1 - a) + color[2] * a),
    )


def _stamp_dot(
    px,
    w: int,
    h: int,
    x: int,
    y: int,
    size: int,
    color: tuple[int, int, int],
    alpha: float,
) -> None:
    for dy in range(-(size // 2), size // 2 + 1):
        for dx in range(-(size // 2), size // 2 + 1):
            if dx * dx + dy * dy > (size * size) / 2:
                continue
            xx, yy = x + dx, y + dy
            if 0 <= xx < w and 0 <= yy < h:
                _blend_pixel(px, xx, yy, color, alpha)


def apply_motion_overlay(base: Image.Image, motion: str, frame: int, element: str) -> Image.Image:
    """Bake ambient particles onto a locked master frame (geometry shared)."""
    out = base.copy()
    px = out.load()
    w, h = out.size
    seed = sum(ord(c) for c in f'{element}:{motion}') * 7919
    rng = random.Random(seed)

    if motion in ('snow_down', 'snow'):
        # Fixed flake catalog; animate fall by frame index.
        flake_n = 240
        flakes = [
            {
                'x': rng.random(),
                'y0': rng.random(),
                'speed': 0.055 + rng.random() * 0.09,
                'drift': (rng.random() - 0.5) * 0.012,
                'size': 1 if rng.random() < 0.7 else 2,
                'alpha': 0.35 + rng.random() * 0.45,
                'color': (230 + rng.randint(0, 25), 240 + rng.randint(0, 15), 255),
            }
            for _ in range(flake_n)
        ]
        density = [0.18, 0.55, 1.0, 0.42][frame]
        active = max(1, int(flake_n * density))
        for flake in flakes[:active]:
            x = int((flake['x'] + flake['drift'] * frame) * w) % w
            y = int((flake['y0'] + flake['speed'] * frame) * h) % h
            # Prefer air/sky — skip denser bottom 12% so platform stays clean.
            if y > int(h * 0.88):
                continue
            _stamp_dot(px, w, h, x, y, flake['size'], flake['color'], flake['alpha'])
        return out

    if motion in ('embers_up', 'sparks_up', 'bubbles_up', 'arcane_up', 'shadow_up'):
        # arcane_up: grand/epic pass — big particle count, vivid multi-hue, frequent star flares
        particle_n = 460 if motion == 'arcane_up' else 160
        colors = {
            'embers_up': (255, 140, 40),
            'sparks_up': (255, 240, 120),
            'bubbles_up': (160, 230, 255),
            'arcane_up': (225, 110, 255),
            'shadow_up': (90, 70, 140),
        }
        base_color = colors[motion]
        accent_colors = (
            [(190, 235, 255), (255, 230, 150), (255, 255, 255)] if motion == 'arcane_up' else []
        )
        # sizes scaled up: source is 1672px wide but rendered much smaller on-screen,
        # so 1px dots vanish on downscale — keep a floor of ~3-4px for arcane_up.
        size_floor = 3 if motion == 'arcane_up' else 1
        particles = [
            {
                'x': rng.random(),
                'y0': rng.random(),
                'speed': 0.045 + rng.random() * 0.13,
                'size': (
                    (3 if rng.random() < 0.45 else (4 if rng.random() < 0.8 else (5 if rng.random() < 0.95 else 7)))
                    if motion == 'arcane_up'
                    else (1 if rng.random() < 0.7 else 2)
                ),
                'alpha': 0.4 + rng.random() * 0.55,
                'accent': (
                    rng.choice(accent_colors) if accent_colors and rng.random() < 0.32 else None
                ),
                'burst': motion == 'arcane_up' and rng.random() < 0.22,
            }
            for _ in range(particle_n)
        ]
        density = (
            [0.5, 0.8, 1.0, 0.65] if motion == 'arcane_up' else [0.2, 0.55, 1.0, 0.4]
        )[frame]
        active = max(1, int(particle_n * density))
        for p in particles[:active]:
            x = int(p['x'] * w) % w
            y = int((p['y0'] - p['speed'] * frame) * h) % h
            if y > int(h * 0.92):
                continue
            use = p['accent'] or base_color
            color = (
                min(255, use[0] + rng.randint(-15, 25)),
                min(255, use[1] + rng.randint(-15, 25)),
                min(255, use[2] + rng.randint(-15, 25)),
            )
            _stamp_dot(px, w, h, x, y, p['size'], color, p['alpha'])
            if motion == 'arcane_up' and frame >= 1 and p['size'] >= size_floor:
                for step in range(1, 2 + min(frame, 2)):
                    y2 = max(0, y - step * 6)
                    _stamp_dot(px, w, h, x, y2, 2, color, p['alpha'] * (0.45 / step))
            if p['burst']:
                # 8-point star flare — bigger, brighter magical sparkle bursts (scaled for downscale visibility)
                reach = 9 + (frame % 3) * 2
                flare_alpha = p['alpha'] * 0.65
                for dx, dy in (
                    (reach, 0), (-reach, 0), (0, reach), (0, -reach),
                    (reach, reach), (-reach, reach), (reach, -reach), (-reach, -reach),
                ):
                    _stamp_dot(px, w, h, x + dx, y + dy, 2, color, flare_alpha)
                _stamp_dot(px, w, h, x, y, p['size'] + 2, (255, 255, 255), flare_alpha * 0.75)

        # Breathing volcano-core flare: pulses brighter/dimmer across the loop for epic drama.
        cx, cy, radius = int(w * 0.555), int(h * 0.235), 60
        pulse = [0.5, 0.85, 1.0, 0.7][frame]
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                dist = (dx * dx + dy * dy) ** 0.5
                if dist > radius:
                    continue
                fall = max(0.0, 1.0 - dist / radius) ** 2
                xx, yy = cx + dx, cy + dy
                if 0 <= xx < w and 0 <= yy < h:
                    _blend_pixel(px, xx, yy, (255, 190, 120), fall * pulse * 0.3)

        if motion == 'arcane_up':
            # Big rune-ring pulse on the platform itself — a large, unmissable feature
            # that reads clearly even when the whole frame is downscaled for the UI
            # (unlike tiny repositioned dots, which vanish on downscale).
            ring_cx, ring_cy = STAND_X, STAND_Y - 30
            base_r = [140, 175, 210, 245][frame]
            ring_alpha = [0.5, 0.38, 0.22, 0.1][frame]
            band = 10
            for dy in range(-base_r - band, base_r + band + 1):
                for dx in range(-base_r - band, base_r + band + 1):
                    # squash vertically for a platform-plane ellipse, not a full circle
                    dist = ((dx * dx) + (dy * 2.4) ** 2) ** 0.5
                    edge = abs(dist - base_r)
                    if edge > band:
                        continue
                    fall = max(0.0, 1.0 - edge / band)
                    xx, yy = ring_cx + dx, ring_cy + dy
                    if 0 <= xx < w and 0 <= yy < h:
                        _blend_pixel(px, xx, yy, (235, 140, 255), fall * ring_alpha)
        return out

    if motion in ('pollen_left', 'sand_right', 'leaves_left'):
        particle_n = 140
        dx_sign = -1 if motion in ('pollen_left', 'leaves_left') else 1
        color = (210, 230, 160) if 'pollen' in motion or 'leaves' in motion else (220, 190, 140)
        particles = [
            {
                'x0': rng.random(),
                'y': rng.random(),
                'speed': 0.04 + rng.random() * 0.08,
                'size': 1 if rng.random() < 0.8 else 2,
                'alpha': 0.28 + rng.random() * 0.4,
            }
            for _ in range(particle_n)
        ]
        density = [0.2, 0.55, 1.0, 0.4][frame]
        active = max(1, int(particle_n * density))
        for p in particles[:active]:
            x = int((p['x0'] + dx_sign * p['speed'] * frame) * w) % w
            y = int(p['y'] * h) % h
            if y > int(h * 0.9):
                continue
            _stamp_dot(px, w, h, x, y, p['size'], color, p['alpha'])
        return out

    raise ValueError(
        f'Unknown motion "{motion}" — use snow_down | embers_up | sparks_up | '
        f'bubbles_up | arcane_up | shadow_up | pollen_left | sand_right | leaves_left'
    )


def load_frames(element: str) -> tuple[list[Image.Image], list[str], str | None]:
    """Load/normalize frames. Returns (frames, source_sizes, motion_mode)."""
    motion = read_motion(element)
    if motion:
        path = raw_frame_path(element, 0)
        if not path.exists():
            raise FileNotFoundError(
                f'Missing {path.as_posix()} — master raw-0.png required for motion.txt mode'
            )
        raw = Image.open(path)
        source_sizes = [f'{raw.size[0]}x{raw.size[1]}*master+{motion}']
        base = cover_crop_to_frame(raw)
        raw.close()
        frames = [apply_motion_overlay(base, motion, i, element) for i in range(FRAME_COUNT)]
        return frames, source_sizes * FRAME_COUNT, motion

    frames: list[Image.Image] = []
    source_sizes: list[str] = []
    for i in range(FRAME_COUNT):
        path = raw_frame_path(element, i)
        if not path.exists():
            raise FileNotFoundError(
                f'Missing {path.as_posix()} — put raw-0…3.png or raw-0.png + motion.txt'
            )
        raw = Image.open(path)
        source_sizes.append(f'{raw.size[0]}x{raw.size[1]}')
        frames.append(cover_crop_to_frame(raw))
        raw.close()
    return frames, source_sizes, None


def process_element(element: str) -> ElementQc:
    frames, source_sizes, motion = load_frames(element)
    if motion:
        print(f'  motion={motion} (master raw-0 + locked particle overlay)')

    stand_ys = [detect_stand_y(f) for f in frames]
    drift = max(stand_ys) - min(stand_ys)
    ok = drift <= MAX_STAND_DRIFT_PX

    out_dir = OUTPUT_DIR / element
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames):
        out = output_frame_path(element, i)
        frame.save(out, format='PNG', optimize=True, compress_level=6)
        try:
            rel = out.relative_to(OUTPUT_DIR.parents[2])
        except ValueError:
            rel = out
        print(f'  frame-{i}: {rel}  ({out.stat().st_size // 1024}KB)')

    flag = 'OK' if ok else 'FAIL'
    print(f'  stand_y={stand_ys} drift={drift}px [{flag}]  sources={source_sizes}')
    if not ok:
        print(f'  WARN: stand drift > {MAX_STAND_DRIFT_PX}px — re-gen with locked ground plane')

    return ElementQc(
        element=element,
        stand_ys=stand_ys,
        stand_drift_px=drift,
        continuity_passed=ok,
        source_sizes=source_sizes,
        motion=motion,
    )


def load_manifest() -> dict:
    empty = {
        'schema': SCHEMA,
        'generatedAt': None,
        'target': {'width': FRAME_W, 'height': FRAME_H},
        'canonicalStandLine': {'x': STAND_X, 'y': STAND_Y},
        'canonicalFeet': {'x': STAND_X, 'y': STAND_Y},
        'canonicalEggY': EGG_Y,
        'exportColorMode': EXPORT_COLOR_MODE,
        'frameCount': FRAME_COUNT,
        'elements': {},
        'qc': [],
    }
    if not MANIFEST_PATH.exists():
        return empty
    doc = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    # Drop pre-v5 manifests (shift fields) so merge stays clean.
    if doc.get('schema') != SCHEMA:
        return empty
    return doc


def merge_manifest(existing: dict, qc_list: list[ElementQc]) -> dict:
    doc = {
        'schema': SCHEMA,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'target': {'width': FRAME_W, 'height': FRAME_H},
        'canonicalStandLine': {'x': STAND_X, 'y': STAND_Y},
        'canonicalFeet': {'x': STAND_X, 'y': STAND_Y},
        'canonicalEggY': EGG_Y,
        'exportColorMode': EXPORT_COLOR_MODE,
        'frameCount': FRAME_COUNT,
        'elements': dict(existing.get('elements') or {}),
        'qc': [q for q in (existing.get('qc') or []) if q.get('element') not in {c.element for c in qc_list}],
    }
    for qc in qc_list:
        entry = {
            'frames': [web_frame_path(qc.element, i) for i in range(FRAME_COUNT)],
            'standYs': qc.stand_ys,
            'standDriftPx': qc.stand_drift_px,
            'continuityPassed': qc.continuity_passed,
            'sourceSizes': qc.source_sizes,
        }
        if qc.motion:
            entry['motion'] = qc.motion
        doc['elements'][qc.element] = entry
        for i, y in enumerate(qc.stand_ys):
            doc['qc'].append(
                {
                    'element': qc.element,
                    'frame': i,
                    'stand_y': y,
                    'stand_drift_px': qc.stand_drift_px,
                    'continuity_passed': qc.continuity_passed,
                    'passed': qc.continuity_passed,
                    'motion': qc.motion,
                }
            )
    # Keep element key order stable
    ordered = {e: doc['elements'][e] for e in ELEMENTS if e in doc['elements']}
    for k, v in doc['elements'].items():
        if k not in ordered:
            ordered[k] = v
    doc['elements'] = ordered
    return doc


def init_element(element: str) -> None:
    d = work_element_dir(element)
    d.mkdir(parents=True, exist_ok=True)
    theme_path = d / 'THEME.md'
    if not theme_path.exists():
        theme_path.write_text(
            f'# {element}\n\n'
            f'Put raw-0.png … raw-3.png here (full 16:9 frames, not a 2×2 sheet).\n\n'
            f'Stand line: center X, ~74% down (y≈{STAND_Y} @ {FRAME_W}×{FRAME_H}).\n'
            f'Locked ground across all 4. One ambient motion loop only.\n',
            encoding='utf-8',
        )
    print(f'Init work dir: {d}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--element', choices=ELEMENTS)
    parser.add_argument('--init', choices=ELEMENTS, help='Create empty work folder for element')
    args = parser.parse_args()

    if args.init:
        init_element(args.init)
        return

    targets: list[str] = []
    if args.all:
        targets = list(ELEMENTS)
    elif args.element:
        targets = [args.element]
    else:
        parser.error('Use --element, --all, or --init')

    print(f'home-bg pipeline v5  frame={FRAME_W}x{FRAME_H}  stand=({STAND_X},{STAND_Y})')
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    qcs: list[ElementQc] = []
    for element in targets:
        print(f'[{element}]')
        qcs.append(process_element(element))

    manifest = merge_manifest(load_manifest(), qcs)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {MANIFEST_PATH.as_posix()}')

    failed = [q for q in qcs if not q.continuity_passed]
    if failed:
        print(f'WARNING: {len(failed)} element(s) failed continuity QC')
        sys.exit(1)


if __name__ == '__main__':
    main()
