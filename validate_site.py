from pathlib import Path
from html.parser import HTMLParser
import re, sys

ROOT = Path(__file__).resolve().parents[1]
errors=[]

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.ids=set(); self.title=False
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if 'id' in d:
            if d['id'] in self.ids: errors.append(f'duplicate id: {d["id"]}')
            self.ids.add(d['id'])
        if tag in ('a','link','script','img'):
            attr={'a':'href','link':'href','script':'src','img':'src'}[tag]
            if d.get(attr): self.links.append(d[attr])

html_files=sorted(ROOT.glob('*.html'))
assert html_files, 'No HTML files found'
for path in html_files:
    parser=Parser(); parser.feed(path.read_text(encoding='utf-8'))
    for ref in parser.links:
        if ref.startswith(('http://','https://','#','mailto:','tel:','javascript:')): continue
        local=ref.split('?')[0].split('#')[0]
        if not local: continue
        target=(path.parent/local).resolve()
        if not target.exists(): errors.append(f'{path.name}: missing reference {ref}')
    text=path.read_text(encoding='utf-8')
    if 'APERTURA 2026' in text: errors.append(f'{path.name}: stale APERTURA 2026 text')
    if 'Flask + SQLite' in text or 'conectemos el backend' in text: errors.append(f'{path.name}: stale backend copy')

for js in [ROOT/'script.js', *sorted((ROOT/'js').glob('*.js'))]:
    if not js.exists(): errors.append(f'missing {js.relative_to(ROOT)}')

if errors:
    print('VALIDATION FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print(f'✓ validate_site: {len(html_files)} HTML, enlaces locales y textos base OK')
