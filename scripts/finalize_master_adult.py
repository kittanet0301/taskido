#!/usr/bin/env python3
"""Finalize a generated master-adult portrait from a magenta raw gen + master-baby scale."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

from creature_chroma import remove_bg_chroma, resolve_chroma_key


def content_height(img: Image.Image) -> int:
    alpha = np.array(img.convert("RGBA"))[:, :, 3]
    ys = np.where(alpha > 0)[0]
    if len(ys) == 0:
        return 0
    return int(ys.max() - ys.min() + 1)


def finalize_master_adult(
    raw_path: Path,
    baby_reference: Path,
    output_path: Path,
    *,
    normalized_raw_path: Path | None = None,
    canvas: int = 192,
    pad: int = 6,
    bottom_padding: int = 18,
    height_multiplier: float = 1.4,
    chroma_key: str = "green",
    threshold: int = 100,
    edge_threshold: int = 150,
) -> None:
    source = Image.open(raw_path).convert("RGBA")
    raw = source
    if normalized_raw_path is not None:
        raw = source.resize((1024, 1024), Image.Resampling.NEAREST)
        normalized_raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw.save(normalized_raw_path)
    key = resolve_chroma_key(chroma_key)
    cleaned = remove_bg_chroma(raw, key, threshold, edge_threshold)

    alpha = np.array(cleaned)[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(ys) == 0:
        raise ValueError(f"No subject found after chroma key: {raw_path}")

    crop = cleaned.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))

    baby = Image.open(baby_reference).convert("RGBA")
    baby_h = content_height(baby)
    if baby_h <= 0:
        raise ValueError(f"Baby reference has no visible content: {baby_reference}")

    target_h = max(1, int(round(baby_h * height_multiplier)))
    scale = target_h / crop.height
    target_w = max(1, int(round(crop.width * scale)))
    scaled = crop.resize((target_w, target_h), Image.NEAREST)

    max_w = canvas - pad * 2
    max_h = canvas - bottom_padding - pad
    if scaled.width > max_w or scaled.height > max_h:
        fit = min(max_w / scaled.width, max_h / scaled.height)
        scaled = scaled.resize(
            (max(1, int(scaled.width * fit)), max(1, int(scaled.height * fit))),
            Image.NEAREST,
        )

    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = (canvas - scaled.width) // 2
    y = canvas - bottom_padding - scaled.height
    out.paste(scaled, (x, y), scaled)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(output_path)
    print(f"Wrote {output_path} ({canvas}x{canvas}, content h={scaled.height}, baby h={baby_h})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Finalize master-adult from raw gen + master-baby scale.")
    parser.add_argument("--raw", type=Path, required=True, help="Raw generated chroma-key image")
    parser.add_argument("--normalized-raw", type=Path, help="Optional retained 1024x1024 raw copy")
    parser.add_argument("--baby-reference", type=Path, required=True, help="master-baby.png for scale")
    parser.add_argument("--output", type=Path, required=True, help="Output master-adult.png path")
    parser.add_argument("--canvas", type=int, default=192)
    parser.add_argument("--pad", type=int, default=6, help="Minimum top/side safety padding")
    parser.add_argument("--bottom-padding", type=int, default=18, help="Shared feet baseline padding")
    parser.add_argument("--height-multiplier", type=float, default=1.4)
    parser.add_argument("--chroma-key", default="green", choices=["green", "magenta"])
    parser.add_argument("--threshold", type=int, default=100)
    parser.add_argument("--edge-threshold", type=int, default=150)
    args = parser.parse_args()

    finalize_master_adult(
        args.raw,
        args.baby_reference,
        args.output,
        normalized_raw_path=args.normalized_raw,
        canvas=args.canvas,
        pad=args.pad,
        bottom_padding=args.bottom_padding,
        height_multiplier=args.height_multiplier,
        chroma_key=args.chroma_key,
        threshold=args.threshold,
        edge_threshold=args.edge_threshold,
    )


if __name__ == "__main__":
    main()
