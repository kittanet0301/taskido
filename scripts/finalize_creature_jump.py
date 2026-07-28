#!/usr/bin/env python3
"""Normalize a jump without destroying its authored vertical trajectory."""

from __future__ import annotations

import argparse
import json
import math
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

from creature_pixel import scale_content  # noqa: E402
from generate2dsprite import compose_sheet, save_transparent_gif  # noqa: E402


def content_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.convert("RGBA").getchannel("A").getbbox()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--prefix", default="jump")
    parser.add_argument("--frames", type=int, default=4)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument(
        "--baselines",
        default="176,132,92,176",
        help="Comma-separated zero-based alpha baselines, one per frame.",
    )
    parser.add_argument("--duration", type=int, default=150)
    args = parser.parse_args()

    baselines = [int(value.strip()) for value in args.baselines.split(",")]
    if len(baselines) != args.frames:
        raise SystemExit("--baselines count must match --frames")

    source_frames: list[Image.Image] = []
    source_sizes: list[tuple[int, int]] = []
    for index in range(1, args.frames + 1):
        image = Image.open(args.input_dir / f"{args.prefix}-{index}.png").convert("RGBA")
        bbox = content_bbox(image)
        if bbox is None:
            raise SystemExit(f"Empty frame: {args.prefix}-{index}.png")
        content = image.crop(bbox)
        source_frames.append(content)
        source_sizes.append(content.size)

    reference = Image.open(args.reference).convert("RGBA")
    reference_bbox = content_bbox(reference)
    if reference_bbox is None:
        raise SystemExit("Reference image has no alpha content")
    reference_width = reference_bbox[2] - reference_bbox[0]
    reference_height = reference_bbox[3] - reference_bbox[1]
    mean_width = sum(width for width, _ in source_sizes) / len(source_sizes)
    mean_height = sum(height for _, height in source_sizes) / len(source_sizes)
    scale = math.sqrt((reference_width / mean_width) * (reference_height / mean_height))

    max_width = max(width for width, _ in source_sizes) * scale
    max_height = max(height for _, height in source_sizes) * scale
    scale *= min((192 - 16) / max_width, (192 - 16) / max_height, 1.0)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_frames: list[Image.Image] = []
    frame_meta: list[dict[str, object]] = []
    for index, (content, baseline) in enumerate(zip(source_frames, baselines), start=1):
        scaled = scale_content(content, scale)
        canvas = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        x = (canvas.width - scaled.width) // 2
        y = baseline - scaled.height + 1
        if x < 0 or y < 0 or x + scaled.width > canvas.width or y + scaled.height > canvas.height:
            raise SystemExit(f"Final frame {index} does not fit the 192x192 canvas")
        canvas.paste(scaled, (x, y), scaled)
        canvas.save(args.output_dir / f"{args.prefix}-{index}.png")
        output_frames.append(canvas)
        frame_meta.append(
            {
                "frame": index,
                "source_size": list(content.size),
                "output_size": list(scaled.size),
                "paste_position": [x, y],
                "target_baseline_y": baseline,
            }
        )

    compose_sheet(output_frames, 2, 2, 192).save(args.output_dir / "sheet-transparent.png")
    save_transparent_gif(output_frames, args.output_dir / "animation.gif", args.duration)
    metadata = {
        "scale": round(scale, 6),
        "resize_filter": "nearest-neighbor",
        "position_policy": "authored-trajectory-normalized-to-explicit-baselines",
        "target_baselines_y": baselines,
        "reference": str(args.reference),
        "frames": frame_meta,
    }
    (args.output_dir / "jump-finalize-meta.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
