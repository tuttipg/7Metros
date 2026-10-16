import unittest

from tools.femebal_public_discovery import Source, classify_page, discover_pdfs, load_page_seeds


class GroupedSchedulePageTest(unittest.TestCase):
    def test_grouped_official_seed_is_classified_without_broadening_scope(self):
        grouped = "https://femebal.com/programacion-sabado-13-y-domingo-14-de-junio/"
        source = classify_page(grouped, grouped)
        self.assertIsNotNone(source)
        self.assertEqual(
            (source.source_type, source.phase, source.round_number),
            ("fecha_normal", "apertura", None),
        )

        unrelated = "https://femebal.com/programacion-fecha-1-torneo-de-desarrollo-2026/"
        self.assertIsNone(classify_page(unrelated, unrelated))

    def test_default_seed_manifest_contains_verified_grouped_schedule_page(self):
        grouped = "https://femebal.com/programacion-sabado-13-y-domingo-14-de-junio/"
        matches = [row for row in load_page_seeds() if row.page_url == grouped]
        self.assertEqual(len(matches), 1)
        self.assertEqual(
            (matches[0].source_type, matches[0].phase, matches[0].round_number),
            ("fecha_normal", "apertura", None),
        )

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
