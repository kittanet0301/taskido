"""Split a generated 4x9 FX atlas into per-element 2x2 raw sheets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ELEMENTS = ("fire", "grass", "ground", "electric", "water", "ice", "dragon", "dark", "neutral")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--kind", choices=("projectile", "impact", "aura"), required=True)
    parser.add_argument("--output-root", default="assets/battle/fx")
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGB")
    cell_width = source.width / 4
    row_height = source.height / 9
    frame_size = 384
    content_size = 336

    for row, element in enumerate(ELEMENTS):
        frames: list[Image.Image] = []
        for column in range(4):
            left = round(column * cell_width)
            row_center = (row + 0.5) * row_height
            source_height = row_height * (1.38 if args.kind in ("impact", "aura") else 1.12)
            top = round(row_center - source_height / 2)
            right = round((column + 1) * cell_width)
            bottom = round(row_center + source_height / 2)
            top = max(0, top)
            bottom = min(source.height, bottom)
            # Image generation can let glow from a neighbouring macro row
            # bleed across the mathematical boundary. Remove that gutter
            # before squaring the frame so it cannot become a false particle.
            x_gutter = round((right - left) * 0.035)
            y_gutter = 0
            left += x_gutter
            right -= x_gutter
            top += y_gutter
            bottom -= y_gutter
            content = source.crop((left, top, right, bottom)).resize(
                (content_size, content_size), Image.Resampling.LANCZOS
            )
            frame = Image.new("RGB", (frame_size, frame_size), "#FF00FF")
            inset = (frame_size - content_size) // 2
            frame.paste(content, (inset, inset))
            frames.append(frame)

        sheet = Image.new("RGB", (frame_size * 2, frame_size * 2), "#FF00FF")
        for index, frame in enumerate(frames):
            sheet.paste(frame, ((index % 2) * frame_size, (index // 2) * frame_size))

        output_dir = Path(args.output_root) / element / args.kind
        output_dir.mkdir(parents=True, exist_ok=True)
        sheet.save(output_dir / "raw-sheet.png")


if __name__ == "__main__":
    main()
