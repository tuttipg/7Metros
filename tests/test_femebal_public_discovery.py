import json
import tempfile
import unittest
from pathlib import Path
from urllib.request import Request
from tools.femebal_public_discovery import discover_pages, discover_pdfs, build_manifest, load_page_seeds, merge_pages, Source, _assert_allowed, _canonical_official_page_url, _is_official_upload_pdf, SafeRedirectHandler

CONTROL_PLANILLA='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf'
CONTROL_PLANILLA_EXPLICIT_443='https://djfhz848yeeat.cloudfront.net:443/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf'

INDEX='''<html><body>
<a href="https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/">Programación Fecha 1 – Torneo Metropolitano Apertura 2026</a>
<a href="/reprogramaciones-28-de-abril-al-1-de-mayo/">Reprogramaciones 28 de abril al 1 de mayo</a>
<a href="/programacion-fecha-1-torneo-de-desarrollo-2026/">Programación Fecha 1 – Torneo de Desarrollo 2026</a>
<a href="https://evil.example/x">Programación Fecha 99 – Torneo Metropolitano</a>
</body></html>'''
PAGE=f'''<html><body>
<a href="https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf">Sabado 21-3 Descarga</a>
<a href="/wp-content/uploads/2026/03/Domingo-22-3.pdf">Domingo 22-3 Descarga</a>
<a href="{CONTROL_PLANILLA}">Planilla oficial Argentinos Juniors 20–27 Ferro</a>
<a href="https://djfhz848yeeat.cloudfront.net/not-planillas/file.pdf">CloudFront fuera del árbol permitido</a>
<a href="https://other.cloudfront.net/pdf_planillas/file.pdf">CloudFront incorrecto</a>
<a href="{CONTROL_PLANILLA}?download=1">Planilla con query</a>
<a href="{CONTROL_PLANILLA}#page=1">Planilla con fragmento</a>
<a href="https://femebal.com/documentos/reglamento.pdf">Reglamento</a>
<a href="https://cdn.evil.example/file.pdf">PDF</a>
</body></html>'''

