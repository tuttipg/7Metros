"""Local-only static preview for Chrome Android through adb reverse."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
import re

ROOT = Path(__file__).resolve().parent
ALLOWED = {'.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2'}

OFFLINE = False

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if OFFLINE and urlsplit(self.path).path.lower().endswith(('.html', '/')):
            target = Path(self.translate_path(self.path))
            if target.is_file() and target.suffix == '.html':
                page = target.read_text(encoding='utf-8')
                # Remove speculative connections to production even before JS runs.
                page = re.sub(r'<link\\b[^>]*\\brel=["\\\']preconnect["\\\'][^>]*>', '', page, flags=re.I)
                banner = '<div role="status" style="padding:12px;background:#fff3cd;color:#332800;text-align:center">Vista aislada sin datos en vivo: navegación y diseño solamente.</div>'
                page = re.sub(r'(<body\\b[^>]*>)', lambda m: m.group(1) + banner, page, count=1, flags=re.I)
                payload = page.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
        super().do_GET()

    def translate_path(self, path):
        name = unquote(urlsplit(path).path)
        if name == '/':
            name = '/index.html'
        if name.count('/') != 1 or '\\' in name or name[1:].startswith('.'):
            return str(ROOT / '__denied__')
        target = ROOT / name[1:]
        # Resolve links before checking containment to avoid serving files outside ROOT.
        if not target.resolve().is_relative_to(ROOT) or target.suffix.lower() not in ALLOWED or not target.is_file():
            return str(ROOT / '__denied__')
        return str(target)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        if OFFLINE:
            self.send_header('Content-Security-Policy', "default-src 'self' data:; connect-src 'none'; img-src 'self' data:; font-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'none'; base-uri 'self'")
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--offline', action='store_true', help='Block remote data requests and mark the preview as offline')
    args = parser.parse_args()
    OFFLINE = args.offline
    with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print(f'Local-only preview ({"OFFLINE" if OFFLINE else "public read-only data"}): http://127.0.0.1:{args.port}/', flush=True)
        server.serve_forever()
