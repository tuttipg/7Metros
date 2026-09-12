import unittest
from urllib.request import Request
from tools.femebal_public_discovery import discover_pages, discover_pdfs, Source, _assert_allowed, SafeRedirectHandler

INDEX='''<html><body>
<a href="https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/">Programación Fecha 1 – Torneo Metropolitano Apertura 2026</a>
<a href="/reprogramaciones-28-de-abril-al-1-de-mayo/">Reprogramaciones 28 de abril al 1 de mayo</a>
<a href="/programacion-fecha-1-torneo-de-desarrollo-2026/">Programación Fecha 1 – Torneo de Desarrollo 2026</a>
<a href="https://evil.example/x">Programación Fecha 99 – Torneo Metropolitano</a>
</body></html>'''
PAGE='''<html><body>
<a href="https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf">Sabado 21-3 Descarga</a>
<a href="/wp-content/uploads/2026/03/Domingo-22-3.pdf">Domingo 22-3 Descarga</a>
<a href="https://cdn.evil.example/file.pdf">PDF</a>
</body></html>'''

class T(unittest.TestCase):
    def test_index_filters_scope_and_types(self):
        rows=discover_pages(INDEX)
        self.assertEqual(len(rows),2)
        normal=[x for x in rows if x.source_type=='fecha_normal'][0]
        self.assertEqual((normal.phase,normal.round_number),('apertura',1))
        self.assertEqual(len([x for x in rows if x.source_type=='reprogramacion']),1)

    def test_pdf_discovery_allowlist(self):
        s=Source('https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/','Programación Fecha 1 – Torneo Metropolitano Apertura 2026','fecha_normal','apertura',1)
        rows=discover_pdfs(PAGE,s)
        self.assertEqual(len(rows),2)
        self.assertTrue(all(x.pdf_url.startswith('https://femebal.com/') for x in rows))

    def test_reject_unsafe_urls(self):
        bad=[
            'http://femebal.com/x',
            'https://evil.example/x',
            'https://user:pass@femebal.com/x',
            'https://femebal.com:444/x',
        ]
        for url in bad:
            with self.subTest(url=url):
                with self.assertRaises(ValueError): _assert_allowed(url)
        _assert_allowed('https://femebal.com/x')
        _assert_allowed('https://www.femebal.com:443/x')

    def test_redirect_handler_blocks_external_destination(self):
        h=SafeRedirectHandler()
        req=Request('https://femebal.com/programaciones/')
        with self.assertRaises(ValueError):
            h.redirect_request(req,None,302,'Found',{},'https://evil.example/collect')

if __name__=='__main__': unittest.main()
