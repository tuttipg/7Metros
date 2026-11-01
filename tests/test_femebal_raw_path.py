import unittest
from urllib.request import Request

from tools.femebal_public_discovery import (
    SafeRedirectHandler,
    Source,
    _canonical_official_page_url,
    discover_pages,
    discover_pdfs,
)

CONTROL_PLANILLA = "https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf"
PAGE_URL = "https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/"
SOURCE = Source(PAGE_URL, "Programación Fecha 1 – Torneo Metropolitano Apertura 2026", "fecha_normal", "apertura", 1)


class RawPathBoundaryTests(unittest.TestCase):
    def test_page_canonicalization_rejects_encoded_and_dot_segments(self):
        bad_urls = [
            "https://femebal.com/programaciones/../programacion-fecha-1-torneo-metropolitano-apertura-2026/",
            "https://femebal.com/programaciones/./programacion-fecha-1-torneo-metropolitano-apertura-2026/",
            "https://femebal.com/%2e%2e/programacion-fecha-1-torneo-metropolitano-apertura-2026/",
            "https://femebal.com/programaciones/%2Fadmin/",
        ]
        for url in bad_urls:
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    _canonical_official_page_url(url)

    def test_percent_encoded_query_values_remain_allowed(self):
        self.assertEqual(
            _canonical_official_page_url("https://femebal.com/programaciones/?category=LHC%20masculino"),
            "https://femebal.com/programaciones/?category=LHC%20masculino",
        )

    def test_page_discovery_rejects_ambiguous_href_before_urljoin(self):
        html = f"""
        <a href="/programaciones/../programacion-fecha-1-torneo-metropolitano-apertura-2026/">Programación Fecha 1 – Torneo Metropolitano Apertura 2026</a>
        <a href="/%2e%2e/programacion-fecha-2-torneo-metropolitano-apertura-2026/">Programación Fecha 2 – Torneo Metropolitano Apertura 2026</a>
        <a href="/programacion-fecha-3-torneo-metropolitano-apertura-2026/">Programación Fecha 3 – Torneo Metropolitano Apertura 2026</a>
        """
        rows = discover_pages(html)
        self.assertEqual([row.round_number for row in rows], [3])

    def test_pdf_discovery_rejects_ambiguous_href_before_urljoin(self):
        html = f"""
        <a href="https://djfhz848yeeat.cloudfront.net/pdf_planillas/../pdf_planillas/5/c/e/5ce377051ea0acb1.pdf">ambiguous dot path</a>
        <a href="https://djfhz848yeeat.cloudfront.net/pdf_planillas/%2e%2e/file.pdf">encoded traversal</a>
        <a href="{CONTROL_PLANILLA}">valid explicit planilla</a>
        """
        rows = discover_pdfs(html, SOURCE)
        self.assertEqual([row.pdf_url for row in rows], [CONTROL_PLANILLA])
        self.assertEqual(rows[0].document_type, "planilla_partido_pdf")

    def test_redirect_rejects_raw_path_before_urljoin(self):
        handler = SafeRedirectHandler()
        request = Request("https://femebal.com/programaciones/")
        for target in [
            "../programaciones/",
            "https://femebal.com/programaciones/../admin/",
            "https://femebal.com/%2e%2e/admin/",
        ]:
            with self.subTest(target=target):
                with self.assertRaises(ValueError):
                    handler.redirect_request(request, None, 302, "Found", {}, target)


if __name__ == "__main__":
    unittest.main()
