import unittest

from tools.femebal_public_discovery import discover_pages, links_from_html


class DuplicateHrefAttributeTests(unittest.TestCase):
    def test_ambiguous_anchor_hrefs_are_ignored_but_unique_href_is_preserved(self):
        unique = (
            'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/'
        )
        duplicate_same = (
            'https://femebal.com/programacion-fecha-2-torneo-metropolitano-apertura-2026/'
        )
        duplicate_conflicting = (
            'https://femebal.com/programacion-fecha-3-torneo-metropolitano-apertura-2026/'
        )
        html = f"""
        <a href="{unique}">Programación Fecha 1 – Torneo Metropolitano Apertura 2026</a>
        <a href="{duplicate_same}" href="{duplicate_same}">Programación Fecha 2 – Torneo Metropolitano Apertura 2026</a>
        <a href="https://evil.example/decoy"
           href="{duplicate_conflicting}">Programación Fecha 3 – Torneo Metropolitano Apertura 2026</a>
        """

        links = links_from_html(html)
        self.assertEqual(links, [(unique, "Programación Fecha 1 – Torneo Metropolitano Apertura 2026")])

        pages = discover_pages(html)
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0].page_url, unique)
        self.assertEqual((pages[0].phase, pages[0].round_number), ("apertura", 1))


if __name__ == "__main__":
    unittest.main()
