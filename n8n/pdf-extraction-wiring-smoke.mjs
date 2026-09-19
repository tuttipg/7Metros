import assert from 'node:assert/strict';
import { buildDiscoveryPdfWorkItems } from './discovery-manifest-bridge.mjs';
import { fetchOfficialFemebalPdf } from './official-pdf-fetch-core.mjs';
import { buildPdfExtractionEnvelope, validatePdfExtractionEnvelope, parseExtractionWithEnvelopeDryRun } from './pdf-extraction-wiring.mjs';

const sourceUrl='https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const manifest={schema_version:2,safe:true,complete:true,write_enabled:false,auth_used:false,pages:[],fetch_errors:[],pdfs:[{page_url:'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',page_title:'Programación Fecha 1',pdf_url:sourceUrl,anchor_text:'Sábado 21/3',source_type:'fecha_normal',phase:'apertura',round_number:1,provenance:'public_explicit_link'}]};
const [workItem]=buildDiscoveryPdfWorkItems(manifest);
assert.ok(workItem);
assert.equal(workItem.url,sourceUrl);
assert.equal(workItem.method,'GET');
assert.equal(workItem.allow_redirects,false);
assert.equal(workItem.auth_used,false);
assert.equal(workItem.write_enabled,false);
assert.equal(workItem.source.provenance,'public_explicit_link');

const bytes=new TextEncoder().encode('%PDF-1.7 control fixture bytes');
let fetchCalls=0;
let observedInit=null;
const pdfArtifact=await fetchOfficialFemebalPdf(workItem,{fetchImpl:async(url,init)=>{
  fetchCalls+=1;
  assert.equal(url,sourceUrl);
  observedInit=init;
  let read=false;
  return {
    status:200,
    headers:{get(name){const key=String(name).toLowerCase();if(key==='content-type') return 'application/pdf';if(key==='content-length') return String(bytes.byteLength);return null;}},
    body:{getReader(){return {async read(){if(read)return {done:true,value:undefined};read=true;return {done:false,value:bytes};},releaseLock(){}};}},
  };
}});
assert.equal(fetchCalls,1);
assert.equal(observedInit.method,'GET');
assert.equal(observedInit.redirect,'manual');
assert.equal(observedInit.credentials,'omit');
assert.deepEqual(Object.keys(observedInit.headers),['Accept']);
assert.equal(observedInit.headers.Accept,'application/pdf');
assert.equal(pdfArtifact.source_url,sourceUrl);
assert.equal(pdfArtifact.dry_run,true);
assert.equal(pdfArtifact.write_enabled,false);
assert.equal(pdfArtifact.auth_used,false);
const sha256=pdfArtifact.sha256;
assert.match(sha256,/^[0-9a-f]{64}$/);

const players=`Nº Local G TAm 2 TR TAz
1 Perznianko, Alan Nahuel - - - - -
2 Berardinelli, Mauro 2 - - - -
4 Sportelli Blejman, Lucas 2 - - - -
5 Gullo, Santino - - - - -
7 Dujaut, Ian 5 - 1 - -
8 Ghiotto, Matias - - - - -
9 Pereyra Oyarzun, Tobias - - - 1 -
10 Labartete, Ramiro - - - - -
11 Kelly, Steven 1 - - - -
13 Vazquez, Antonio 5 - - - -
14 Vienni, Enzo 1 - - - -
16 Trabella Ponce, Luciano - - - - -
17 Gimenez, Mateo 1 - 1 - -
18 Lugaro, Lautaro Nicolas - - - - -
33 Ochnio, Agustin 2 - - - -
37 Ingram Pautazzo, Eric Jhon 1 - - - -
Nº Visitante G TAm 2 TR TAz
1 Bartolomeo, Juan Martin - - - - -
2 Farina, Martin 1 - - - -
3 Goni, Ignacio - - - - -
4 Duhau, Santiago 1 - - - -
5 Cocco, Atilio - - 1 - -
6 Pallero, Federico Agustin 2 - - - -
8 Schankula, Valentin 6 - 1 - -
9 Bustamante, Mariano 1 - - - -
10 Ceccardi, Juan Francisco 4 - - - -
11 Santos, Julian 1 - - - -
12 Vazquez Palmieri, Fausto - - - - -
14 Umansky Gavi, Ivan Luca - - - - -
17 Unzner, Agustin 8 - - - -
19 Jacquemin, Matias - - - - -
21 Rubio, Emiliano 2 - - - -
22 Aguero, Juan Pablo 1 - - - -
Arbitros`;
const text=`Torneo Metropolitano Apertura
Fecha:
2026-03-21
Hora:
20:15:00
Categoria - Division:
Mayores - LHC Hipotecario Seguros
Equipo local
Argentinos Juniors 20
Equipo visitante
Ferro Carril Oeste 27
${players}`;

const envelope=buildPdfExtractionEnvelope({workItem,pdfArtifact});
assert.equal(envelope.correlation_id,sha256);
assert.equal(envelope.provenance.sha256,sha256);
assert.equal(envelope.work_item.url,sourceUrl);
assert.equal(envelope.write_enabled,false);
const validated=validatePdfExtractionEnvelope(envelope,workItem);
assert.equal(validated.correlation_id,sha256);

const result=parseExtractionWithEnvelopeDryRun({workItem,envelope,extraction:{text,numpages:2},expected:{fecha:'2026-03-21',local:'Argentinos Juniors',visitante:'Ferro Carril Oeste',goles_local:20,goles_visitante:27}});
assert.equal(result.parsed.resumen.jugadores,32);
assert.equal(result.parsed.resumen.goles,47);
assert.equal(result.correlation_id,sha256);
assert.equal(result.provenance.sha256,sha256);
assert.equal(result.extraction.source_sha256,sha256);
assert.equal(result.wiring.mode,'safe_envelope_rejoin');

assert.throws(()=>buildPdfExtractionEnvelope({workItem,pdfArtifact:{...pdfArtifact,bytes:undefined}}),/sin bytes/);
assert.throws(()=>buildPdfExtractionEnvelope({workItem,pdfArtifact:{...pdfArtifact,byte_length:bytes.byteLength+1}}),/byte_length no coincide/);
const alteredBytes=new TextEncoder().encode('%PDF-1.7 different bytes');
assert.throws(()=>buildPdfExtractionEnvelope({workItem,pdfArtifact:{...pdfArtifact,bytes:alteredBytes,byte_length:alteredBytes.byteLength}}),/SHA-256 no coincide/);
assert.throws(()=>validatePdfExtractionEnvelope({...envelope,correlation_id:'a'.repeat(64)},workItem),/correlation_id no coincide/);
assert.throws(()=>validatePdfExtractionEnvelope({...envelope,write_enabled:true},workItem),/no es SAFE/);
assert.throws(()=>validatePdfExtractionEnvelope({...envelope,work_item:{...envelope.work_item,url:'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/otro.pdf'}},workItem),/snapshot no coincide/);
assert.throws(()=>parseExtractionWithEnvelopeDryRun({workItem:{...workItem,write_enabled:true},envelope,extraction:{text}}),/no puede habilitar escritura|snapshot no coincide/);
assert.throws(()=>parseExtractionWithEnvelopeDryRun({workItem,envelope,extraction:{text},expected:{goles_visitante:26}}),/Marcador visitante inesperado/);
console.log('✓ SAFE E2E FEMEBAL: manifest → GET-only streaming PDF → SHA-256 → envelope → parser control 20–27');
