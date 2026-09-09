from pathlib import Path
from html.parser import HTMLParser
import sys

ROOT = Path(__file__).resolve().parent
errors = []


class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if 'id' in data:
            if data['id'] in self.ids:
                errors.append(f'duplicate id: {data["id"]}')
            self.ids.add(data['id'])

        if tag in ('a', 'link', 'script', 'img'):
            attr = {'a': 'href', 'link': 'href', 'script': 'src', 'img': 'src'}[tag]
            if data.get(attr):
                self.links.append(data[attr])


html_files = sorted(ROOT.glob('*.html'))
if not html_files:
    errors.append('No HTML files found')

for path in html_files:
    text = path.read_text(encoding='utf-8')
    parser = Parser()
    parser.feed(text)

    for ref in parser.links:
        if ref.startswith(('http://', 'https://', '#', 'mailto:', 'tel:', 'javascript:', 'data:')):
            continue
        local = ref.split('?')[0].split('#')[0]
        if not local:
            continue
        target = (path.parent / local).resolve()
        if not target.exists():
            errors.append(f'{path.name}: missing reference {ref}')

    if 'APERTURA 2026' in text:
        errors.append(f'{path.name}: stale APERTURA 2026 text')
    if 'Flask + SQLite' in text or 'conectemos el backend' in text:
        errors.append(f'{path.name}: stale backend copy')
    if '/js/' in text or 'src="js/' in text or "src='js/" in text:
        errors.append(f'{path.name}: stale /js module reference')

required_assets = [
    'script.js',
    'config.js',
    'api.js',
    'store.js',
    'ui.js',
    'pages.js',
    'utils.js',
    'style.css',
    'v3.css',
    'identity.css',
]
for name in required_assets:
    if not (ROOT / name).exists():
        errors.append(f'missing {name}')

script = (ROOT / 'script.js').read_text(encoding='utf-8') if (ROOT / 'script.js').exists() else ''
if "loadStylesheet('seven-metros-v3-theme', 'v3.css')" not in script:
    errors.append('script.js: V3 theme is not loaded')
if "loadStylesheet('seven-metros-identity-theme', 'identity.css')" not in script:
    errors.append('script.js: identity theme is not loaded')

for css_name in ('v3.css', 'identity.css'):
    css_path = ROOT / css_name
    if css_path.exists():
        css = css_path.read_text(encoding='utf-8')
        if css.count('{') != css.count('}'):
            errors.append(f'{css_name}: unbalanced braces')

v3_path = ROOT / 'v3.css'
if v3_path.exists() and '@media' not in v3_path.read_text(encoding='utf-8'):
    errors.append('v3.css: responsive rules are missing')

identity_path = ROOT / 'identity.css'
if identity_path.exists():
    identity = identity_path.read_text(encoding='utf-8')
    if 'border-radius:0!important' not in identity:
        errors.append('identity.css: shields are still forced into rounded containers')
    if 'object-fit:contain!important' not in identity:
        errors.append('identity.css: shield normalization is missing')

if (ROOT / '.identity-placeholder').exists():
    errors.append('temporary identity placeholder must not ship')

if errors:
    print('VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print(f'✓ validate_site: {len(html_files)} HTML, enlaces, módulos, V3 e identidad de equipos OK')
