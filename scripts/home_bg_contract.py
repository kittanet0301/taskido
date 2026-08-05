"""Home hub animated backgrounds — contract v5.

Gen unit = one full 16:9 frame (not a 2×2 sheet).
Pipeline only normalizes + QC; it does not invent stand geometry via shift.
"""

from __future__ import annotations

from pathlib import Path

# Runtime frame size (matches hub layout / dashSceneLayout).
FRAME_W = 1672
FRAME_H = 941

# Pet feet / stand disc center (same for every element).
# Higher Y = lower on a circular platform (not the back rim).
STAND_X = 836
STAND_Y = 790
EGG_Y = 780
STAND_Y_FRAC = STAND_Y / FRAME_H  # ~0.839

ELEMENTS = (
    'neutral',
    'fire',
    'grass',
    'ground',
    'electric',
    'water',
    'ice',
    'dragon',
    'dark',
)

FRAME_COUNT = 4
FRAME_MS = 650

# Continuity QC: max stand-band Y spread across the 4 raw frames (pixels at FRAME size).
MAX_STAND_DRIFT_PX = 12

# Stand detector band (fraction of frame height).
STAND_SEARCH_Y_MIN = 0.66
STAND_SEARCH_Y_MAX = 0.82
STAND_PROBE_HALF_W = 64

SCHEMA = 'taskino.home-bg-manifest.v5'
EXPORT_COLOR_MODE = 'rgb24'

REPO_ROOT = Path(__file__).resolve().parent.parent
WORK_DIR = REPO_ROOT / 'assets' / 'ui' / 'home-bg-work'
OUTPUT_DIR = REPO_ROOT / 'assets' / 'ui' / 'home-bg'
MANIFEST_PATH = OUTPUT_DIR / 'manifest.json'


def work_element_dir(element: str) -> Path:
    return WORK_DIR / element


def raw_frame_path(element: str, index: int) -> Path:
    return work_element_dir(element) / f'raw-{index}.png'


def output_frame_path(element: str, index: int) -> Path:
    return OUTPUT_DIR / element / f'frame-{index}.png'


def web_frame_path(element: str, index: int) -> str:
    return f'/ui/home-bg/{element}/frame-{index}.png'
