#!/usr/bin/env python3
"""Creature sprite sheet cropper — cell inset + largest-component extraction."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image

from creature_chroma import remove_bg_chroma, resolve_chroma_key
from creature_pixel import resize_to, scale_content

SKILL_DIRS = [
    Path.home() / ".agents" / "skills" / "generate2dsprite" / "scripts",
    Path.home() / ".codex" / "skills" / "generate2dsprite" / "scripts",
]
for skill_dir in SKILL_DIRS:
    if (skill_dir / "generate2dsprite.py").exists():
        sys.path.insert(0, str(skill_dir))
        break

from generate2dsprite import (  # noqa: E402
    clean_edges,
    compose_sheet,
    connected_components,
    pad_bbox,
    save_transparent_gif,
    trim_border,
)

DEFAULTS = {
    "cell_inset_ratio": 0.03,
    "cell_inset_min": 10,
    "trim_border": 6,
    "edge_clean_depth": 2,
    "min_component_area": 96,
    "component_padding": 2,
    "component_mode": "largest",
    "fit_scale": 0.85,
    "threshold": 100,
    "edge_threshold": 150,
    "chroma_key": "green",
}


def cell_inset_px(cell_w: int, cell_h: int, *, ratio: float, minimum: int) -> int:
    return max(minimum, int(min(cell_w, cell_h) * ratio))


def inset_box(
    outer: tuple[int, int, int, int],
    inset: int,
) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = outer
    inner = (x0 + inset, y0 + inset, x1 - inset, y1 - inset)
    if inner[2] - inner[0] < 8 or inner[3] - inner[1] < 8:
        return outer
    return inner


def bbox_touches_edge(
    bbox: tuple[int, int, int, int] | None,
    width: int,
    height: int,
    margin: int,
) -> bool:
    if not bbox:
        return False
    x0, y0, x1, y1 = bbox
    return x0 <= margin or y0 <= margin or x1 >= width - margin or y1 >= height - margin


def extract_subject(
    cell: Image.Image,
    *,
    trim_border_px: int,
    edge_clean_depth: int,
    component_mode: str,
    component_padding: int,
    min_component_area: int,
) -> tuple[Image.Image, dict[str, object]]:
    frame = cell
    if trim_border_px > 0:
        frame = trim_border(frame, px=trim_border_px)
    if edge_clean_depth > 0:
        frame = clean_edges(frame, depth=edge_clean_depth)

    components = connected_components(frame, min_area=min_component_area)
    bbox = None
    selected = None
    if component_mode == "largest" and components:
        selected = components[0]
        bbox = pad_bbox(tuple(selected["bbox"]), component_padding, frame.width, frame.height)
    else:
        bbox = frame.getbbox()

    if bbox:
        frame = frame.crop(bbox)

    info = {
        "component_mode": component_mode,
        "component_count": len(components),
        "selected_component_area": int(selected["area"]) if selected else None,
        "selected_component_bbox": list(selected["bbox"]) if selected else None,
        "crop_bbox": list(bbox) if bbox else None,
        "edge_touch": bbox_touches_edge(bbox, cell.width, cell.height, 2),
    }
    return frame, info


def split_creature_grid(
    img: Image.Image,
    rows: int,
    cols: int,
    cell_size: int,
    *,
    cell_inset_ratio: float = DEFAULTS["cell_inset_ratio"],
    cell_inset_min: int = DEFAULTS["cell_inset_min"],
    threshold: int = DEFAULTS["threshold"],
    edge_threshold: int = DEFAULTS["edge_threshold"],
    fit_scale: float = DEFAULTS["fit_scale"],
    trim_border_px: int = DEFAULTS["trim_border"],
    edge_clean_depth: int = DEFAULTS["edge_clean_depth"],
    align: str = "center",
    baseline_y: int | None = None,
    preserve_cell_position: bool = False,
    shared_scale: bool = False,
    component_mode: str = DEFAULTS["component_mode"],
    component_padding: int = DEFAULTS["component_padding"],
    min_component_area: int = DEFAULTS["min_component_area"],
    chroma_key: str = DEFAULTS["chroma_key"],
) -> tuple[list[Image.Image], list[dict[str, object]]]:
    key = resolve_chroma_key(chroma_key)
    cleaned = remove_bg_chroma(img.convert("RGBA"), key, threshold, edge_threshold)
    width, height = cleaned.size
    cell_w, cell_h = width // cols, height // rows
    inset = cell_inset_px(cell_w, cell_h, ratio=cell_inset_ratio, minimum=cell_inset_min)

    cropped_frames: list[Image.Image] = []
    frame_info: list[dict[str, object]] = []

    for row in range(rows):
        for col in range(cols):
            outer = (col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)
            if preserve_cell_position:
                cell = cleaned.crop(outer)
                # Generation references can cause thin grid/separator strokes at
                # cell boundaries. Preserve the authored in-cell trajectory, but
                # clear only the requested outer border band before resizing so
                # those guide pixels cannot become part of the alpha subject.
                border = min(trim_border_px, cell.width // 2, cell.height // 2)
                if border > 0:
                    alpha = cell.getchannel("A")
                    alpha.paste(0, (0, 0, cell.width, border))
                    alpha.paste(0, (0, cell.height - border, cell.width, cell.height))
                    alpha.paste(0, (0, 0, border, cell.height))
                    alpha.paste(0, (cell.width - border, 0, cell.width, cell.height))
                    cell.putalpha(alpha)
                source_bbox = cell.getbbox()
                frame = cell.resize((cell_size, cell_size), Image.Resampling.NEAREST)
                output_bbox = frame.getbbox()
                cropped_frames.append(frame)
                frame_info.append(
                    {
                        "grid": [row, col],
                        "outer_box": list(outer),
                        "inner_box": list(outer),
                        "cell_inset_px": 0,
                        "component_mode": "all",
                        "component_count": None,
                        "selected_component_area": None,
                        "selected_component_bbox": None,
                        "crop_bbox": list(source_bbox) if source_bbox else None,
                        "edge_touch": bbox_touches_edge(source_bbox, cell.width, cell.height, 2),
                        "output_size": (
                            [output_bbox[2] - output_bbox[0], output_bbox[3] - output_bbox[1]]
                            if output_bbox
                            else [0, 0]
                        ),
                        "paste_position": list(output_bbox[:2]) if output_bbox else [0, 0],
                        "position_preserved": True,
                    }
                )
                continue
            inner = inset_box(outer, inset)
            cell = cleaned.crop(inner)
            subject, info = extract_subject(
                cell,
                trim_border_px=trim_border_px,
                edge_clean_depth=edge_clean_depth,
                component_mode=component_mode,
                component_padding=component_padding,
                min_component_area=min_component_area,
            )
            cropped_frames.append(subject)
            frame_info.append(
                {
                    "grid": [row, col],
                    "outer_box": list(outer),
                    "inner_box": list(inner),
                    "cell_inset_px": inset,
                    **info,
                }
            )

    if preserve_cell_position:
        return cropped_frames, frame_info

    common_scale = None
    if shared_scale:
        max_w = max((f.size[0] for f in cropped_frames), default=0)
        max_h = max((f.size[1] for f in cropped_frames), default=0)
        if max_w > 0 and max_h > 0:
            common_scale = min(cell_size / max_w, cell_size / max_h) * fit_scale

    frames: list[Image.Image] = []
    for index, subject in enumerate(cropped_frames):
        fw, fh = subject.size
        canvas = Image.new("RGBA", (cell_size, cell_size), (0, 0, 0, 0))
        if fw > 0 and fh > 0:
            scale = common_scale or (min(cell_size / fw, cell_size / fh) * fit_scale)
            subject = scale_content(subject, scale)
            nw, nh = subject.size
            paste_x = (cell_size - nw) // 2
            if align in {"bottom", "feet"}:
                if baseline_y is not None:
                    paste_y = baseline_y - nh + 1
                else:
                    pad = max(0, int(cell_size * (1 - fit_scale) * 0.5))
                    paste_y = cell_size - nh - pad
            else:
                paste_y = (cell_size - nh) // 2
            canvas.paste(subject, (paste_x, paste_y))
            frame_info[index]["output_size"] = [nw, nh]
            frame_info[index]["paste_position"] = [paste_x, paste_y]
        else:
            frame_info[index]["output_size"] = [0, 0]
            frame_info[index]["paste_position"] = [0, 0]
        frames.append(canvas)

    return frames, frame_info


def extract_cell_frame(
    raw_sheet: Image.Image,
    row: int,
    col: int,
    rows: int,
    cols: int,
    *,
    cell_size: int = 128,
    align: str = "feet",
    **kwargs,
) -> Image.Image:
    """Extract one grid cell from a raw sheet as a feet-aligned frame."""
    frames, _ = split_creature_grid(
        raw_sheet,
        rows,
        cols,
        cell_size,
        align=align,
        shared_scale=kwargs.pop("shared_scale", False),
        **kwargs,
    )
    index = row * cols + col
    return frames[index]


def process_sheet(args: argparse.Namespace) -> None:
    out_dir = args.output_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = Image.open(args.input).convert("RGBA")
    raw.save(out_dir / "raw-sheet.png")
    key = resolve_chroma_key(args.chroma_key)
    cleaned = remove_bg_chroma(raw.copy(), key, args.threshold, args.edge_threshold)
    cleaned.save(out_dir / "raw-sheet-clean.png")

    frames, frame_qc = split_creature_grid(
        raw,
        args.rows,
        args.cols,
        args.cell_size,
        cell_inset_ratio=args.cell_inset_ratio,
        cell_inset_min=args.cell_inset_min,
        threshold=args.threshold,
        edge_threshold=args.edge_threshold,
        fit_scale=args.fit_scale,
        trim_border_px=args.trim_border,
        edge_clean_depth=args.edge_clean_depth,
        align=args.align,
        baseline_y=args.baseline_y,
        preserve_cell_position=args.preserve_cell_position,
        shared_scale=args.shared_scale,
        component_mode=args.component_mode,
        component_padding=args.component_padding,
        min_component_area=args.min_component_area,
        chroma_key=args.chroma_key,
    )

    prefix = args.label_prefix
    labels = [f"{prefix}-{i + 1}" for i in range(args.rows * args.cols)]
    for label, frame in zip(labels, frames):
        frame.save(out_dir / f"{label}.png")

    compose_sheet(frames, args.rows, args.cols, args.cell_size).save(out_dir / "sheet-transparent.png")
    save_transparent_gif(frames, out_dir / "animation.gif", args.duration)

    metadata = {
        "target": "creature",
        "input": str(args.input),
        "rows": args.rows,
        "cols": args.cols,
        "cell_size": args.cell_size,
        "cell_inset_ratio": args.cell_inset_ratio,
        "cell_inset_min": args.cell_inset_min,
        "fit_scale": args.fit_scale,
        "trim_border": args.trim_border,
        "edge_clean_depth": args.edge_clean_depth,
        "align": args.align,
        "baseline_y": args.baseline_y,
        "preserve_cell_position": args.preserve_cell_position,
        "shared_scale": args.shared_scale,
        "component_mode": args.component_mode,
        "component_padding": args.component_padding,
        "min_component_area": args.min_component_area,
        "chroma_key": args.chroma_key,
        "frame_labels": labels,
        "frames": frame_qc,
        "edge_touch_frames": [info["grid"] for info in frame_qc if info.get("edge_touch")],
    }
    (out_dir / "pipeline-meta.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--rows", required=True, type=int)
    parser.add_argument("--cols", required=True, type=int)
    parser.add_argument("--cell-size", required=True, type=int)
    parser.add_argument("--label-prefix", required=True)
    parser.add_argument("--cell-inset-ratio", type=float, default=DEFAULTS["cell_inset_ratio"])
    parser.add_argument("--cell-inset-min", type=int, default=DEFAULTS["cell_inset_min"])
    parser.add_argument("--threshold", type=int, default=DEFAULTS["threshold"])
    parser.add_argument("--edge-threshold", type=int, default=DEFAULTS["edge_threshold"])
    parser.add_argument(
        "--chroma-key",
        choices=["magenta", "green"],
        default=DEFAULTS["chroma_key"],
        help="Background color to key out (default: green)",
    )
    parser.add_argument("--fit-scale", type=float, default=DEFAULTS["fit_scale"])
    parser.add_argument("--trim-border", type=int, default=DEFAULTS["trim_border"])
    parser.add_argument("--edge-clean-depth", type=int, default=DEFAULTS["edge_clean_depth"])
    parser.add_argument("--align", choices=["center", "bottom", "feet"], default="feet")
    parser.add_argument(
        "--baseline-y",
        type=int,
        help="Optional zero-based output row for grounded feet/bottom alignment.",
    )
    parser.add_argument(
        "--preserve-cell-position",
        action="store_true",
        help="Resize each complete source cell without recentering its subject.",
    )
    parser.add_argument("--shared-scale", action="store_true")
    parser.add_argument("--component-mode", choices=["all", "largest"], default=DEFAULTS["component_mode"])
    parser.add_argument("--component-padding", type=int, default=DEFAULTS["component_padding"])
    parser.add_argument("--min-component-area", type=int, default=DEFAULTS["min_component_area"])
    parser.add_argument("--duration", type=int, default=200)
    process_sheet(parser.parse_args())


if __name__ == "__main__":
    main()
