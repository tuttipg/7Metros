from pathlib import Path
from html.parser import HTMLParser
import re
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
    'script.js', 'config.js', 'api.js', 'store.js', 'ui.js', 'pages.js', 'features.js', 'utils.js',
    'style.css', 'v3.css', 'identity.css', 'features.css', 'competiciones.html'
]
for name in required_assets:
    if not (ROOT / name).exists():
        errors.append(f'missing {name}')

script = (ROOT / 'script.js').read_text(encoding='utf-8') if (ROOT / 'script.js').exists() else ''
for needle, label in [
    ("loadStylesheet('seven-metros-v3-theme', 'v3.css')", 'V3 theme'),
    ("loadStylesheet('seven-metros-identity-theme', 'identity.css')", 'identity theme'),
    ("loadStylesheet('seven-metros-features-theme', 'features.css')", 'features theme'),
    ("import('./features.js')", 'features module'),
]:
    if needle not in script:
        errors.append(f'script.js: {label} is not loaded')

# El frontend público de 7Metros es deliberadamente de solo lectura.
# Si alguien introduce una escritura REST accidental, CI debe bloquearla antes de publicar.
api_path = ROOT / 'api.js'
if api_path.exists():
    api = api_path.read_text(encoding='utf-8')
    methods = {m.upper() for m in re.findall(r"method\s*:\s*['\"]([A-Za-z]+)['\"]", api)}
    forbidden_methods = sorted(methods - {'GET', 'HEAD', 'OPTIONS'})
    if forbidden_methods:
        errors.append(
            'api.js: public frontend must remain read-only; forbidden HTTP methods: '
            + ', '.join(forbidden_methods)
        )
    for verb in ('POST', 'PUT', 'PATCH', 'DELETE'):
        if re.search(rf"\.\s*(insert|update|delete|upsert)\s*\(", api, re.IGNORECASE):
            errors.append('api.js: write-style Supabase call detected in public frontend')
            break

for css_name in ('v3.css', 'identity.css', 'features.css'):
    css_path = ROOT / css_name
    if css_path.exists():
        css = css_path.read_text(encoding='utf-8')
        if css.count('{') != css.count('}'):
            errors.append(f'{css_name}: unbalanced braces')

v3_path = ROOT / 'v3.css'
if v3_path.exists() and '@media' not in v3_path.read_text(encoding='utf-8'):
    errors.append('v3.css: responsive rules are missing')

features_css = ROOT / 'features.css'
if features_css.exists() and '@media' not in features_css.read_text(encoding='utf-8'):
    errors.append('features.css: responsive rules are missing')

identity_path = ROOT / 'identity.css'
if identity_path.exists():
    identity = identity_path.read_text(encoding='utf-8')
    if 'border-radius:0!important' not in identity:
        errors.append('identity.css: shields are still forced into rounded containers')
    if 'object-fit:contain!important' not in identity:
        errors.append('identity.css: shield normalization is missing')
    if ':has(>img)>span' not in identity or 'visibility:hidden' not in identity:
        errors.append('identity.css: shield fallback initials can overlap real crest images')
    if 'mix-blend-mode:normal!important' not in identity:
        errors.append('identity.css: legacy blend mode can contaminate transparent crests')

features_path = ROOT / 'features.js'
if features_path.exists():
    features = features_path.read_text(encoding='utf-8')
    for needle in ('renderCompetitionDirectory', 'renderClubProfile', 'renderMatchProfile', 'enhanceTeamLinks'):
        if needle not in features:
            errors.append(f'features.js: missing {needle}')

competition_page = ROOT / 'competiciones.html'
if competition_page.exists():
    text = competition_page.read_text(encoding='utf-8')
    if 'id="competition-directory"' not in text or 'data-page="competiciones"' not in text:
        errors.append('competiciones.html: competition directory root is missing')

if (ROOT / '.identity-placeholder').exists():
    errors.append('temporary identity placeholder must not ship')

if errors:
    print('VALIDATION FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)

print(f'✓ validate_site: {len(html_files)} HTML, enlaces, módulos, V3, identidad, perfiles y frontend read-only OK')