class T(unittest.TestCase):
    def _seed_file(self,payload):
        tmp=tempfile.NamedTemporaryFile('w',encoding='utf-8',suffix='.json',delete=False)
        json.dump(payload,tmp); tmp.close(); self.addCleanup(lambda: Path(tmp.name).unlink(missing_ok=True)); return Path(tmp.name)
    def _safe_seed_payload(self,pages): return {'schema_version':1,'safe':True,'auth_used':False,'write_enabled':False,'pages':pages}
    def test_index_filters_scope_and_types(self):
        rows=discover_pages(INDEX); self.assertEqual(len(rows),2)
        normal=[x for x in rows if x.source_type=='fecha_normal'][0]
        self.assertEqual((normal.phase,normal.round_number),('apertura',1))
        self.assertEqual(len([x for x in rows if x.source_type=='reprogramacion']),1)
    def test_seed_loader_accepts_historical_official_page_and_deduplicates_index(self):
        historical='https://femebal.com/programacion-fecha-15-torneo-metropolitano-apertura-2026/'
        seed_path=self._seed_file(self._safe_seed_payload([historical,'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/']))
        seeds=load_page_seeds(seed_path); self.assertEqual(len(seeds),2)
        merged=merge_pages(discover_pages(INDEX),seeds)
        self.assertEqual(len([x for x in merged if x.page_url==historical]),1)
        self.assertEqual(len([x for x in merged if x.page_url.endswith('/programacion-fecha-1-torneo-metropolitano-apertura-2026/')]),1)
        recovered=[x for x in merged if x.page_url==historical][0]
        self.assertEqual((recovered.phase,recovered.round_number),('apertura',15))
    def test_seed_loader_fails_closed_on_unsafe_contract_host_tracking_and_scope(self):
        bad_payloads=[
            {'schema_version':1,'safe':False,'auth_used':False,'write_enabled':False,'pages':['https://femebal.com/programacion-fecha-3-torneo-metropolitano-apertura-2026/']},
            self._safe_seed_payload(['https://evil.example/programacion-fecha-3-torneo-metropolitano-apertura-2026/']),
            self._safe_seed_payload(['https://femebal.com/programacion-fecha-3-torneo-metropolitano-apertura-2026/?utm_source=x']),
            self._safe_seed_payload(['https://femebal.com/programacion-fecha-3-torneo-de-desarrollo-2026/']),
        ]
        for payload in bad_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError): load_page_seeds(self._seed_file(payload))
    def test_page_url_canonicalization_matches_node_semantics(self):
        self.assertEqual(_canonical_official_page_url('https://FEMEBAL.com:443/programaciones/?fase=apertura'),'https://femebal.com/programaciones/?fase=apertura')
        self.assertEqual(_canonical_official_page_url('https://femebal.com'),'https://femebal.com/')
        with self.assertRaises(ValueError): _canonical_official_page_url('https://femebal.com/programaciones/#fecha-1')
        duplicate_index='''<html><body><a href="https://femebal.com:443/programacion-fecha-1-torneo-metropolitano-apertura-2026/">Programación Fecha 1 – Torneo Metropolitano Apertura 2026</a><a href="https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/">Programación Fecha 1 – Torneo Metropolitano Apertura 2026</a><a href="https://femebal.com/programacion-fecha-2-torneo-metropolitano-apertura-2026/#fixture">Programación Fecha 2 – Torneo Metropolitano Apertura 2026</a></body></html>'''
        rows=discover_pages(duplicate_index); self.assertEqual(len(rows),1)
    def test_page_tracking_queries_are_rejected_fail_closed(self):
        for url in ['https://femebal.com/programaciones/?utm_source=instagram','https://femebal.com/programaciones/?UTM_CAMPAIGN=apertura','https://femebal.com/programaciones/?fbclid=abc123','https://femebal.com/programaciones/?fase=apertura&utm_medium=social']:
            with self.subTest(url=url):
                with self.assertRaises(ValueError): _canonical_official_page_url(url)
    def test_pdf_discovery_allowlist_and_provenance(self):
        s=Source('https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/','Programación Fecha 1 – Torneo Metropolitano Apertura 2026','fecha_normal','apertura',1)
        rows=discover_pdfs(PAGE,s); self.assertEqual(len(rows),3); urls={x.pdf_url for x in rows}; self.assertIn(CONTROL_PLANILLA,urls)
        self.assertTrue(all(_is_official_upload_pdf(x.pdf_url) for x in rows))
        for bad in ['https://femebal.com/documentos/reglamento.pdf','https://djfhz848yeeat.cloudfront.net/not-planillas/file.pdf','https://other.cloudfront.net/pdf_planillas/file.pdf',CONTROL_PLANILLA+'?download=1',CONTROL_PLANILLA+'#page=1','https://djfhz848yeeat.cloudfront.net/pdf_planillas/%2e%2e/file.pdf','https://djfhz848yeeat.cloudfront.net/pdf_planillas/../file.pdf']:
            self.assertFalse(_is_official_upload_pdf(bad))
    def test_pdf_path_prefix_policy_matches_node_case_sensitivity(self):
        self.assertFalse(_is_official_upload_pdf('https://djfhz848yeeat.cloudfront.net/PDF_PLANILLAS/5/c/e/5ce377051ea0acb1.pdf')); self.assertFalse(_is_official_upload_pdf('https://femebal.com/WP-CONTENT/uploads/2026/03/Sabado-21-3.pdf')); self.assertTrue(_is_official_upload_pdf('https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5CE377051EA0ACB1.PDF'))
    def test_manifest_carries_control_planilla_without_enabling_writes(self):
        page=[x for x in discover_pages(INDEX) if x.source_type=='fecha_normal'][0]; manifest=build_manifest(INDEX,{page.page_url:PAGE}); urls={row['pdf_url'] for row in manifest['pdfs']}; self.assertIn(CONTROL_PLANILLA,urls); self.assertTrue(manifest['safe']); self.assertTrue(manifest['complete']); self.assertFalse(manifest['write_enabled']); self.assertFalse(manifest['auth_used'])
    def test_manifest_marks_fetch_failures_incomplete(self):
        page=discover_pages(INDEX)[0]; errors=[{'stage':'fetch_page','url':page.page_url,'error':'TimeoutError'}]; manifest=build_manifest(INDEX,{},errors); self.assertEqual(manifest['schema_version'],2); self.assertFalse(manifest['complete']); self.assertFalse(manifest['write_enabled']); self.assertFalse(manifest['auth_used']); self.assertEqual(manifest['fetch_errors'],errors)
    def test_manifest_without_fetch_failures_is_complete(self):
        page=discover_pages(INDEX)[0]; manifest=build_manifest(INDEX,{page.page_url:PAGE}); self.assertTrue(manifest['complete']); self.assertEqual(manifest['fetch_errors'],[])
    def test_manifest_deduplicates_same_pdf_from_same_source(self):
        page=[x for x in discover_pages(INDEX) if x.source_type=='fecha_normal'][0]; duplicate=PAGE.replace('</body>',f'<a href="{CONTROL_PLANILLA}">Mismo PDF, otro texto visible</a></body>'); manifest=build_manifest(INDEX,{page.page_url:duplicate}); control=[row for row in manifest['pdfs'] if row['pdf_url']==CONTROL_PLANILLA]; self.assertEqual(len(control),1)
    def test_manifest_canonicalizes_default_https_port_before_dedupe(self):
        page=[x for x in discover_pages(INDEX) if x.source_type=='fecha_normal'][0]; duplicate=PAGE.replace('</body>',f'<a href="{CONTROL_PLANILLA_EXPLICIT_443}">Mismo PDF con :443</a></body>'); manifest=build_manifest(INDEX,{page.page_url:duplicate}); control=[row for row in manifest['pdfs'] if row['pdf_url']==CONTROL_PLANILLA]; self.assertEqual(len(control),1); self.assertFalse(any(':443/' in row['pdf_url'] for row in manifest['pdfs']))
    def test_manifest_fails_closed_on_contradictory_pdf_provenance(self):
        normal=[x for x in discover_pages(INDEX) if x.source_type=='fecha_normal'][0]; reprogram=[x for x in discover_pages(INDEX) if x.source_type=='reprogramacion'][0]; manifest=build_manifest(INDEX,{normal.page_url:f'<a href="{CONTROL_PLANILLA}">Control normal</a>',reprogram.page_url:f'<a href="{CONTROL_PLANILLA}">Control reprogramado</a>'}); self.assertFalse(manifest['complete']); self.assertFalse(any(row['pdf_url']==CONTROL_PLANILLA for row in manifest['pdfs'])); self.assertEqual(len([e for e in manifest['fetch_errors'] if e['stage']=='metadata_conflict']),1)
    def test_reject_unsafe_page_urls_and_do_not_expand_page_scope_to_cloudfront(self):
        for url in ['http://femebal.com/x','https://evil.example/x','https://user:pass@femebal.com/x','https://femebal.com:444/x',CONTROL_PLANILLA]:
            with self.subTest(url=url):
                with self.assertRaises(ValueError): _assert_allowed(url)
    def test_reject_raw_control_and_backslash_urls_before_urllib_normalization(self):
        for url in ['https://femebal.com/\nprogramaciones/','https://femebal.com/\tprogramaciones/','https://femebal.com/programaciones/\\extra','https://femebal.com/\x7fprogramaciones/']:
            with self.subTest(url=repr(url)):
                with self.assertRaises(ValueError): _canonical_official_page_url(url)
    def test_redirect_handler_blocks_external_planilla_fragment_and_tracking_destinations(self):
        h=SafeRedirectHandler(); req=Request('https://femebal.com/programaciones/')
        for target in ['https://evil.example/collect',CONTROL_PLANILLA,'https://femebal.com/programaciones/#fecha-1','https://femebal.com/programaciones/?utm_source=redirect']:
            with self.subTest(target=target):
                with self.assertRaises(ValueError): h.redirect_request(req,None,302,'Found',{},target)

if __name__=='__main__': unittest.main()
