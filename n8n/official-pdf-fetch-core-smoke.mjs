import assert from 'node:assert/strict';
import { fetchOfficialFemebalPdf } from './official-pdf-fetch-core.mjs';

function workItem(overrides={}) {
  const url=overrides.url??'https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf';
  return {kind:'femebal_official_pdf',method:'GET',allow_redirects:false,auth_used:false,write_enabled:false,url,source:{pdf_url:url,page_url:'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',source_type:'fecha_normal',phase:'apertura',round_number:1},...overrides};
}
const pdfBytes=new TextEncoder().encode('%PDF-1.7\nfixture');
const headers=values=>({get(name){return Object.fromEntries(Object.entries(values).map(([k,v])=>[k.toLowerCase(),String(v)]))[String(name).toLowerCase()]??null;}});
const fakeResponse=({status=200,contentType='application/pdf',contentLength=pdfBytes.byteLength,body=pdfBytes}={})=>({status,headers:headers({'content-type':contentType,'content-length':contentLength}),async arrayBuffer(){return body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength);}});

let seen=null;
const out=await fetchOfficialFemebalPdf(workItem(),{fetchImpl:async(url,options)=>{seen={url,options};return fakeResponse();}});
assert.equal(out.dry_run,true); assert.equal(out.write_enabled,false); assert.equal(out.auth_used,false);
assert.equal(out.sha256,'f581fc87f30296eff11777c3ce1b9a8b7077071ad8abedfcba317fef0c807224');
assert.match(out.sha256,/^[0-9a-f]{64}$/);
assert.equal(seen.options.method,'GET'); assert.equal(seen.options.redirect,'manual'); assert.equal(seen.options.credentials,'omit');
assert.deepEqual(seen.options.headers,{Accept:'application/pdf'}); assert.equal('Authorization' in seen.options.headers,false); assert.equal('Cookie' in seen.options.headers,false);
await assert.rejects(()=>fetchOfficialFemebalPdf(workItem(),{fetchImpl:async()=>fakeResponse({status:302})}),/Redirect/);
await assert.rejects(()=>fetchOfficialFemebalPdf(workItem(),{fetchImpl:async()=>fakeResponse({contentType:'text\/html'})}),/Content-Type/);
await assert.rejects(()=>fetchOfficialFemebalPdf(workItem(),{fetchImpl:async()=>fakeResponse({contentLength:pdfBytes.byteLength+1})}),/Content-Length no coincide/);
let networkCalled=false;
await assert.rejects(()=>fetchOfficialFemebalPdf(workItem({url:'https://evil.example/wp-content/uploads/x.pdf',source:{pdf_url:'https://evil.example/wp-content/uploads/x.pdf'}}),{fetchImpl:async()=>{networkCalled=true;return fakeResponse();}}),/allowlist/);
assert.equal(networkCalled,false);
console.log('✓ official PDF fetch core SAFE/fail-closed + SHA-256 provenance OK');
