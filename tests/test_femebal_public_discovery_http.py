import unittest
from email.message import Message
from unittest.mock import patch

from tools.femebal_public_discovery import MAX_HTML_BYTES, get_text


class FakeResponse:
    def __init__(self, body=b'<html></html>', *, content_type='text/html', content_length=None, url='https://femebal.com/programaciones/'):
        self.body = body
        self.url = url
        self.headers = Message()
        if content_type is not None:
            self.headers['Content-Type'] = content_type
        if content_length is not None:
            self.headers['Content-Length'] = str(content_length)
        self.read_size = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def geturl(self):
        return self.url

    def read(self, size=-1):
        self.read_size = size
        return self.body if size < 0 else self.body[:size]


class FakeOpener:
    def __init__(self, response):
        self.response = response

    def open(self, request, timeout=None):
        return self.response


class HttpBoundaryTests(unittest.TestCase):
    def _fetch(self, response, *, max_bytes=MAX_HTML_BYTES):
        with patch('tools.femebal_public_discovery.build_opener', return_value=FakeOpener(response)):
            return get_text('https://femebal.com/programaciones/', max_bytes=max_bytes)

    def test_accepts_bounded_html_and_reads_only_max_plus_one(self):
        response = FakeResponse(b'<html>ok</html>', content_type='text/html; charset=utf-8', content_length=15)
        self.assertEqual(self._fetch(response, max_bytes=64), '<html>ok</html>')
        self.assertEqual(response.read_size, 65)

    def test_accepts_xhtml(self):
        response = FakeResponse(b'<html/>', content_type='application/xhtml+xml')
        self.assertEqual(self._fetch(response, max_bytes=64), '<html/>')

    def test_rejects_non_html_media_type_before_read(self):
        response = FakeResponse(b'{}', content_type='application/json')
        with self.assertRaises(ValueError):
            self._fetch(response, max_bytes=64)
        self.assertIsNone(response.read_size)

    def test_rejects_declared_oversize_before_read(self):
        response = FakeResponse(b'<html/>', content_type='text/html', content_length=65)
        with self.assertRaises(ValueError):
            self._fetch(response, max_bytes=64)
        self.assertIsNone(response.read_size)

    def test_rejects_invalid_or_negative_content_length(self):
        for value in ('abc', -1):
            response = FakeResponse(b'<html/>', content_type='text/html', content_length=value)
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    self._fetch(response, max_bytes=64)
                self.assertIsNone(response.read_size)

    def test_rejects_actual_oversize_without_content_length(self):
        response = FakeResponse(b'x' * 65, content_type='text/html')
        with self.assertRaises(ValueError):
            self._fetch(response, max_bytes=64)
        self.assertEqual(response.read_size, 65)


if __name__ == '__main__':
    unittest.main()
