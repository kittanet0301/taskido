#!/usr/bin/env python3
"""Finalize creature egg hatch: egg frames match move, dino frames keep full silhouette."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

SKILL_DIRS = [
    Path.home() / ".agents" / "skills" / "generate2dsprite" / "scripts",
    Path.home() / ".codex" / "skills" / "generate2dsprite" / "scripts",
]
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
for skill_dir in SKILL_DIRS:
    if (skill_dir / "generate2dsprite.py").exists():
        sys.path.insert(0, str(skill_dir))
        break

from creature_pixel import scale_content
from creature_sheet_crop import (  # noqa: E402
    DEFAULTS,
    compose_sheet,
    extract_cell_frame,
    save_transparent_gif,
)

# Match scripts/creature-manifest.mjs PROCESS_CELL_SIZE + CROP_SETTINGS.
PROCESS_CELL_SIZE = 192


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    return im.convert("RGBA").getchannel("A").getbbox()


def extract_content(im: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    bbox = content_bbox(im)
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0)), (0, 0, 1, 1)
    return im.crop(bbox), bbox


def paste_feet_aligned(canvas: Image.Image, content: Image.Image, feet_y: int) -> None:
    x = (canvas.width - content.width) // 2
    y = feet_y - content.height
    canvas.paste(content, (x, y), content)


def paste_feet_aligned_fit(
    canvas: Image.Image,
    content: Image.Image,
    feet_y: int,
    *,
    pad: int,
) -> None:
    x = max(pad, min((canvas.width - content.width) // 2, canvas.width - pad - content.width))
    y = feet_y - content.height
    canvas.paste(content, (x, y), content)


def clamp_scale_to_canvas(
    contents: list[Image.Image],
    scale: float,
    canvas_size: tuple[int, int],
    *,
    pad: int,
) -> float:
    max_w = canvas_size[0] - pad * 2
    max_h = canvas_size[1] - pad * 2
    peak_w = 0.0
    peak_h = 0.0
    for content in contents:
        peak_w = max(peak_w, content.width * scale)
        peak_h = max(peak_h, content.height * scale)
    if peak_w <= 0 or peak_h <= 0:
        return scale
    fit = min(max_w / peak_w, max_h / peak_h, 1.0)
    return scale * fit


def compose_feet_frame(content: Image.Image, ref_im: Image.Image, *, pad: int) -> Image.Image:
    _, ref_bbox = extract_content(ref_im)
    ref_feet_y = ref_bbox[3]
    canvas = Image.new("RGBA", ref_im.size, (0, 0, 0, 0))
    paste_feet_aligned_fit(canvas, content, ref_feet_y, pad=pad)
    return canvas


def fit_content_to_reference(content: Image.Image, ref_im: Image.Image, *, pad: int = 4) -> Image.Image:
    _, ref_bbox = extract_content(ref_im)
    ref_w = ref_bbox[2] - ref_bbox[0]
    ref_h = ref_bbox[3] - ref_bbox[1]
    ref_feet_y = ref_bbox[3]
    scale = min(ref_w / content.width, ref_h / content.height)
    scaled = scale_content(content, scale)

    max_w = ref_im.width - pad * 2
    max_h = ref_im.height - pad * 2
    if scaled.width > max_w or scaled.height > max_h:
        fit = min(max_w / scaled.width, max_h / scaled.height)
        scaled = scale_content(scaled, fit)

    canvas = Image.new("RGBA", ref_im.size, (0, 0, 0, 0))
    paste_feet_aligned(canvas, scaled, ref_feet_y)
    return canvas


def process_raw_cell(
    raw_sheet: Image.Image,
    row: int,
    col: int,
    rows: int,
    cols: int,
    *,
    component_mode: str = "largest",
    chroma_key: str = "green",
) -> Image.Image:
    return extract_cell_frame(
        raw_sheet,
        row,
        col,
        rows,
        cols,
        cell_size=PROCESS_CELL_SIZE,
        align="feet",
        component_mode=component_mode,
        fit_scale=DEFAULTS["fit_scale"],
        cell_inset_ratio=DEFAULTS["cell_inset_ratio"],
        cell_inset_min=DEFAULTS["cell_inset_min"],
        trim_border_px=DEFAULTS["trim_border"],
        edge_clean_depth=DEFAULTS["edge_clean_depth"],
        component_padding=DEFAULTS["component_padding"],
        min_component_area=DEFAULTS["min_component_area"],
        threshold=DEFAULTS["threshold"],
        edge_threshold=DEFAULTS["edge_threshold"],
        chroma_key=chroma_key,
        shared_scale=True,
    )


def finalize_hatch(
    raw_sheet_path: Path,
    processed_dir: Path,
    move_reference: Path,
    prefix: str,
    *,
    rows: int = 2,
    cols: int = 3,
    egg_frames: int = 3,
    egg_pad: int = 4,
    dino_pad: int = 12,
    chroma_key: str = "green",
    baby_reference: Path | None = None,
) -> list[Image.Image]:
    ref_im = Image.open(move_reference).convert("RGBA")
    raw_sheet = Image.open(raw_sheet_path).convert("RGBA")

    # Scale dino frames from raw egg cell — avoids bleed from processed split_grid frames.
    first_egg_cell = process_raw_cell(
        raw_sheet, 0, 0, rows, cols, component_mode="largest", chroma_key=chroma_key
    )
    _, first_egg_bbox = extract_content(first_egg_cell)
    _, ref_bbox = extract_content(ref_im)
    egg_h = max(1, first_egg_bbox[3] - first_egg_bbox[1])
    ref_h = ref_bbox[3] - ref_bbox[1]
    dino_uniform_scale = ref_h / egg_h

    dino_contents: list[Image.Image] = []
    for index in range(egg_frames + 1, rows * cols + 1):
        row, col = divmod(index - 1, cols)
        dino_cell = process_raw_cell(
            raw_sheet, row, col, rows, cols, component_mode="largest", chroma_key=chroma_key
        )
        content, _ = extract_content(dino_cell)
        dino_contents.append(content)
    dino_scale = clamp_scale_to_canvas(dino_contents, dino_uniform_scale, ref_im.size, pad=dino_pad)

    out: list[Image.Image] = []
    for index in range(1, egg_frames + 1):
        row, col = divmod(index - 1, cols)
        egg_frame = process_raw_cell(
            raw_sheet, row, col, rows, cols, component_mode="largest", chroma_key=chroma_key
        )
        egg_content, _ = extract_content(egg_frame)
        out.append(fit_content_to_reference(egg_content, ref_im, pad=egg_pad))

    for content in dino_contents:
        scaled = scale_content(content, dino_scale)
        out.append(compose_feet_frame(scaled, ref_im, pad=dino_pad))

    if baby_reference is not None:
        baby = Image.open(baby_reference).convert("RGBA")
        baby_content, _ = extract_content(baby)
        out[-1] = compose_feet_frame(baby_content, ref_im, pad=dino_pad)

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-sheet", required=True, type=Path)
    parser.add_argument("--processed-dir", required=True, type=Path)
    parser.add_argument("--move-reference", required=True, type=Path)
    parser.add_argument("--prefix", default="hatch")
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--cols", type=int, default=3)
    parser.add_argument("--egg-frames", type=int, default=3)
    parser.add_argument("--in-place", action="store_true")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--chroma-key", choices=["green", "magenta"], default="green")
    parser.add_argument("--baby-reference", type=Path)
    parser.add_argument("--duration", type=int, default=120)
    args = parser.parse_args()

    frames = finalize_hatch(
        args.raw_sheet,
        args.processed_dir,
        args.move_reference,
        args.prefix,
        rows=args.rows,
        cols=args.cols,
        egg_frames=args.egg_frames,
        chroma_key=args.chroma_key,
        baby_reference=args.baby_reference,
    )

    if args.in_place and args.output_dir is not None:
        output_dir = args.output_dir
    elif args.in_place:
        output_dir = args.processed_dir
    else:
        output_dir = args.output_dir
    if output_dir is None:
        raise SystemExit("Provide --in-place or --output-dir")

    output_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames, start=1):
        target = output_dir / f"{args.prefix}-{index}.png"
        frame.save(target)
        print(f"Wrote {target}")
    compose_sheet(frames, 2, 3, PROCESS_CELL_SIZE).save(output_dir / "sheet-transparent.png")
    save_transparent_gif(frames, output_dir / "animation.gif", args.duration)


if __name__ == "__main__":
    main()
