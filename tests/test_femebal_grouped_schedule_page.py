import unittest

from tools.femebal_public_discovery import Source, discover_pdfs


class GroupedSchedulePageTest(unittest.TestCase):
    def test_one_official_grouped_page_can_yield_multiple_distinct_schedule_pdfs(self):
        """A single observed FEMEBAL post may explicitly link more than one round PDF."""
        source = Source(
            "https://femebal.com/programacion-sabado-13-y-domingo-14-de-junio/",
            "Programación sábado 13 y domingo 14 de junio",
            "fecha_normal",
            "apertura",
            None,
        )
        html = """<html><body>
        <a href="https://femebal.com/wp-content/uploads/2026/06/Fecha-8-Sabado-13-6.pdf">Fecha 8 (Sábado)</a>
        <a href="https://femebal.com/wp-content/uploads/2026/06/Fecha-12-Domingo-14-6.pdf">Fecha 12 (Domingo)</a>
        </body></html>"""

        rows = discover_pdfs(html, source)

        self.assertEqual(len(rows), 2)
        self.assertEqual(
            {row.pdf_url for row in rows},
            {
                "https://femebal.com/wp-content/uploads/2026/06/Fecha-8-Sabado-13-6.pdf",
                "https://femebal.com/wp-content/uploads/2026/06/Fecha-12-Domingo-14-6.pdf",
            },
        )
        self.assertTrue(all(row.provenance == "public_explicit_link" for row in rows))
        self.assertTrue(all(row.page_url == source.page_url for row in rows))


if __name__ == "__main__":
    unittest.main()
