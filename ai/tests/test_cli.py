import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from sevenmetros_ai.cli import main


class CliTests(unittest.TestCase):
    def test_summary_saves_hash_config_and_team_references(self):
        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / 'input.mp4'
            video.write_bytes(b'fixture-placeholder-not-video')
            refs = Path(folder) / 'teams.json'
            refs.write_text(json.dumps({'team_a': [220, 20, 20], 'team_b': [20, 20, 220]}))
            summary = Path(folder) / 'metrics.json'
            with patch('sys.argv', ['7metros-ai', '--video', str(video),
                                   '--team-references', str(refs), '--output-summary', str(summary)]), \
                 patch('sevenmetros_ai.cli.UltralyticsPersonDetector'), \
                 patch('sevenmetros_ai.cli.analyze_video', return_value={'frames_processed': 3}) as run, \
                 patch('builtins.print'):
                self.assertEqual(main(), 0)
            data = json.loads(summary.read_text())
            self.assertEqual(data['input_sha256'], hashlib.sha256(video.read_bytes()).hexdigest())
            self.assertEqual(set(data['team_references']), {'team_a', 'team_b'})
            self.assertIsNotNone(run.call_args.kwargs['team_classifier'])

    def test_summary_cannot_overwrite_input(self):
        with patch('sys.argv', ['7metros-ai', '--video', 'v.mp4', '--output-summary', 'v.mp4']):
            with self.assertRaisesRegex(ValueError, 'distinct'):
                main()

    def test_nonfinite_reference_rejected_before_loading_model(self):
        with tempfile.TemporaryDirectory() as folder:
            refs = Path(folder) / 'teams.json'
            refs.write_text('{"a": [NaN, 0, 1], "b": [0, 1, 2]}')
            with patch('sys.argv', ['7metros-ai', '--video', 'v.mp4', '--team-references', str(refs)]):
                with self.assertRaisesRegex(ValueError, 'finite'):
                    main()
