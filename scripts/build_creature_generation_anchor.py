#!/usr/bin/env python3
"""Build a flat-magenta multi-cell generation anchor from a transparent master."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--cols", type=int, required=True)
    parser.add_argument("--canvas-size", type=int, default=1024)
    parser.add_argument("--height-ratio", type=float, required=True)
    parser.add_argument("--width-ratio", type=float, default=0.72)
    parser.add_argument("--feet-ratio", type=float, default=0.82)
    return parser.parse_args()


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Input master has no visible pixels")
    return bbox


def main() -> None:
    args = parse_args()
    master = Image.open(args.input).convert("RGBA")
    master = master.crop(alpha_bbox(master))

    cell_w = args.canvas_size // args.cols
    cell_h = args.canvas_size // args.rows
    scale = min(
        (cell_h * args.height_ratio) / master.height,
        (cell_w * args.width_ratio) / master.width,
    )
    resized = master.resize(
        (max(1, round(master.width * scale)), max(1, round(master.height * scale))),
        Image.Resampling.NEAREST,
    )

    canvas = Image.new("RGBA", (args.canvas_size, args.canvas_size), (255, 0, 255, 255))
    for row in range(args.rows):
        for col in range(args.cols):
            x = col * cell_w + (cell_w - resized.width) // 2
            baseline = row * cell_h + round(cell_h * args.feet_ratio)
            y = baseline - resized.height
            canvas.alpha_composite(resized, (x, y))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output)


if __name__ == "__main__":
    main()
