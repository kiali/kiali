#!/usr/bin/env python3
"""Set OpenAPI info.version in a swagger.json file (used by make swagger-doc)."""

import json
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} <swagger.json> <version>", file=sys.stderr)
        return 1

    path, version = sys.argv[1], sys.argv[2].strip()
    if not version:
        print("version must not be empty", file=sys.stderr)
        return 1

    with open(path, encoding="utf-8") as f:
        spec = json.load(f)

    spec.setdefault("info", {})["version"] = version

    with open(path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2)
        f.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
