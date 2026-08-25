import unittest
from unittest.mock import MagicMock

from firepoint_core.metadata import _inspect_image, extract_dji_xmp_tags


class MetadataTests(unittest.TestCase):
    def test_extract_dji_xmp(self):
        tags = extract_dji_xmp_tags(b'<rdf drone-dji:GpsLatitude="+29.595824927" drone-dji:GimbalPitchDegree="-45.00" />')
        self.assertEqual(tags["GpsLatitude"], "+29.595824927")
        self.assertEqual(tags["GimbalPitchDegree"], "-45.00")

    def test_dji_utc_exposure_is_timezone_qualified(self):
        image = MagicMock()
        image.__enter__.return_value = image
        image.size = (100, 100)
        image.format = "JPEG"
        image.getexif.return_value = {}
        pillow = MagicMock()
        pillow.open.return_value = image
        metadata = _inspect_image(pillow, b'<rdf drone-dji:UTCAtExposure="2026-06-22T03:11:26.708152" />', "fixture.jpg")
        self.assertEqual(metadata["capturedAt"], "2026-06-22T03:11:26.708152Z")
