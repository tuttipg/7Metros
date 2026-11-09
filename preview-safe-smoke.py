"""Regression checks for the USB-only static preview allowlist."""
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import urlopen

from preview_safe import Handler


class PreviewSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def request(self, path):
        try:
            with urlopen(self.base + path, timeout=5) as response:
                return response.status, response.read(), response.headers
        except HTTPError as error:
            return error.code, error.read(), error.headers

    def test_home_and_assets(self):
        for path in ("/", "/index.html", "/style.css", "/script.js", "/favicon.svg", "/match-result-core.mjs", "/match-freshness-core.mjs"):
            with self.subTest(path=path):
                status, body, headers = self.request(path)
                self.assertEqual(status, 200)
                self.assertTrue(body)
                self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
                self.assertEqual(headers["Cache-Control"], "no-store")

    def test_internal_files_and_directories_are_unavailable(self):
        for path in (
            "/.git/config", "/.github/workflows/validate.yml",
            "/docs/web-v1-mobile-preview-gate.md", "/preview_safe.py",
            "/README.md", "/.env", "/n8n/importer-core.mjs",
            "/%2e%67it/config", "/index.html/anything", "/%5c.git",
        ):
            with self.subTest(path=path):
                status, _, _ = self.request(path)
                self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
