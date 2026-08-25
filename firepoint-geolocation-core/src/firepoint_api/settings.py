from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


PROJECT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config.json"
DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
DEFAULT_CORS_ORIGIN_REGEX = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"


@dataclass(frozen=True)
class DemSource:
    identifier: str
    path: Path
    vertical_datum: str


def load_project_configuration(path: Path = PROJECT_CONFIG_PATH) -> dict[str, object]:
    """Read the project-local JSON settings required by the API."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("config_root_must_be_object")
    return data


def configured_dem_sources(path: Path = PROJECT_CONFIG_PATH) -> dict[str, DemSource]:
    data = load_project_configuration(path)
    raw_sources = data.get("demSources")
    if not isinstance(raw_sources, dict) or not raw_sources:
        raise ValueError("config_dem_sources_required")
    sources: dict[str, DemSource] = {}
    for identifier, raw_source in raw_sources.items():
        if not isinstance(identifier, str) or not isinstance(raw_source, dict):
            raise ValueError("config_dem_source_invalid")
        dem_path = raw_source.get("path")
        vertical_datum = raw_source.get("verticalDatum")
        if not isinstance(dem_path, str) or not dem_path or not isinstance(vertical_datum, str) or not vertical_datum:
            raise ValueError("config_dem_source_invalid")
        sources[identifier] = DemSource(identifier, Path(dem_path), vertical_datum)
    return sources


def cors_origins(path: Path = PROJECT_CONFIG_PATH) -> list[str]:
    data = load_project_configuration(path)
    cors = data.get("cors", {})
    if not isinstance(cors, dict):
        raise ValueError("config_cors_invalid")
    origins = cors.get("origins", DEFAULT_CORS_ORIGINS.split(","))
    if not isinstance(origins, list) or not all(isinstance(origin, str) and origin.strip() for origin in origins):
        raise ValueError("config_cors_origins_invalid")
    return [origin.strip() for origin in origins]


def cors_origin_regex(path: Path = PROJECT_CONFIG_PATH) -> str | None:
    """Permit local Vite ports while keeping non-loopback origins explicit."""
    data = load_project_configuration(path)
    cors = data.get("cors", {})
    if not isinstance(cors, dict):
        raise ValueError("config_cors_invalid")
    value = cors.get("originRegex", DEFAULT_CORS_ORIGIN_REGEX)
    if not isinstance(value, str):
        raise ValueError("config_cors_origin_regex_invalid")
    return value.strip() or None
