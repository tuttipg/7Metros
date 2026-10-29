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
            'https://femebal.com/programaciones/?key=placeholder',
            'https://femebal.com/programaciones/?apiKeyValue=placeholder',
            'https://femebal.com/programaciones/?accessTokenValue=placeholder',
            'https://femebal.com/programaciones/?auth=placeholder',
            'https://femebal.com/programaciones/?authTokenValue=placeholder',
            'https://femebal.com/programaciones/?authenticationMethod=placeholder',
            'https://femebal.com/programaciones/?clientKey=placeholder',
            'https://femebal.com/programaciones/?clientSecretValue=placeholder',
            'https://femebal.com/programaciones/?privateKeyExtra=placeholder',
            'https://femebal.com/programaciones/?sessionIdExtra=placeholder',
            'https://femebal.com/programaciones/?prefixAccessTokenSuffix=placeholder',
            'https://femebal.com/programaciones/?prefixClientSecretSuffix=placeholder',
            'https://femebal.com/programaciones/?prefixPrivateKeySuffix=placeholder',
            'https://femebal.com/programaciones/?prefixSessionTokenSuffix=placeholder',
            'https://femebal.com/programaciones/?playerToken=placeholder',
            'https://femebal.com/programaciones/?signingKeyValue=placeholder',
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

    def test_author_filters_are_not_misclassified_as_auth_material(self):
        for url in [
            'https://femebal.com/programaciones/?author=club',
            'https://femebal.com/programaciones/?authorId=club',
        ]:
            with self.subTest(url=url):
                self.assertEqual(_canonical_official_page_url(url), url)

    def test_redirects_with_sensitive_queries_fail_before_following(self):
        handler = SafeRedirectHandler()
        req = Request('https://femebal.com/programaciones/')
        for target in [
            'https://femebal.com/programaciones/?accessToken=placeholder',
            'https://femebal.com/programaciones/?session_id=placeholder',
            'https://femebal.com/programaciones/?apiKeyValue=placeholder',
        ]:
            with self.subTest(target=target):
                with self.assertRaises(ValueError):
                    handler.redirect_request(req, None, 302, 'Found', {}, target)


if __name__ == '__main__':
    unittest.main()
