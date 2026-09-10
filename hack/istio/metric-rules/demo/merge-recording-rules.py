#!/usr/bin/env python3
"""Merge Istio and optional Kiali recording rules for edge Prometheus."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

DEMO_DIR = Path(__file__).resolve().parent
RULES_DIR = DEMO_DIR.parent


def merge_rules(rules_dir: Path, with_kiali: bool) -> dict:
    rules = yaml.safe_load((rules_dir / "core-recording-rules.yml").open())
    if with_kiali:
        kiali_rules = yaml.safe_load(
            (rules_dir / "kiali-metrics-recording-rules.yml").open()
        )
        rules["groups"].extend(kiali_rules["groups"])
    return rules


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--with-kiali",
        action="store_true",
        help="Include kiali-metrics-recording-rules.yml groups",
    )
    parser.add_argument(
        "--rules-dir",
        type=Path,
        default=RULES_DIR,
        help="Directory containing core-recording-rules.yml (default: parent of demo/)",
    )
    args = parser.parse_args()
    yaml.dump(
        merge_rules(args.rules_dir, args.with_kiali),
        sys.stdout,
        default_flow_style=False,
        sort_keys=False,
    )


if __name__ == "__main__":
    main()
