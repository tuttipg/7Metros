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
SENSITIVE_QUERY_KEYS={"auth","authorization","bearer","cookie","credential","credentials","csrf","xsrf","jwt","key","password","secret","session","token"}
SENSITIVE_QUERY_SUFFIXES=("apikey","authkey","credential","credentials","password","privatekey","secret","sessionid","token")
AMBIGUOUS_RAW_URL_CHARS=re.compile(r'[\\\x00-\x1f\x7f]')
STRICT_DECIMAL=re.compile(r'^\d+$')
DOCUMENT_TYPES=('programacion_pdf','planilla_partido_pdf')
PUBLIC_EXPLICIT_LINK_PROVENANCE='public_explicit_link'

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
class PdfSource: page_url:str; page_title:str; pdf_url:str; anchor_text:str; document_type:str; source_type:str; phase:str|None; round_number:int|None; provenance:str

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

def _has_sensitive_query(query:str)->bool:
    for key,_ in parse_qsl(query,keep_blank_values=True):
        normalized=re.sub(r'[^a-z0-9]','',key.lower())
        if normalized in SENSITIVE_QUERY_KEYS or any(normalized.endswith(suffix) for suffix in SENSITIVE_QUERY_SUFFIXES): return True
    return False

def _canonical_official_page_url(url:str)->str:
    _assert_allowed(url); p=urlparse(url)
    if p.fragment: raise ValueError(f"URL FEMEBAL con fragmento rechazada: {url}")
    if _has_tracking_query(p.query): raise ValueError(f"URL FEMEBAL con tracking query rechazada: {url}")
    if _has_sensitive_query(p.query): raise ValueError(f"URL FEMEBAL con query sensible rechazada: {url}")
    path=p.path or '/'; query=f"?{p.query}" if p.query else ''
    return f"https://{p.hostname}{path}{query}"

def _document_type_for_official_pdf(url:str)->str|None:
    if _has_ambiguous_raw_url_chars(url): return None
    p=urlparse(url)
    if p.scheme!="https" or p.query or p.fragment: return None
    if '%' in p.path or any(segment in {'.','..'} for segment in p.path.split('/')): return None
    if not p.path.lower().endswith('.pdf'): return None
    if p.hostname in FEMEBAL_WEB_HOSTS and p.path.startswith('/wp-content/uploads/'): return 'programacion_pdf'
    if p.hostname==FEMEBAL_PLANILLA_HOST and p.path.startswith('/pdf_planillas/'): return 'planilla_partido_pdf'
    return None

def _is_official_upload_pdf(url:str)->bool: return _document_type_for_official_pdf(url) is not None

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
    phase='apertura' if 'apertura' in text else ('clausura' if 'clausura' in text else None)
    m=re.search(r'(?:fecha|jornada|f)[\s_-]*(\d{1,2})',text); rnd=int(m.group(1)) if m else None
    return Source(url,title,'programacion',phase,rnd)

def discover_sources(index_url:str=PROGRAMACIONES_URL)->list[Source]:
    index_url=_canonical_official_page_url(index_url); html_text=get_text(index_url); out=[]
    for href,text in links_from_html(html_text):
        u=urljoin(index_url,href)
        try: canonical=_canonical_official_page_url(u)
        except ValueError: continue
        s=classify_page(canonical,text)
        if s: out.append(s)
    return out

def discover_pdfs(source:Source)->list[PdfSource]:
    html_text=get_text(source.page_url); out=[]
    for href,text in links_from_html(html_text):
        u=urljoin(source.page_url,href); document_type=_document_type_for_official_pdf(u)
        if document_type:
            canonical=_canonical_official_pdf_url(u)
            out.append(PdfSource(source.page_url,source.title,canonical,text,document_type,source.source_type,source.phase,source.round_number,PUBLIC_EXPLICIT_LINK_PROVENANCE))
    return out

def _load_seed_sources(path:Path=DEFAULT_SEEDS_FILE)->list[Source]:
    if not path.is_file(): raise ValueError(f"Archivo de seeds inexistente/no regular: {path}")
    payload=json.loads(path.read_text(encoding='utf-8'))
    if payload.get('schema_version') != SEEDS_SCHEMA_VERSION: raise ValueError('schema_version de seeds no soportado')
    out=[]
    for item in payload.get('sources',[]):
        page_url=_canonical_official_page_url(item['page_url'])
        out.append(Source(page_url,item['title'],item['source_type'],item.get('phase'),item.get('round_number')))
    return out

def build_manifest(sources:list[Source])->dict:
    pdfs=[]; failures=[]
    for source in sources:
        try: pdfs.extend(discover_pdfs(source))
        except Exception as exc: failures.append({'page_url':source.page_url,'error':str(exc)})
    by_url={}
    for item in pdfs:
        existing=by_url.get(item.pdf_url)
        if existing and existing != item: raise ValueError(f"Proveniencia contradictoria para PDF: {item.pdf_url}")
        by_url[item.pdf_url]=item
    items=sorted(by_url.values(),key=lambda x:(x.document_type,x.pdf_url))
    counts={doc_type:sum(1 for item in items if item.document_type==doc_type) for doc_type in DOCUMENT_TYPES}
    return {'schema_version':MANIFEST_SCHEMA_VERSION,'safe':True,'dry_run':True,'write_enabled':False,'complete':not failures,'fetch_failures':failures,'document_type_counts':counts,'items':[asdict(x) for x in items]}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--seeds',type=Path,default=DEFAULT_SEEDS_FILE); args=parser.parse_args()
    sources=_load_seed_sources(args.seeds); print(json.dumps(build_manifest(sources),ensure_ascii=False,indent=2))

if __name__=='__main__': main()
