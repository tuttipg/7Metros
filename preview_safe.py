"""Local-only static preview for Chrome Android through adb reverse."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse

ROOT = Path(__file__).resolve().parent
ALLOWED = {'.html', '.css', '.js', '.mjs', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2'}

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        name = unquote(urlsplit(path).path)
        if name == '/':
            name = '/index.html'
        if name.count('/') != 1 or '\\' in name or name[1:].startswith('.'):
            return str(ROOT / '__denied__')
        target = ROOT / name[1:]
        if target.suffix.lower() not in ALLOWED or not target.is_file():
            return str(ROOT / '__denied__')
        return str(target)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print(f'Local-only preview: http://127.0.0.1:{args.port}/', flush=True)
        server.serve_forever()
