#!/usr/bin/env python3
from __future__ import annotations
import argparse, html, json, re
from dataclasses import dataclass, asdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qsl, urljoin, urlparse
from urllib.request import Request, HTTPRedirectHandler, build_opener

FEMEBAL_WEB_HOSTS={"femebal.com","www.femebal.com"}
FEMEBAL_PLANILLA_HOST="djfhz848yeeat.cloudfront.net"
PROGRAMACIONES_URL="https://femebal.com/programaciones/"
DEFAULT_SEEDS_FILE=Path(__file__).resolve().parents[1]/'config'/'femebal-public-page-seeds.json'
UA="7Metros-public-discovery/1.0 (+read-only; official-public-pages-only)"
MANIFEST_SCHEMA_VERSION=2
SEEDS_SCHEMA_VERSION=1
MAX_HTML_BYTES=2*1024*1024
DEFAULT_TIMEOUT_SECONDS=20
MAX_TIMEOUT_SECONDS=30
ALLOWED_HTML_MEDIA_TYPES={"text/html","application/xhtml+xml"}
TRACKING_QUERY_KEYS={"fbclid","gclid","dclid","msclkid","mc_cid","mc_eid"}
AMBIGUOUS_RAW_URL_CHARS=re.compile(r'[\\\x00-\x1f\x7f]')
STRICT_DECIMAL=re.compile(r'^\d+$')

class LinkParser(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]; self._href=None; self._text=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="a": self._href=dict(attrs).get("href"); self._text=[]
    def handle_data(self,data):
        if self._href is not None: self._text.append(data)
    def handle_endtag(self,tag):
        if tag.lower()=="a" and self._href is not None:
            self.links.append((self._href,html.unescape(" ".join(self._text)).strip())); self._href=None; self._text=[]

@dataclass(frozen=True)
class Source: page_url:str; title:str; source_type:str; phase:str|None; round_number:int|None
@dataclass(frozen=True)
class PdfSource: page_url:str; page_title:str; pdf_url:str; anchor_text:str; source_type:str; phase:str|None; round_number:int|None

def _has_ambiguous_raw_url_chars(url:str)->bool: return bool(AMBIGUOUS_RAW_URL_CHARS.search(str(url)))

def _assert_allowed(url:str, *, allow_planilla:bool=False)->None:
    if _has_ambiguous_raw_url_chars(url): raise ValueError(f"URL con caracteres ambiguos/normalizables rechazada: {url!r}")
    p=urlparse(url); allowed_hosts=set(FEMEBAL_WEB_HOSTS)
    if allow_planilla: allowed_hosts.add(FEMEBAL_PLANILLA_HOST)
    if p.scheme!="https" or p.hostname not in allowed_hosts: raise ValueError(f"URL fuera de allowlist: {url}")
    if p.username is not None or p.password is not None: raise ValueError(f"URL con userinfo rechazada: {url}")
    try: port=p.port
    except ValueError as e: raise ValueError(f"Puerto inválido: {url}") from e
    if port not in (None,443): raise ValueError(f"Puerto fuera de allowlist: {url}")

def _has_tracking_query(query:str)->bool:
    for key,_ in parse_qsl(query,keep_blank_values=True):
        normalized=key.lower()
        if normalized.startswith('utm_') or normalized in TRACKING_QUERY_KEYS: return True
    return False

def _canonical_official_page_url(url:str)->str:
    _assert_allowed(url); p=urlparse(url)
    if p.fragment: raise ValueError(f"URL FEMEBAL con fragmento rechazada: {url}")
    if _has_tracking_query(p.query): raise ValueError(f"URL FEMEBAL con tracking query rechazada: {url}")
    path=p.path or '/'; query=f"?{p.query}" if p.query else ''
    return f"https://{p.hostname}{path}{query}"

def _is_official_upload_pdf(url:str)->bool:
    if _has_ambiguous_raw_url_chars(url): return False
    p=urlparse(url)
    if p.scheme!="https" or p.query or p.fragment: return False
    if '%' in p.path or any(segment in {'.','..'} for segment in p.path.split('/')): return False
    wordpress_pdf=p.hostname in FEMEBAL_WEB_HOSTS and p.path.startswith('/wp-content/uploads/')
    planilla_pdf=p.hostname==FEMEBAL_PLANILLA_HOST and p.path.startswith('/pdf_planillas/')
    return (wordpress_pdf or planilla_pdf) and p.path.lower().endswith('.pdf')

def _canonical_official_pdf_url(url:str)->str:
    if not _is_official_upload_pdf(url): raise ValueError(f"PDF oficial fuera de allowlist: {url}")
    _assert_allowed(url,allow_planilla=True); p=urlparse(url); return f"https://{p.hostname}{p.path}"

class SafeRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        absolute=urljoin(req.full_url,newurl); canonical=_canonical_official_page_url(absolute)
        return super().redirect_request(req,fp,code,msg,headers,canonical)

def _validate_max_html_bytes(max_bytes:int)->int:
    if isinstance(max_bytes,bool) or not isinstance(max_bytes,int) or max_bytes < 1 or max_bytes > MAX_HTML_BYTES: raise ValueError(f"max_bytes HTML debe estar entre 1 y {MAX_HTML_BYTES}")
    return max_bytes

def _validate_timeout_seconds(timeout:int|float)->int|float:
    if isinstance(timeout,bool) or not isinstance(timeout,(int,float)) or timeout <= 0 or timeout > MAX_TIMEOUT_SECONDS: raise ValueError(f"timeout HTML debe estar entre >0 y {MAX_TIMEOUT_SECONDS} segundos")
    return timeout

def _validate_html_response(response, *, max_bytes:int=MAX_HTML_BYTES)->None:
    max_bytes=_validate_max_html_bytes(max_bytes); media_type=response.headers.get_content_type().lower()
    if media_type not in ALLOWED_HTML_MEDIA_TYPES: raise ValueError(f"Media type HTML no permitido: {media_type}")
    raw_encoding=response.headers.get('Content-Encoding')
    if raw_encoding is not None and str(raw_encoding).strip().lower() != 'identity': raise ValueError("Content-Encoding HTML no permitido")
    raw_length=response.headers.get('Content-Length')
    if raw_length is not None:
        normalized=str(raw_length).strip()
        if not STRICT_DECIMAL.fullmatch(normalized): raise ValueError("Content-Length HTML inválido")
        declared=int(normalized)
        if declared > max_bytes: raise ValueError(f"Respuesta HTML declarada fuera de límite: {declared} bytes")

def get_text(url:str,timeout=DEFAULT_TIMEOUT_SECONDS, *, max_bytes:int=MAX_HTML_BYTES)->str:
    max_bytes=_validate_max_html_bytes(max_bytes); timeout=_validate_timeout_seconds(timeout); canonical=_canonical_official_page_url(url)
    req=Request(canonical,headers={"User-Agent":UA,"Accept":"text/html,application/xhtml+xml","Accept-Encoding":"identity"},method="GET")
    with build_opener(SafeRedirectHandler()).open(req,timeout=timeout) as r:
        _canonical_official_page_url(r.geturl()); _validate_html_response(r,max_bytes=max_bytes); body=r.read(max_bytes+1)
        if len(body)>max_bytes: raise ValueError(f"Respuesta HTML excede límite de {max_bytes} bytes")
        return body.decode('utf-8',errors='replace')

def links_from_html(html_text:str): p=LinkParser(); p.feed(html_text); return p.links

def classify_page(url:str,title:str)->Source|None:
    text=f"{title} {url}".lower()
    if 'reprogram' in text: return Source(url,title,'reprogramacion',None,None)
    if 'programacion' not in text and 'programación' not in text: return None
    if 'metropolitano' not in text: return None
    phase='apertura' if 'apertura' in text else 'clausura' if 'clausura' in text else None
    m=re.search(r'fecha[-\s]+(\d{1,2})',text); rnd=int(m.group(1)) if m else None
    return Source(url,title,'fecha_normal',phase,rnd)

def discover_pages(index_html:str,base=PROGRAMACIONES_URL):
    out={}
    for href,text in links_from_html(index_html):
        raw_url=urljoin(base,href)
        try: url=_canonical_official_page_url(raw_url)
        except ValueError: continue
        src=classify_page(url,text)
        if src: out[url]=src
    return sorted(out.values(),key=lambda x:x.page_url)

def load_page_seeds(path:Path|str|None=DEFAULT_SEEDS_FILE)->list[Source]:
    if path is None: return []
    path=Path(path)
    if not path.exists(): raise FileNotFoundError(f'Archivo de seeds FEMEBAL solicitado no existe: {path}')
    if not path.is_file(): raise ValueError(f'Ruta de seeds FEMEBAL no es un archivo: {path}')
    payload=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(payload,dict) or payload.get('schema_version')!=SEEDS_SCHEMA_VERSION: raise ValueError('Archivo de seeds FEMEBAL inválido')
    if payload.get('safe') is not True or payload.get('auth_used') is not False or payload.get('write_enabled') is not False: raise ValueError('Seeds FEMEBAL sin contrato SAFE')
    pages=payload.get('pages')
    if not isinstance(pages,list): raise ValueError('Seeds FEMEBAL sin pages[]')
    out={}
    for raw in pages:
        if not isinstance(raw,str): raise ValueError('Seed FEMEBAL no textual')
        url=_canonical_official_page_url(raw)
        src=classify_page(url,url)
        if src is None: raise ValueError(f'Seed FEMEBAL fuera del scope de programación metropolitana: {url}')
        out[url]=src
    return sorted(out.values(),key=lambda x:x.page_url)

