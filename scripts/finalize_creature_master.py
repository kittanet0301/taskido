#!/usr/bin/env python3
"""Finalize and validate static Taskino creature masters.

Raw artwork must be generated externally on a solid magenta background. This
processor only removes the chroma key, keeps the main connected subject,
nearest-neighbor scales it into a fixed canvas, aligns the feet baseline, and
writes deterministic QC metadata.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from creature_chroma import remove_bg_chroma, resolve_chroma_key


ELEMENT_ORDER = [
    "neutral",
    "fire",
    "grass",
    "ground",
    "electric",
    "water",
    "ice",
    "dragon",
    "dark",
]


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def keep_largest_component(image: Image.Image) -> tuple[Image.Image, int, int]:
    rgba = np.asarray(image.convert("RGBA")).copy()
    mask = rgba[:, :, 3] > 0
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[list[tuple[int, int]]] = []

    for start_y, start_x in zip(*np.where(mask & ~visited)):
        if visited[start_y, start_x]:
            continue
        queue: deque[tuple[int, int]] = deque([(int(start_x), int(start_y))])
        visited[start_y, start_x] = True
        component: list[tuple[int, int]] = []
        while queue:
            x, y = queue.popleft()
            component.append((x, y))
            for dx, dy in ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        components.append(component)

    if not components:
        raise ValueError("No visible subject remains after chroma-key removal.")

    components.sort(key=len, reverse=True)
    keep = components[0]
    keep_mask = np.zeros_like(mask)
    for x, y in keep:
        keep_mask[y, x] = True
    rgba[~keep_mask] = (0, 0, 0, 0)
    return Image.fromarray(rgba, "RGBA"), len(keep), max(0, len(components) - 1)


def count_magenta_fringe(image: Image.Image, distance: int = 95) -> int:
    rgba = np.asarray(image.convert("RGBA"))
    opaque = rgba[:, :, 3] > 0
    rgb = rgba[:, :, :3].astype(np.int32)
    key = np.array([255, 0, 255], dtype=np.int32)
    squared = np.sum((rgb - key) ** 2, axis=2)
    return int(np.count_nonzero(opaque & (squared < distance * distance)))


def finalize(
    raw_path: Path,
    normalized_raw_path: Path | None,
    output_path: Path,
    qc_path: Path,
    *,
    element: str,
    canvas: int,
    envelope: float,
    bottom_padding: int,
    threshold: int,
    edge_threshold: int,
) -> dict[str, object]:
    source = Image.open(raw_path).convert("RGBA")
    source_size = source.size
    if normalized_raw_path is not None:
        raw = source.resize((1024, 1024), Image.Resampling.NEAREST)
        normalized_raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw.save(normalized_raw_path)
        effective_raw_path = normalized_raw_path
    else:
        raw = source
        effective_raw_path = raw_path
    raw_size = raw.size
    cleaned = remove_bg_chroma(
        raw.copy(),
        resolve_chroma_key("magenta"),
        threshold,
        edge_threshold,
    )
    cleaned, component_pixels, removed_components = keep_largest_component(cleaned)
    bbox = alpha_bbox(cleaned)
    if bbox is None:
        raise ValueError(f"No subject found in {raw_path}")

    subject = cleaned.crop(bbox)
    max_subject = max(1, int(round(canvas * envelope)))
    scale = min(max_subject / subject.width, max_subject / subject.height)
    scaled_size = (
        max(1, int(round(subject.width * scale))),
        max(1, int(round(subject.height * scale))),
    )
    subject = subject.resize(scaled_size, Image.Resampling.NEAREST)

    output = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = (canvas - subject.width) // 2
    y = canvas - bottom_padding - subject.height
    if y < 0:
        raise ValueError("Configured subject envelope does not fit above the feet baseline.")
    output.alpha_composite(subject, (x, y))

    output_bbox = alpha_bbox(output)
    assert output_bbox is not None
    left, top, right, bottom = output_bbox
    margins = {
        "left": left,
        "top": top,
        "right": canvas - right,
        "bottom": canvas - bottom,
    }
    corners_transparent = all(
        output.getpixel(point)[3] == 0
        for point in ((0, 0), (canvas - 1, 0), (0, canvas - 1), (canvas - 1, canvas - 1))
    )
    edge_touch = min(margins.values()) <= 0
    magenta_fringe_pixels = count_magenta_fringe(output)

    qc = {
        "element": element,
        "source_path": str(raw_path),
        "source_size": list(source_size),
        "raw_path": str(effective_raw_path),
        "output_path": str(output_path),
        "raw_size": list(raw_size),
        "canvas_size": [canvas, canvas],
        "mode": "RGBA",
        "resize_filter": "nearest",
        "alignment": "feet",
        "envelope_ratio": envelope,
        "feet_baseline_y": bottom - 1,
        "subject_bbox": [left, top, right, bottom],
        "subject_size": [right - left, bottom - top],
        "margins": margins,
        "subject_alpha_pixels_before_scale": component_pixels,
        "removed_detached_components": removed_components,
        "magenta_fringe_pixels": magenta_fringe_pixels,
        "transparent_corners": corners_transparent,
        "edge_touch": edge_touch,
        "passed": bool(corners_transparent and not edge_touch and magenta_fringe_pixels == 0),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(output_path)
    qc_path.parent.mkdir(parents=True, exist_ok=True)
    qc_path.write_text(json.dumps(qc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return qc


def create_contact_sheet(root: Path, output_path: Path, scale: int = 2, stage: str = "baby") -> None:
    tile = 192
    label_height = 28
    gap = 12
    columns = 3
    rows = 3
    width = columns * tile + (columns + 1) * gap
    height = rows * (tile + label_height) + (rows + 1) * gap
    sheet = Image.new("RGBA", (width, height), (24, 27, 34, 255))
    draw = ImageDraw.Draw(sheet)

    for index, element in enumerate(ELEMENT_ORDER):
        master_path = root / element / f"master-{stage}.png"
        if not master_path.exists():
            raise FileNotFoundError(f"Missing master: {master_path}")
        master = Image.open(master_path).convert("RGBA")
        if master.size != (tile, tile):
            raise ValueError(f"{master_path} is {master.size}, expected {(tile, tile)}")
        column = index % columns
        row = index // columns
        x = gap + column * (tile + gap)
        y = gap + row * (tile + label_height + gap)
        checker = Image.new("RGBA", (tile, tile), (46, 50, 61, 255))
        checker_draw = ImageDraw.Draw(checker)
        checker_size = 12
        for cy in range(0, tile, checker_size):
            for cx in range(0, tile, checker_size):
                if (cx // checker_size + cy // checker_size) % 2:
                    checker_draw.rectangle(
                        (cx, cy, cx + checker_size - 1, cy + checker_size - 1),
                        fill=(56, 61, 74, 255),
                    )
        sheet.alpha_composite(checker, (x, y))
        sheet.alpha_composite(master, (x, y))
        draw.text((x + 4, y + tile + 5), element.upper(), fill=(238, 241, 247, 255))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if scale > 1:
        sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.Resampling.NEAREST)
    sheet.convert("RGB").save(output_path, quality=95)


def validate_bundle(root: Path, stage: str = "baby") -> dict[str, object]:
    entries: dict[str, object] = {}
    baselines: list[int] = []
    all_passed = True
    for element in ELEMENT_ORDER:
        master_path = root / element / f"master-{stage}.png"
        qc_filename = {
            "baby": "qc.json",
            "egg": "qc-egg.json",
            "adult": "qc-adult.json",
        }[stage]
        qc_path = root / element / qc_filename
        if not master_path.exists():
            entries[element] = {"passed": False, "error": f"missing master-{stage}.png"}
            all_passed = False
            continue
        image = Image.open(master_path).convert("RGBA")
        if stage != "adult":
            if not qc_path.exists():
                entries[element] = {"passed": False, "error": f"missing {qc_filename}"}
                all_passed = False
                continue
            qc = json.loads(qc_path.read_text(encoding="utf-8"))
        else:
            bbox = alpha_bbox(image)
            if bbox is None:
                entries[element] = {"passed": False, "error": "adult master has no visible subject"}
                all_passed = False
                continue
            left, top, right, bottom = bbox
            margins = {
                "left": left,
                "top": top,
                "right": image.width - right,
                "bottom": image.height - bottom,
            }
            fringe = count_magenta_fringe(image)
            qc = {
                "element": element,
                "stage": "adult",
                "source_path": str(root / element / "source-original-adult.png"),
                "output_path": str(master_path),
                "canvas_size": list(image.size),
                "mode": image.mode,
                "resize_filter": "nearest",
                "alignment": "feet",
                "feet_baseline_y": bottom - 1,
                "subject_bbox": [left, top, right, bottom],
                "subject_size": [right - left, bottom - top],
                "margins": margins,
                "magenta_fringe_pixels": fringe,
                "transparent_corners": all(
                    image.getpixel(point)[3] == 0
                    for point in (
                        (0, 0),
                        (image.width - 1, 0),
                        (0, image.height - 1),
                        (image.width - 1, image.height - 1),
                    )
                ),
                "edge_touch": min(margins.values()) <= 0,
            }
            qc["passed"] = bool(
                qc["transparent_corners"] and not qc["edge_touch"] and fringe == 0
            )
            qc_path.write_text(
                json.dumps(qc, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        passed = bool(
            image.size == (192, 192)
            and image.mode == "RGBA"
            and qc.get("passed")
            and not qc.get("edge_touch")
            and qc.get("magenta_fringe_pixels") == 0
        )
        entries[element] = {
            "passed": passed,
            "size": list(image.size),
            "mode": image.mode,
            "feet_baseline_y": qc.get("feet_baseline_y"),
        }
        all_passed = all_passed and passed
        if isinstance(qc.get("feet_baseline_y"), int):
            baselines.append(qc["feet_baseline_y"])

    summary = {
        "stage": stage,
        "passed": bool(all_passed and len(baselines) == len(ELEMENT_ORDER) and len(set(baselines)) == 1),
        "expected_elements": ELEMENT_ORDER,
        "shared_feet_baseline": baselines[0] if baselines and len(set(baselines)) == 1 else None,
        "entries": entries,
    }
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    finalize_parser = subparsers.add_parser("finalize", help="Finalize one generated creature master.")
    finalize_parser.add_argument("--raw", required=True, type=Path)
    finalize_parser.add_argument(
        "--normalized-raw",
        type=Path,
        help="Optional 1024x1024 nearest-neighbor raw copy retained beside the source.",
    )
    finalize_parser.add_argument("--output", required=True, type=Path)
    finalize_parser.add_argument("--qc", required=True, type=Path)
    finalize_parser.add_argument("--element", required=True, choices=ELEMENT_ORDER)
    finalize_parser.add_argument("--canvas", type=int, default=192)
    finalize_parser.add_argument("--envelope", type=float, default=0.72)
    finalize_parser.add_argument("--bottom-padding", type=int, default=18)
    finalize_parser.add_argument("--threshold", type=int, default=150)
    finalize_parser.add_argument("--edge-threshold", type=int, default=210)

    contact_parser = subparsers.add_parser("contact-sheet", help="Compose the nine accepted masters.")
    contact_parser.add_argument("--root", required=True, type=Path)
    contact_parser.add_argument("--output", required=True, type=Path)
    contact_parser.add_argument("--scale", type=int, default=2)
    contact_parser.add_argument("--stage", choices=["egg", "baby", "adult"], default="baby")

    validate_parser = subparsers.add_parser("validate", help="Validate all nine prototype masters.")
    validate_parser.add_argument("--root", required=True, type=Path)
    validate_parser.add_argument("--output", type=Path)
    validate_parser.add_argument("--stage", choices=["egg", "baby", "adult"], default="baby")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "finalize":
        result = finalize(
            args.raw,
            args.normalized_raw,
            args.output,
            args.qc,
            element=args.element,
            canvas=args.canvas,
            envelope=args.envelope,
            bottom_padding=args.bottom_padding,
            threshold=args.threshold,
            edge_threshold=args.edge_threshold,
        )
    elif args.command == "contact-sheet":
        create_contact_sheet(args.root, args.output, args.scale, args.stage)
        result = {"passed": True, "output": str(args.output)}
    else:
        result = validate_bundle(args.root, args.stage)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("passed"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
