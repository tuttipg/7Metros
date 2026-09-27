import unittest

from evaluate_trackeval_bundle import compact_tracker_metrics, summarize_results


class TrackEvalResultTests(unittest.TestCase):
    def payload(self):
        return {
            'HOTA': {
                'HOTA': [0.8, 0.6], 'DetA': [0.7, 0.5],
                'AssA': [0.9, 0.7], 'LocA': [0.95, 0.85],
            },
            'CLEAR': {
                'MOTA': .75, 'MOTP': .9, 'CLR_Re': .8, 'CLR_Pr': .85,
                'CLR_TP': 80, 'CLR_FN': 20, 'CLR_FP': 14,
                'IDSW': 3, 'Frag': 4,
            },
            'Identity': {'IDF1': .81, 'IDR': .8, 'IDP': .82},
            'Count': {'Dets': 94, 'GT_Dets': 100, 'IDs': 12, 'GT_IDs': 10},
        }

    def test_compacts_percentages_and_preserves_counts(self):
        result = compact_tracker_metrics(self.payload())
        self.assertEqual(result['HOTA'], 70.0)
        self.assertEqual(result['MOTA'], 75.0)
        self.assertEqual(result['IDF1'], 81.0)
        self.assertEqual(result['IDSW'], 3)
        self.assertEqual(result['gt_detections'], 100)

    def test_extracts_only_requested_trackers(self):
        raw = {'MotChallenge2DBox': {
            'candidate': {'COMBINED_SEQ': {'pedestrian': self.payload()}},
        }}
        result = summarize_results(raw, ['candidate'])
        self.assertEqual(list(result), ['candidate'])
        self.assertEqual(result['candidate']['AssA'], 80.0)

    def test_rejects_unexpected_result_shape(self):
        with self.assertRaisesRegex(ValueError, 'Unexpected TrackEval'):
            summarize_results({}, ['candidate'])

    def test_rejects_empty_hota_vector(self):
        payload = self.payload()
        payload['HOTA']['HOTA'] = []
        with self.assertRaisesRegex(ValueError, 'empty metric vector'):
            compact_tracker_metrics(payload)


if __name__ == '__main__':
    unittest.main()