def merge_pages(index_pages:list[Source],seed_pages:list[Source])->list[Source]:
    out={x.page_url:x for x in index_pages}
    for seed in seed_pages:
        previous=out.get(seed.page_url)
        if previous is None: out[seed.page_url]=seed
        elif (previous.source_type,previous.phase,previous.round_number)!=(seed.source_type,seed.phase,seed.round_number): raise ValueError(f'Conflicto de metadata para seed FEMEBAL: {seed.page_url}')
    return sorted(out.values(),key=lambda x:x.page_url)

def discover_pdfs(page_html:str,source:Source):
    out={}
    for href,text in links_from_html(page_html):
        raw_url=urljoin(source.page_url,href)
        try: url=_canonical_official_pdf_url(raw_url)
        except ValueError: continue
        out[url]=PdfSource(source.page_url,source.title,url,text,source.source_type,source.phase,source.round_number)
    return sorted(out.values(),key=lambda x:x.pdf_url)

def _pdf_source_identity(source:PdfSource): return (source.page_url,source.source_type,source.phase,source.round_number)

def _dedupe_manifest_pdfs(pdfs:list[PdfSource]):
    by_url={}; conflicted=set(); errors=[]
    for source in pdfs:
        url=source.pdf_url
        if url in conflicted: continue
        previous=by_url.get(url)
        if previous is None: by_url[url]=source; continue
        if _pdf_source_identity(previous)==_pdf_source_identity(source): continue
        conflicted.add(url); del by_url[url]
        errors.append({"stage":"metadata_conflict","url":url,"error":"contradictory_pdf_provenance","sources":[{"page_url":previous.page_url,"source_type":previous.source_type,"phase":previous.phase,"round_number":previous.round_number},{"page_url":source.page_url,"source_type":source.source_type,"phase":source.phase,"round_number":source.round_number}]})
    return sorted(by_url.values(),key=lambda x:x.pdf_url),errors

def build_manifest(index_html:str,page_html_by_url:dict[str,str],fetch_errors:list[dict]|None=None, *, seed_pages:list[Source]|None=None):
    pages=merge_pages(discover_pages(index_html),seed_pages or []); discovered=[]
    for page in pages:
        if page.page_url in page_html_by_url: discovered.extend(discover_pdfs(page_html_by_url[page.page_url],page))
    pdfs,metadata_errors=_dedupe_manifest_pdfs(discovered); errors=list(fetch_errors or [])+metadata_errors
    return {"schema_version":MANIFEST_SCHEMA_VERSION,"safe":True,"write_enabled":False,"auth_used":False,"complete":len(errors)==0,"pages":[asdict(x) for x in pages],"pdfs":[asdict(x) for x in pdfs],"fetch_errors":errors}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--index-html'); ap.add_argument('--pages-dir'); ap.add_argument('--seeds-file',default=str(DEFAULT_SEEDS_FILE)); ap.add_argument('--no-seeds',action='store_true'); ap.add_argument('--output',required=True); args=ap.parse_args()
    idx=Path(args.index_html).read_text(encoding='utf-8') if args.index_html else get_text(PROGRAMACIONES_URL)
    seed_pages=[] if args.no_seeds else load_page_seeds(args.seeds_file)
    pages=merge_pages(discover_pages(idx),seed_pages); mapping={}; fetch_errors=[]
    if args.pages_dir:
        d=Path(args.pages_dir)
        for p in pages:
            f=d/(re.sub(r'[^a-zA-Z0-9]+','_',p.page_url).strip('_')+'.html')
            if f.exists(): mapping[p.page_url]=f.read_text(encoding='utf-8')
            else: fetch_errors.append({"stage":"fixture_file","url":p.page_url,"error":"missing_fixture_html"})
    else:
        for p in pages:
            try: mapping[p.page_url]=get_text(p.page_url)
            except Exception as e: fetch_errors.append({"stage":"fetch_page","url":p.page_url,"error":type(e).__name__})
    manifest=build_manifest(idx,mapping,fetch_errors,seed_pages=seed_pages); Path(args.output).write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({"pages":len(manifest['pages']),"seed_pages":len(seed_pages),"pdfs":len(manifest['pdfs']),"fetch_errors":len(manifest['fetch_errors']),"complete":manifest['complete'],"write_enabled":False},ensure_ascii=False))

if __name__=='__main__': main()