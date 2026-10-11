import unittest
from unittest.mock import patch

from sevenmetros_ai.fixture_filter import BlueCourtClassifier
from sevenmetros_ai.fixture_kits import FerroLujanKits
from sevenmetros_ai.tracking import Detection


class _Frame:
    shape = (524, 960, 3)


class FixtureBoundaryRoleTests(unittest.TestCase):
    def test_boundary_referee_hint_is_suppressed_by_default(self):
        detection = Detection(900, 420, 960, 524)
        with patch.object(BlueCourtClassifier, 'classify', return_value=[detection]), \
                patch('sevenmetros_ai.fixture_kits.representative_jersey_rgb',
                      return_value=(20, 20, 20)):
            result = FerroLujanKits().classify(_Frame(), [detection])
        self.assertIsNone(result[0].role_candidate)

    def test_experimental_mode_keeps_boundary_referee_hint(self):
        detection = Detection(900, 420, 960, 524)
        with patch.object(BlueCourtClassifier, 'classify', return_value=[detection]), \
                patch('sevenmetros_ai.fixture_kits.representative_jersey_rgb',
                      return_value=(20, 20, 20)):
            result = FerroLujanKits(allow_boundary_roles=True).classify(
                _Frame(), [detection],
            )
        self.assertEqual(result[0].role_candidate, 'referee')


if __name__ == '__main__':
    unittest.main()
