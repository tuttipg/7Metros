import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPdfExtractionEnvelope, validatePdfExtractionEnvelope, parseExtractionWithEnvelopeDryRun } from './pdf-extraction-wiring.mjs';

const sourceUrl='https://femebal.com/wp-content/uploads/2026/03/control.pdf';
const workItem={kind:'femebal_official_pdf',method:'GET',url:sourceUrl,allow_redirects:false,auth_used:false,write_enabled:false,source:{page_url:'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',page_title:'Programación Fecha 1',pdf_url:sourceUrl,anchor_text:'Sábado 21/3',source_type:'fecha_normal',phase:'apertura',round_number:1}};
const bytes=new TextEncoder().encode('%PDF-1.7 control fixture bytes');
const sha256=createHash('sha256').update(bytes).digest('hex');
const pdfArtifact={dry_run:true,write_enabled:false,auth_used:false,source_url:sourceUrl,content_type:'application/pdf',byte_length:bytes.byteLength,sha256,bytes};
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
assert.throws(()=>validatePdfExtractionEnvelope({...envelope,work_item:{...envelope.work_item,url:'https://femebal.com/wp-content/uploads/2026/03/otro.pdf'}},workItem),/snapshot no coincide/);
assert.throws(()=>parseExtractionWithEnvelopeDryRun({workItem:{...workItem,write_enabled:true},envelope,extraction:{text}}),/no puede habilitar escritura|snapshot no coincide/);
assert.throws(()=>parseExtractionWithEnvelopeDryRun({workItem,envelope,extraction:{text},expected:{goles_visitante:26}}),/Marcador visitante inesperado/);
console.log('✓ n8n PDF wiring envelope + SHA-256 rejoin + partido control validados');
