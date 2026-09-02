#!/usr/bin/env python3
"""Merge Istio and optional Kiali recording rules for edge Prometheus."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml


def merge_rules(script_dir: Path, with_kiali: bool) -> dict:
    rules = yaml.safe_load((script_dir / "recording-rules.yml").open())
    if with_kiali:
        kiali_rules = yaml.safe_load((script_dir / "kiali-recording-rules.yml").open())
        rules["groups"].extend(kiali_rules["groups"])
    return rules


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--with-kiali",
        action="store_true",
        help="Include kiali-recording-rules.yml groups",
    )
    parser.add_argument(
        "--script-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directory containing recording-rules.yml (default: script location)",
    )
    args = parser.parse_args()
    yaml.dump(
        merge_rules(args.script_dir, args.with_kiali),
        sys.stdout,
        default_flow_style=False,
        sort_keys=False,
    )


if __name__ == "__main__":
    main()
