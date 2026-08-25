import json
import tempfile
import unittest
from pathlib import Path

from firepoint_api.settings import cors_origin_regex, cors_origins, configured_dem_sources


class CorsTests(unittest.TestCase):
    def test_configured_cors_origins_allow_localhost_and_loopback(self) -> None:
        self.assertEqual(
            cors_origins(),
            ["http://localhost:5173", "http://127.0.0.1:5173"],
        )

    def test_configured_loopback_cors_regex_allows_vite_selected_ports(self) -> None:
        self.assertEqual(cors_origin_regex(), r"^http://(localhost|127\.0\.0\.1)(:\d+)?$")

    def test_json_configuration_loads_named_dem_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(
                json.dumps({"demSources": {"test-dem": {"path": "D:/GIS/test.tif", "verticalDatum": "ellipsoidal"}}}),
                encoding="utf-8",
            )
            source = configured_dem_sources(path)["test-dem"]
            self.assertEqual(source.path, Path("D:/GIS/test.tif"))
            self.assertEqual(source.vertical_datum, "ellipsoidal")
