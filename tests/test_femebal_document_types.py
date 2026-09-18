import unittest

from tools.femebal_public_discovery import (
    PdfSource,
    Source,
    _document_type_counts,
    build_manifest,
    discover_pdfs,
)

PROGRAMACION = 'https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf'
PLANILLA = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf'
SOURCE = Source(
    'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',
    'Programación Fecha 1 – Torneo Metropolitano Apertura 2026',
    'fecha_normal', 'apertura', 1,
)
PAGE = f'<a href="{PROGRAMACION}">Programación sábado</a><a href="{PLANILLA}">Planilla control</a>'
INDEX = f'<a href="{SOURCE.page_url}">{SOURCE.title}</a>'


class DocumentTypeContract(unittest.TestCase):
    def test_discovery_types_programacion_and_planilla_separately(self):
        rows = {row.pdf_url: row for row in discover_pdfs(PAGE, SOURCE)}
        self.assertEqual(rows[PROGRAMACION].document_type, 'programacion_pdf')
        self.assertEqual(rows[PLANILLA].document_type, 'planilla_partido_pdf')

    def test_manifest_emits_document_type_without_weakening_safe_contract(self):
        manifest = build_manifest(INDEX, {SOURCE.page_url: PAGE})
        rows = {row['pdf_url']: row for row in manifest['pdfs']}
        self.assertEqual(rows[PROGRAMACION]['document_type'], 'programacion_pdf')
        self.assertEqual(rows[PLANILLA]['document_type'], 'planilla_partido_pdf')
        self.assertTrue(manifest['safe'])
        self.assertTrue(manifest['complete'])
        self.assertFalse(manifest['write_enabled'])
        self.assertFalse(manifest['auth_used'])

    def test_document_type_counts_keep_programming_and_match_sheets_separate(self):
        pdfs = discover_pdfs(PAGE, SOURCE)
        self.assertEqual(
            _document_type_counts(pdfs),
            {'programacion_pdf': 1, 'planilla_partido_pdf': 1},
        )

    def test_document_type_counts_fail_closed_on_unknown_type(self):
        forged = PdfSource(
            SOURCE.page_url, SOURCE.title, PROGRAMACION, 'forged',
            'unknown_pdf', SOURCE.source_type, SOURCE.phase, SOURCE.round_number,
        )
        with self.assertRaisesRegex(ValueError, 'Tipo documental inesperado'):
            _document_type_counts([forged])


if __name__ == '__main__':
    unittest.main()
