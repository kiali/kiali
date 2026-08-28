#!/usr/bin/env python3
"""Render prometheus-prod.yaml with optional Perses dashboard federation tier."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml


def load_manifest(path: Path) -> list[dict]:
    with path.open() as handle:
        return list(yaml.safe_load_all(handle))


def render(with_dashboards: bool, script_dir: Path) -> str:
    manifest = load_manifest(script_dir / "prometheus-prod.yaml")
    dashboard_match = yaml.safe_load(
        (script_dir / "federation-match-dashboards.yml").open()
    )["match"]

    for item in manifest:
        if item.get("kind") != "ConfigMap":
            continue
        prom_config = yaml.safe_load(item["data"]["prometheus.yml"])
        federate_job = prom_config["scrape_configs"][0]
        if with_dashboards:
            federate_job["params"]["match[]"].extend(dashboard_match)
        item["data"]["prometheus.yml"] = yaml.dump(
            prom_config,
            default_flow_style=False,
            sort_keys=False,
        ).rstrip()

    return yaml.dump_all(manifest, default_flow_style=False, sort_keys=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--with-dashboards",
        action="store_true",
        help="Include optional Perses dashboard federation selectors",
    )
    parser.add_argument(
        "--script-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directory containing prometheus-prod.yaml (default: script location)",
    )
    args = parser.parse_args()
    print(render(args.with_dashboards, args.script_dir))


if __name__ == "__main__":
    main()
