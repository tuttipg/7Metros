#!/usr/bin/env python3
"""Read-only FEMEBAL public programming discovery.

Purpose: discover official programming pages and their PDF attachments without
LarrySport credentials or write operations. GET-only, femebal.com allowlist.
"""
from __future__ import annotations
import argparse, html, json, re
from dataclasses import dataclass, asdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ALLOWED_HOSTS = {"femebal.com", "www.femebal.com"}
PROGRAMACIONES_URL = "https://femebal.com/programaciones/"
UA = "7Metros-public-discovery/1.0 (+read-only; official-public-pages-only)"

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self._href=None; self._text=[]
    def handle_starttag(self, tag, attrs):
        if tag.lower()=="a":
            self._href=dict(attrs).get("href"); self._text=[]
    def handle_data(self, data):
        if self._href is not None: self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower()=="a" and self._href is not None:
            self.links.append((self._href, html.unescape(" ".join(self._text)).strip()))
            self._href=None; self._text=[]

@dataclass(frozen=True)
class Source:
    page_url: str
    title: str
    source_type: str
    phase: str|None
    round_number: int|None

@dataclass(frozen=True)
class PdfSource:
    page_url: str
    page_title: str
    pdf_url: str
    anchor_text: str
    source_type: str
    phase: str|None
    round_number: int|None


def _assert_allowed(url: str) -> None:
    p=urlparse(url)
    if p.scheme != "https" or p.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"URL fuera de allowlist: {url}")


def get_text(url: str, timeout=20) -> str:
    _assert_allowed(url)
    req=Request(url, headers={"User-Agent":UA, "Accept":"text/html,application/xhtml+xml,*/*"}, method="GET")
    with urlopen(req, timeout=timeout) as r:
        final=r.geturl(); _assert_allowed(final)
        return r.read().decode("utf-8", errors="replace")


def links_from_html(html_text: str):
    p=LinkParser(); p.feed(html_text); return p.links


def classify_page(url: str, title: str) -> Source|None:
    text=f"{title} {url}".lower()
    if "reprogram" in text:
        return Source(url,title,"reprogramacion",None,None)
    if "programacion" not in text and "programación" not in text:
        return None
    if "metropolitano" not in text:
        return None
    phase = "apertura" if "apertura" in text else "clausura" if "clausura" in text else None
    m=re.search(r"fecha[-\s]+(\d{1,2})", text)
    rnd=int(m.group(1)) if m else None
    return Source(url,title,"fecha_normal",phase,rnd)


def discover_pages(index_html: str, base=PROGRAMACIONES_URL):
    out={}
    for href,text in links_from_html(index_html):
        url=urljoin(base,href)
        try: _assert_allowed(url)
        except ValueError: continue
        src=classify_page(url,text)
        if src: out[url]=src
    return sorted(out.values(), key=lambda x:x.page_url)


def discover_pdfs(page_html: str, source: Source):
    out={}
    for href,text in links_from_html(page_html):
        url=urljoin(source.page_url,href)
        if not urlparse(url).path.lower().endswith(".pdf"): continue
        try: _assert_allowed(url)
        except ValueError: continue
        out[url]=PdfSource(source.page_url, source.title, url, text, source.source_type, source.phase, source.round_number)
    return sorted(out.values(), key=lambda x:x.pdf_url)


def build_manifest(index_html: str, page_html_by_url: dict[str,str]):
    pages=discover_pages(index_html)
    pdfs=[]
    for page in pages:
        if page.page_url in page_html_by_url:
            pdfs.extend(discover_pdfs(page_html_by_url[page.page_url], page))
    return {"safe":True,"write_enabled":False,"auth_used":False,"pages":[asdict(x) for x in pages],"pdfs":[asdict(x) for x in pdfs]}


def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--index-html"); ap.add_argument("--pages-dir"); ap.add_argument("--output", required=True)
    args=ap.parse_args()
    if args.index_html:
        idx=Path(args.index_html).read_text(encoding="utf-8")
    else:
        idx=get_text(PROGRAMACIONES_URL)
    pages=discover_pages(idx)
    mapping={}
    if args.pages_dir:
        d=Path(args.pages_dir)
        for p in pages:
            f=d/(re.sub(r"[^a-zA-Z0-9]+","_",p.page_url).strip("_")+".html")
            if f.exists(): mapping[p.page_url]=f.read_text(encoding="utf-8")
    else:
        for p in pages:
            try: mapping[p.page_url]=get_text(p.page_url)
            except Exception as e: mapping[p.page_url]=f"<!-- fetch failed: {e} -->"
    manifest=build_manifest(idx,mapping)
    Path(args.output).write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"pages":len(manifest["pages"]),"pdfs":len(manifest["pdfs"]),"write_enabled":False},ensure_ascii=False))

if __name__=="__main__": main()
