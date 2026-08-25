from __future__ import annotations

import argparse
import json
from pathlib import Path

from .metadata import inspect_image_metadata
from .pipeline import calculate_location


def main() -> None:
    parser = argparse.ArgumentParser(description="Calculate a fire-point location by intersecting a pixel ray with a DEM.")
    parser.add_argument("--input", required=True, help="Path to a geolocation input JSON file")
    parser.add_argument("--image", help="Optional image to inspect for metadata candidates")
    parser.add_argument("--output", help="Optional output JSON path; otherwise writes to stdout")
    args = parser.parse_args()
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    metadata = inspect_image_metadata(args.image) if args.image else None
    result = calculate_location(data, metadata)
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
