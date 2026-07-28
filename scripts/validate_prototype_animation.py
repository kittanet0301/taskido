#!/usr/bin/env python3
"""Validate a Taskino prototype animation produced by the creature pipeline."""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

import numpy as np
from PIL import Image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def magenta_pixels(image: Image.Image, distance: int = 95) -> int:
    rgba = np.asarray(image.convert("RGBA"))
    opaque = rgba[:, :, 3] > 0
    rgb = rgba[:, :, :3].astype(np.int32)
    key = np.array([255, 0, 255], dtype=np.int32)
    return int(np.count_nonzero(opaque & (np.sum((rgb - key) ** 2, axis=2) < distance**2)))


def content_signature(image: Image.Image) -> tuple[tuple[int, int], bytes] | None:
    bbox = alpha_bbox(image)
    if bbox is None:
        return None
    crop = image.convert("RGBA").crop(bbox)
    return crop.size, crop.tobytes()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--frames", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--identity-reference", type=Path)
    parser.add_argument("--scale-reference", type=Path)
    parser.add_argument("--max-reference-scale-drift", type=float, default=0.15)
    parser.add_argument("--playback", choices=["loop", "one-shot"], default="loop")
    parser.add_argument("--baseline-mode", choices=["shared", "variable"], default="shared")
    parser.add_argument("--min-baseline-span", type=int, default=0)
    args = parser.parse_args()

    entries: list[dict[str, object]] = []
    bottoms: list[int] = []
    heights: list[int] = []
    widths: list[int] = []
    all_passed = True
    images: list[Image.Image] = []

    for index in range(1, args.frames + 1):
        path = args.input_dir / f"{args.prefix}-{index}.png"
        if not path.exists():
            entries.append({"frame": index, "passed": False, "error": "missing"})
            all_passed = False
            continue
        image = Image.open(path).convert("RGBA")
        images.append(image)
        bbox = alpha_bbox(image)
        if bbox is None:
            entries.append({"frame": index, "passed": False, "error": "empty"})
            all_passed = False
            continue
        left, top, right, bottom = bbox
        margins = {
            "left": left,
            "top": top,
            "right": image.width - right,
            "bottom": image.height - bottom,
        }
        fringe = magenta_pixels(image)
        passed = bool(
            image.size == (192, 192)
            and min(margins.values()) > 0
            and fringe == 0
        )
        entries.append(
            {
                "frame": index,
                "passed": passed,
                "size": list(image.size),
                "bbox": list(bbox),
                "margins": margins,
                "baseline_y": bottom - 1,
                "magenta_fringe_pixels": fringe,
            }
        )
        bottoms.append(bottom - 1)
        heights.append(bottom - top)
        widths.append(right - left)
        all_passed = all_passed and passed

    shared_baseline = bottoms[0] if bottoms and len(set(bottoms)) == 1 else None
    baseline_span = max(bottoms) - min(bottoms) if bottoms else None
    ground_return_delta = abs(bottoms[0] - bottoms[-1]) if len(bottoms) > 1 else None
    height_cv = (
        statistics.pstdev(heights) / statistics.mean(heights)
        if len(heights) > 1 and statistics.mean(heights) > 0
        else 0.0
    )
    loop_identity_match = None
    if args.playback == "loop" and len(images) == args.frames and images:
        loop_identity_match = content_signature(images[0]) == content_signature(images[-1])

    final_identity_match = None
    if args.identity_reference and images:
        reference = Image.open(args.identity_reference).convert("RGBA")
        final_identity_match = content_signature(images[-1]) == content_signature(reference)
        all_passed = all_passed and final_identity_match

    reference_scale_drift = None
    reference_scale_passed = None
    if args.scale_reference and widths and heights:
        reference = Image.open(args.scale_reference).convert("RGBA")
        reference_bbox = alpha_bbox(reference)
        if reference_bbox is None:
            reference_scale_passed = False
            all_passed = False
        else:
            ref_width = reference_bbox[2] - reference_bbox[0]
            ref_height = reference_bbox[3] - reference_bbox[1]
            width_drift = abs(statistics.mean(widths) / ref_width - 1.0)
            height_drift = abs(statistics.mean(heights) / ref_height - 1.0)
            reference_scale_drift = max(width_drift, height_drift)
            reference_scale_passed = reference_scale_drift <= args.max_reference_scale_drift
            all_passed = all_passed and reference_scale_passed

    result = {
        "passed": bool(
            all_passed
            and (
                shared_baseline is not None
                if args.baseline_mode == "shared"
                else baseline_span is not None
                and baseline_span >= args.min_baseline_span
            )
        ),
        "input_dir": str(args.input_dir),
        "prefix": args.prefix,
        "playback": args.playback,
        "baseline_mode": args.baseline_mode,
        "frame_count": len(entries),
        "shared_baseline_y": shared_baseline,
        "baseline_span": baseline_span,
        "ground_return_delta": ground_return_delta,
        "body_height_cv": round(height_cv, 6),
        "loop_first_last_identity_match": loop_identity_match,
        "final_identity_reference_match": final_identity_match,
        "reference_scale_drift": (
            round(reference_scale_drift, 6)
            if reference_scale_drift is not None
            else None
        ),
        "reference_scale_passed": reference_scale_passed,
        "frames": entries,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
