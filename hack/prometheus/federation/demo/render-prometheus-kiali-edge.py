#!/usr/bin/env python3
"""Render prometheus-kiali-edge.yaml with kiali-metrics-recording-rules.yml embedded."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

DEMO_DIR = Path(__file__).resolve().parent
RULES_DIR = DEMO_DIR.parent


def load_manifest(path: Path) -> list[dict]:
    with path.open() as handle:
        return list(yaml.safe_load_all(handle))


def render(demo_dir: Path, rules_dir: Path) -> str:
    manifest = load_manifest(demo_dir / "prometheus-kiali-edge.yaml")
    recording_rules = (
        rules_dir / "kiali-metrics-recording-rules.yml"
    ).read_text().rstrip()

    for item in manifest:
        if item.get("kind") != "ConfigMap":
            continue
        item["data"]["recording_rules.yml"] = recording_rules

    return yaml.dump_all(manifest, default_flow_style=False, sort_keys=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--demo-dir",
        type=Path,
        default=DEMO_DIR,
        help="Directory containing prometheus-kiali-edge.yaml (default: demo/)",
    )
    parser.add_argument(
        "--rules-dir",
        type=Path,
        default=RULES_DIR,
        help="Directory containing kiali-metrics-recording-rules.yml",
    )
    args = parser.parse_args()
    print(render(args.demo_dir, args.rules_dir))


if __name__ == "__main__":
    main()
