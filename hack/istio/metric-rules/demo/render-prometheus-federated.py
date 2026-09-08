#!/usr/bin/env python3
"""Render prometheus-federated.yaml with core and optional federation tiers."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

DEMO_DIR = Path(__file__).resolve().parent
RULES_DIR = DEMO_DIR.parent

KIALI_FEDERATE_JOB = "kiali-prometheus-federate"
KIALI_EDGE_TARGET = "prometheus-kiali-edge.istio-system.svc.cluster.local:9090"

CORE_MATCH_FILE = "core-federation-match.yml"
DASHBOARD_MATCH_FILE = "istio-dashboard-federation-match.yml"
KIALI_MATCH_FILE = "kiali-metrics-federation-match.yml"


def load_manifest(path: Path) -> list[dict]:
    with path.open() as handle:
        return list(yaml.safe_load_all(handle))


def load_match_file(rules_dir: Path, filename: str) -> list[str]:
    return yaml.safe_load((rules_dir / filename).open())["match"]


def kiali_federate_job(match: list[str], target: str) -> dict:
    return {
        "job_name": KIALI_FEDERATE_JOB,
        "honor_labels": True,
        "metrics_path": "/federate",
        "scrape_interval": "30s",
        "scrape_timeout": "25s",
        "params": {"match[]": list(match)},
        "metric_relabel_configs": [
            {
                "source_labels": ["__name__"],
                "regex": "kiali:(.*)",
                "target_label": "__name__",
                "action": "replace",
            }
        ],
        "static_configs": [{"targets": [target]}],
    }


def render(
    with_dashboards: bool,
    with_kiali_metrics: bool,
    kiali_edge: str,
    demo_dir: Path,
    rules_dir: Path,
) -> str:
    manifest = load_manifest(demo_dir / "prometheus-federated.yaml")
    kiali_match = load_match_file(rules_dir, KIALI_MATCH_FILE)

    for item in manifest:
        if item.get("kind") != "ConfigMap":
            continue
        prom_config = yaml.safe_load(item["data"]["prometheus.yml"])
        istio_job = prom_config["scrape_configs"][0]

        istio_job["params"]["match[]"] = load_match_file(rules_dir, CORE_MATCH_FILE)

        if with_dashboards:
            istio_job["params"]["match[]"].extend(
                load_match_file(rules_dir, DASHBOARD_MATCH_FILE)
            )

        if with_kiali_metrics:
            if kiali_edge == "istio":
                istio_job["params"]["match[]"].extend(kiali_match)
                istio_job["metric_relabel_configs"].append(
                    {
                        "source_labels": ["__name__"],
                        "regex": "kiali:(.*)",
                        "target_label": "__name__",
                        "action": "replace",
                    }
                )
            elif kiali_edge == "dedicated":
                prom_config["scrape_configs"].append(
                    kiali_federate_job(kiali_match, KIALI_EDGE_TARGET)
                )
            else:
                raise ValueError(f"unknown kiali-edge mode: {kiali_edge}")

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
        "--with-kiali-metrics",
        action="store_true",
        help="Federate aggregated kiali:* metrics from edge Prometheus",
    )
    parser.add_argument(
        "--kiali-edge",
        choices=["istio", "dedicated"],
        default="istio",
        help="Kiali edge mode: shared Istio edge (default) or dedicated Kiali edge Prom",
    )
    parser.add_argument(
        "--demo-dir",
        type=Path,
        default=DEMO_DIR,
        help="Directory containing prometheus-federated.yaml (default: demo/)",
    )
    parser.add_argument(
        "--rules-dir",
        type=Path,
        default=RULES_DIR,
        help="Directory containing *-federation-match.yml (default: parent of demo/)",
    )
    args = parser.parse_args()
    if args.kiali_edge == "dedicated" and not args.with_kiali_metrics:
        parser.error("--kiali-edge=dedicated requires --with-kiali-metrics")
    print(
        render(
            args.with_dashboards,
            args.with_kiali_metrics,
            args.kiali_edge,
            args.demo_dir,
            args.rules_dir,
        )
    )


if __name__ == "__main__":
    main()
