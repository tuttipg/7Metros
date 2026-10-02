import unittest
from urllib.request import Request

from tools.femebal_public_discovery import SafeRedirectHandler, _canonical_official_page_url


class SensitiveFemebalQueryTests(unittest.TestCase):
    def test_sensitive_query_keys_fail_closed(self):
        bad = [
            'https://femebal.com/programaciones/?accessToken=placeholder',
            'https://femebal.com/programaciones/?auth_token=placeholder',
            'https://femebal.com/programaciones/?id_token=placeholder',
            'https://femebal.com/programaciones/?refresh-token=placeholder',
            'https://femebal.com/programaciones/?api_key=placeholder',
            'https://femebal.com/programaciones/?client_secret=placeholder',
            'https://femebal.com/programaciones/?privateKey=placeholder',
            'https://femebal.com/programaciones/?session_id=placeholder',
            'https://femebal.com/programaciones/?password=placeholder',
            'https://femebal.com/programaciones/?Authorization=placeholder',
            'https://femebal.com/programaciones/?cookie=placeholder',
        ]
        for url in bad:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    _canonical_official_page_url(url)

    def test_ordinary_read_filters_remain_allowed(self):
        self.assertEqual(
            _canonical_official_page_url('https://femebal.com/programaciones/?fase=apertura&fecha=3&sortKey=fecha'),
            'https://femebal.com/programaciones/?fase=apertura&fecha=3&sortKey=fecha',
        )

    def test_redirects_with_sensitive_queries_fail_before_following(self):
        handler = SafeRedirectHandler()
        req = Request('https://femebal.com/programaciones/')
        for target in [
            'https://femebal.com/programaciones/?accessToken=placeholder',
            'https://femebal.com/programaciones/?session_id=placeholder',
        ]:
            with self.subTest(target=target):
                with self.assertRaises(ValueError):
                    handler.redirect_request(req, None, 302, 'Found', {}, target)


if __name__ == '__main__':
    unittest.main()
