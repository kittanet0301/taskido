#!/usr/bin/env python3
"""Normalize a keyed single-image skill icon to the 128px Taskino format."""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

from PIL import Image

CANVAS = 128
INNER = 112


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    module_path = Path(__file__).with_name("process-skill-icons.py")
    spec = importlib.util.spec_from_file_location("process_skill_icons", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source = module.remove_edge_debris(source)
    source_bounds = source.getchannel("A").point(lambda value: 255 if value > 24 else 0).getbbox()
    if source_bounds is None:
        raise ValueError("input has no visible pixels")
    subject = source.crop(source_bounds)
    scale = min(INNER / subject.width, INNER / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    icon = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    icon.alpha_composite(subject, ((CANVAS - size[0]) // 2, (CANVAS - size[1]) // 2))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    icon.save(args.output, optimize=True)
    alpha_bbox = icon.getchannel("A").getbbox()
    if alpha_bbox is None or min(alpha_bbox[0], alpha_bbox[1], CANVAS-alpha_bbox[2], CANVAS-alpha_bbox[3]) < 8:
        raise ValueError(f"edge padding QC failed: {alpha_bbox}")
    print(f"Wrote {args.output} (source={source_bounds}, alpha={alpha_bbox})")


if __name__ == "__main__":
    main()
