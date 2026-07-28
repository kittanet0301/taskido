#!/usr/bin/env python3
"""Validate all nine static creature masters, animation actions and contracts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ELEMENTS = ("neutral", "fire", "grass", "ground", "electric", "water", "ice", "dragon", "dark")
ACTIONS = {
    "egg": {"move": 6, "hatch": 6},
    "baby": {"idle": 4, "move": 4, "hurt": 4, "bite": 4, "jump": 4},
    "adult": {"idle": 4, "move": 4, "hurt": 4, "bite": 4, "jump": 4},
}


def inspect_master(path: Path) -> dict[str, object]:
    if not path.exists():
        return {"passed": False, "error": "missing", "path": str(path)}
    source = Image.open(path)
    source_mode = source.mode
    image = source.convert("RGBA")
    rgba = np.asarray(image)
    alpha = rgba[:, :, 3] > 0
    ys, xs = np.where(alpha)
    if len(xs) == 0:
        return {"passed": False, "error": "empty", "path": str(path)}
    bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    edge_touch = bool(
        np.any(alpha[0, :]) or np.any(alpha[-1, :]) or np.any(alpha[:, 0]) or np.any(alpha[:, -1])
    )
    rgb = rgba[:, :, :3].astype(np.int32)
    key = np.array([255, 0, 255], dtype=np.int32)
    magenta = int(np.count_nonzero(alpha & (np.sum((rgb - key) ** 2, axis=2) < 95**2)))
    passed = image.size == (192, 192) and source_mode == "RGBA" and not edge_touch and magenta == 0
    return {
        "passed": passed,
        "path": str(path),
        "size": list(image.size),
        "mode": source_mode,
        "bbox": bbox,
        "edge_touch": edge_touch,
        "magenta_fringe_pixels": magenta,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--runtime-registered",
        action="store_true",
        help="Require contracts to be marked as promoted into the live runtime.",
    )
    args = parser.parse_args()

    elements: dict[str, object] = {}
    total_actions = 0
    passed_actions = 0
    total_contracts = 0
    passed_contracts = 0
    total_masters = 0
    passed_masters = 0

    for element in ELEMENTS:
        element_root = args.root / element
        masters: dict[str, object] = {}
        for stage, filename in (
            ("egg", "master-egg.png"),
            ("baby", "master-baby.png"),
            ("adult", "master-adult.png"),
        ):
            result = inspect_master(element_root / filename)
            masters[stage] = result
            total_masters += 1
            passed_masters += int(bool(result["passed"]))

        stages: dict[str, object] = {}
        for stage, actions in ACTIONS.items():
            stage_root = element_root / "animations" / stage
            contract_path = stage_root / "anchor-contract.json"
            contract_ok = False
            contract: dict[str, object] | None = None
            if contract_path.exists():
                contract = json.loads(contract_path.read_text(encoding="utf-8"))
                contract_actions = contract.get("actions", {})
                contract_ok = str(contract.get("status", "")).startswith("accepted-")
                contract_ok = contract_ok and all(
                    bool(item.get("passed")) for item in contract_actions.values()
                )
                if "stage_action_set_complete" in contract:
                    contract_ok = contract_ok and bool(contract.get("stage_action_set_complete"))
                contract_ok = (
                    contract_ok
                    and contract.get("runtime_registered") is args.runtime_registered
                )
            total_contracts += 1
            passed_contracts += int(contract_ok)

            action_results: dict[str, object] = {}
            for action, frames in actions.items():
                action_root = stage_root / action
                qc_path = action_root / "qc.json"
                qc = json.loads(qc_path.read_text(encoding="utf-8")) if qc_path.exists() else {}
                required = [
                    action_root / "raw-sheet.png",
                    action_root / "raw-sheet-clean.png",
                    action_root / "sheet-transparent.png",
                    action_root / "animation.gif",
                    action_root / "pipeline-meta.json",
                    action_root / "prompt-used.txt",
                    qc_path,
                ]
                required.extend(action_root / f"{action}-{index}.png" for index in range(1, frames + 1))
                missing = [str(path) for path in required if not path.exists()]
                passed = bool(qc.get("passed")) and not missing and qc.get("frame_count") == frames
                action_results[action] = {
                    "passed": passed,
                    "frames": frames,
                    "qc": str(qc_path),
                    "missing": missing,
                }
                total_actions += 1
                passed_actions += int(passed)

            stages[stage] = {
                "passed": contract_ok and all(bool(item["passed"]) for item in action_results.values()),
                "contract": str(contract_path),
                "contract_passed": contract_ok,
                "actions": action_results,
            }

        elements[element] = {
            "passed": all(bool(item["passed"]) for item in masters.values())
            and all(bool(item["passed"]) for item in stages.values()),
            "masters": masters,
            "stages": stages,
        }

    passed = (
        passed_masters == total_masters
        and passed_actions == total_actions
        and passed_contracts == total_contracts
    )
    report = {
        "passed": passed,
        "runtime_registered": args.runtime_registered,
        "summary": {
            "elements": len(ELEMENTS),
            "masters": {"passed": passed_masters, "total": total_masters},
            "actions": {"passed": passed_actions, "total": total_actions},
            "contracts": {"passed": passed_contracts, "total": total_contracts},
        },
        "elements": elements,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), **report["summary"], "passed": passed}))
    if not passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
