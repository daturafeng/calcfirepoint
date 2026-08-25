import math
import unittest

from firepoint_core.models import BoundingBox, Calibration, ImageSize, Pose
from firepoint_core.projection import camera_ray_to_enu, pixel_to_camera_ray


class GeometryTests(unittest.TestCase):
    def test_bbox_center_and_smoke_bottom_center(self):
        box = BoundingBox(10, 20, 40, 60)
        self.assertEqual(box.select_pixel("bbox_center"), (30.0, 50.0))
        self.assertEqual(box.select_pixel("smoke_bottom_center"), (30.0, 80))

    def test_image_centre_follows_optical_axis(self):
        image = ImageSize(4032, 3024)
        ray = pixel_to_camera_ray((2016, 1512), image, Calibration(horizontal_fov_deg=84, vertical_fov_deg=65.5))
        enu = camera_ray_to_enu(ray, Pose(azimuth_deg=0, pitch_deg=-45))
        self.assertAlmostEqual(enu[0], 0.0, places=6)
        self.assertAlmostEqual(enu[1], math.sqrt(0.5), places=6)
        self.assertAlmostEqual(enu[2], -math.sqrt(0.5), places=6)
