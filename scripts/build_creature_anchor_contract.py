#!/usr/bin/env python3
"""Summarize accepted prototype animation QC into a stage anchor contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ACTION_CONFIG = {
    "egg": [("move", 6, "loop"), ("hatch", 6, "one-shot")],
    "baby": [
        ("idle", 4, "loop"),
        ("move", 4, "loop"),
        ("hurt", 4, "one-shot"),
        ("bite", 4, "one-shot"),
        ("jump", 4, "one-shot"),
    ],
    "adult": [
        ("idle", 4, "loop"),
        ("move", 4, "loop"),
        ("hurt", 4, "one-shot"),
        ("bite", 4, "one-shot"),
        ("jump", 4, "one-shot"),
    ],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prototype-root", type=Path, required=True)
    parser.add_argument("--element", required=True)
    parser.add_argument("--stage", choices=sorted(ACTION_CONFIG), required=True)
    parser.add_argument("--fit-scale", type=float, required=True)
    parser.add_argument("--component-mode", choices=["largest", "all"], default="all")
    args = parser.parse_args()

    stage_dir = args.prototype_root / args.element / "animations" / args.stage
    actions: dict[str, object] = {}
    all_passed = True
    for action, frames, playback in ACTION_CONFIG[args.stage]:
        qc_path = stage_dir / action / "qc.json"
        qc = json.loads(qc_path.read_text(encoding="utf-8"))
        passed = bool(qc.get("passed"))
        all_passed = all_passed and passed
        entry: dict[str, object] = {
            "path": action,
            "frames": frames,
            "grid": [2, 3] if args.stage == "egg" else [2, 2],
            "playback": playback,
            "qc": f"{action}/qc.json",
            "passed": passed,
            "body_height_cv": qc.get("body_height_cv"),
            "magenta_fringe_pixels": sum(
                frame.get("magenta_fringe_pixels", 0) for frame in qc.get("frames", [])
            ),
        }
        if qc.get("shared_baseline_y") is not None:
            entry["output_baseline_y"] = qc["shared_baseline_y"]
        if qc.get("reference_scale_drift") is not None:
            entry["reference_scale_drift"] = qc["reference_scale_drift"]
        if action == "hatch":
            entry["final_identity_reference_match"] = qc.get(
                "final_identity_reference_match"
            )
        if action == "jump":
            finalize_path = stage_dir / action / "jump-finalize-meta.json"
            finalize = json.loads(finalize_path.read_text(encoding="utf-8"))
            entry.update(
                {
                    "position_policy": finalize["position_policy"],
                    "target_baselines_y": finalize["target_baselines_y"],
                    "baseline_span": qc.get("baseline_span"),
                    "ground_return_delta": qc.get("ground_return_delta"),
                }
            )
        actions[action] = entry

    contract = {
        "element": args.element,
        "stage": args.stage,
        "status": (
            "accepted-complete-action-set" if all_passed else "incomplete-or-qc-failed"
        ),
        "canvas": [192, 192],
        "raw_background": "#FF00FF",
        "grounded_output_baseline_y": 176,
        "master_reference": f"../../master-{args.stage}.png",
        "generation_anchor": (
            "references/move-anchor-2x3.png"
            if args.stage == "egg"
            else "references/idle-anchor-2x2.png"
        ),
        "processing": {
            "resize_filter": "nearest-neighbor",
            "fit_scale": args.fit_scale,
            "align": "feet",
            "baseline_y_argument": 176,
            "component_mode": args.component_mode,
            "shared_scale": True,
        },
        "actions": actions,
        "stage_action_set_complete": all_passed,
        "runtime_registered": False,
    }
    (stage_dir / "anchor-contract.json").write_text(
        json.dumps(contract, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"output": str(stage_dir / "anchor-contract.json"), "passed": all_passed}))


if __name__ == "__main__":
    main()
