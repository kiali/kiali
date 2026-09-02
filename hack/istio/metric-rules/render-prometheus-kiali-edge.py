#!/usr/bin/env python3
"""Render prometheus-kiali-edge.yaml with kiali-recording-rules.yml embedded."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml


def load_manifest(path: Path) -> list[dict]:
    with path.open() as handle:
        return list(yaml.safe_load_all(handle))


def render(script_dir: Path) -> str:
    manifest = load_manifest(script_dir / "prometheus-kiali-edge.yaml")
    recording_rules = (script_dir / "kiali-recording-rules.yml").read_text().rstrip()

    for item in manifest:
        if item.get("kind") != "ConfigMap":
            continue
        item["data"]["recording_rules.yml"] = recording_rules

    return yaml.dump_all(manifest, default_flow_style=False, sort_keys=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--script-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directory containing prometheus-kiali-edge.yaml (default: script location)",
    )
    args = parser.parse_args()
    print(render(args.script_dir))


if __name__ == "__main__":
    main()
