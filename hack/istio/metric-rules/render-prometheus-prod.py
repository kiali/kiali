#!/usr/bin/env python3
"""Render prometheus-prod.yaml with optional Perses dashboard and Kiali federation tiers."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

KIALI_FEDERATE_JOB = "kiali-prometheus-federate"
KIALI_EDGE_TARGET = "prometheus-kiali-edge.istio-system.svc.cluster.local:9090"
ISTIO_EDGE_TARGET = "prometheus.istio-system.svc.cluster.local:9090"


def load_manifest(path: Path) -> list[dict]:
    with path.open() as handle:
        return list(yaml.safe_load_all(handle))


def load_match_file(script_dir: Path, filename: str) -> list[str]:
    return yaml.safe_load((script_dir / filename).open())["match"]


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
    script_dir: Path,
) -> str:
    manifest = load_manifest(script_dir / "prometheus-prod.yaml")
    kiali_match = load_match_file(script_dir, "federation-match-kiali.yml")

    for item in manifest:
        if item.get("kind") != "ConfigMap":
            continue
        prom_config = yaml.safe_load(item["data"]["prometheus.yml"])
        istio_job = prom_config["scrape_configs"][0]

        if with_dashboards:
            istio_job["params"]["match[]"].extend(
                load_match_file(script_dir, "federation-match-dashboards.yml")
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
        "--script-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directory containing prometheus-prod.yaml (default: script location)",
    )
    args = parser.parse_args()
    if args.kiali_edge == "dedicated" and not args.with_kiali_metrics:
        parser.error("--kiali-edge=dedicated requires --with-kiali-metrics")
    print(
        render(
            args.with_dashboards,
            args.with_kiali_metrics,
            args.kiali_edge,
            args.script_dir,
        )
    )


if __name__ == "__main__":
    main()
