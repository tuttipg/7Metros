import unittest

from sevenmetros_ai.ball_training_sources import (
    PASSED,
    REJECTED,
    screen_training_sources,
)


def fixture(license_id="CC-BY-4.0", obligations=None):
    if obligations is None:
        obligations = ["attribution"]
    return {
        "schema": "sevenmetros.ball-training-sources/v1",
        "dataset_title": "Handball ball boxes",
        "domain": "team_handball",
        "sources": [
            {
                "role": "original_media",
                "url": "https://example.org/media",
                "terms_accessed_on": "2026-10-03",
                "attribution": "Example media authors",
                "license": {
                    "id": license_id,
                    "url": "https://example.org/media-license",
                },
                "obligations": list(obligations),
            },
            {
                "role": "annotations",
                "url": "https://example.org/annotations",
                "terms_accessed_on": "2026-10-03",
                "attribution": "Example annotation authors",
                "license": {
                    "id": "CC-BY-4.0",
                    "url": "https://example.org/annotation-license",
                },
                "obligations": ["attribution"],
            },
        ],
    }


class BallTrainingSourceTests(unittest.TestCase):
    def test_passes_complete_cc_by_product_screen_without_admitting_dataset(self):
        report = screen_training_sources(fixture(), "product")
        self.assertEqual(report["status"], PASSED)
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["dataset_admission_status"], "NOT_EVALUATED")
        self.assertEqual(report["model_accuracy_status"], "NOT_EVALUATED")

    def test_rejects_noncommercial_media_for_product(self):
        payload = fixture(
            "CC-BY-NC-SA-4.0",
            ["attribution", "noncommercial_only", "share_alike"],
        )
        report = screen_training_sources(payload, "product")
        self.assertEqual(report["status"], REJECTED)
        self.assertTrue(any("forbids product/commercial use" in error
                            for error in report["errors"]))

    def test_allows_documented_noncommercial_media_for_research_screen(self):
        payload = fixture(
            "CC-BY-NC-SA-4.0",
            ["attribution", "noncommercial_only", "share_alike"],
        )
        report = screen_training_sources(payload, "research_noncommercial")
        self.assertEqual(report["status"], PASSED)

    def test_rejects_missing_annotation_rights(self):
        payload = fixture()
        payload["sources"] = payload["sources"][:1]
        report = screen_training_sources(payload, "research_noncommercial")
        self.assertIn(
            "source manifest lacks rights coverage for: annotations",
            report["errors"],
        )

    def test_rejects_unknown_license_and_incomplete_obligations(self):
        payload = fixture("CUSTOM", [])
        report = screen_training_sources(payload, "product")
        self.assertTrue(any("not in the reviewed policy" in error
                            for error in report["errors"]))
        payload = fixture("CC-BY-SA-4.0", ["attribution"])
        report = screen_training_sources(payload, "product")
        self.assertTrue(any("share_alike" in error for error in report["errors"]))


if __name__ == "__main__":
    unittest.main()
