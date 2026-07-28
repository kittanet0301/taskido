#!/usr/bin/env python3
"""Apply a deterministic pixel offset to one frame and rebuild sheet/GIF exports."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from creature_sheet_crop import compose_sheet, save_transparent_gif


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--frames", required=True, type=int)
    parser.add_argument("--frame", required=True, type=int)
    parser.add_argument("--dx", type=int, default=0)
    parser.add_argument("--dy", type=int, default=0)
    parser.add_argument("--rows", required=True, type=int)
    parser.add_argument("--cols", required=True, type=int)
    parser.add_argument("--duration", type=int, default=200)
    args = parser.parse_args()

    if not 1 <= args.frame <= args.frames:
        raise ValueError("--frame must be within the exported frame range")
    if args.rows * args.cols != args.frames:
        raise ValueError("--rows * --cols must equal --frames")

    frames: list[Image.Image] = []
    for index in range(1, args.frames + 1):
        path = args.input_dir / f"{args.prefix}-{index}.png"
        image = Image.open(path).convert("RGBA")
        if index == args.frame:
            shifted = Image.new("RGBA", image.size, (0, 0, 0, 0))
            shifted.alpha_composite(image, (args.dx, args.dy))
            image = shifted
            image.save(path)
        frames.append(image)

    compose_sheet(frames, args.rows, args.cols, frames[0].width).save(
        args.input_dir / "sheet-transparent.png"
    )
    save_transparent_gif(frames, args.input_dir / "animation.gif", args.duration)


if __name__ == "__main__":
    main()
