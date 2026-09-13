import assert from 'node:assert/strict';
import { buildDiscoveryPdfWorkItems } from './discovery-manifest-bridge.mjs';
import { fetchOfficialFemebalPdf } from './official-pdf-fetch-core.mjs';
import { buildPdfExtractionEnvelope, parseExtractionWithEnvelopeDryRun } from './pdf-extraction-wiring.mjs';

const CONTROL_PDF = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const CONTROL_PAGE = 'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/';

const manifest = {
  schema_version: 2,
  safe: true,
  complete: true,
  write_enabled: false,
  auth_used: false,
  pages: [],
  fetch_errors: [],
  pdfs: [{
    page_url: CONTROL_PAGE,
    page_title: 'Programación Fecha 1 – Torneo Metropolitano Apertura 2026',
    pdf_url: CONTROL_PDF,
    anchor_text: 'Sábado 21-3',
    source_type: 'fecha_normal',
    phase: 'apertura',
    round_number: 1,
  }],
};

const players = `Nº Local G TAm 2 TR TAz
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

const extractedText = `Torneo Metropolitano Apertura
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

const pdfBytes = new TextEncoder().encode('%PDF-1.7\n7Metros deterministic SAFE control fixture\n%%EOF');
let fetchCalls = 0;
let observedUrl = null;
let observedInit = null;

const fetchImpl = async (url, init) => {
  fetchCalls += 1;
  observedUrl = url;
  observedInit = init;
  return {
    status: 200,
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === 'content-type') return 'application/pdf';
        if (key === 'content-length') return String(pdfBytes.byteLength);
        return null;
      },
    },
    async arrayBuffer() {
      return pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
    },
  };
};

const [workItem] = buildDiscoveryPdfWorkItems(manifest);
assert.ok(workItem);
assert.equal(workItem.url, CONTROL_PDF);
assert.equal(workItem.method, 'GET');
assert.equal(workItem.allow_redirects, false);
assert.equal(workItem.auth_used, false);
assert.equal(workItem.write_enabled, false);

const artifact = await fetchOfficialFemebalPdf(workItem, { fetchImpl });
assert.equal(fetchCalls, 1);
assert.equal(observedUrl, CONTROL_PDF);
assert.equal(observedInit.method, 'GET');
assert.equal(observedInit.redirect, 'manual');
assert.equal(observedInit.credentials, 'omit');
assert.deepEqual(Object.keys(observedInit.headers), ['Accept']);
assert.equal(observedInit.headers.Accept, 'application/pdf');
assert.equal(artifact.source_url, CONTROL_PDF);
assert.equal(artifact.dry_run, true);
assert.equal(artifact.write_enabled, false);
assert.equal(artifact.auth_used, false);
assert.match(artifact.sha256, /^[0-9a-f]{64}$/);

const envelope = buildPdfExtractionEnvelope({ workItem, pdfArtifact: artifact });
assert.equal(envelope.correlation_id, artifact.sha256);
assert.equal(envelope.provenance.source_url, CONTROL_PDF);
assert.equal(envelope.write_enabled, false);
assert.equal(envelope.auth_used, false);

const result = parseExtractionWithEnvelopeDryRun({
  workItem,
  envelope,
  extraction: { text: extractedText, numpages: 2 },
  expected: {
    fecha: '2026-03-21',
    local: 'Argentinos Juniors',
    visitante: 'Ferro Carril Oeste',
    goles_local: 20,
    goles_visitante: 27,
  },
});

assert.equal(result.parsed.resumen.jugadores, 32);
assert.equal(result.parsed.resumen.goles, 47);
assert.equal(result.correlation_id, artifact.sha256);
assert.equal(result.provenance.sha256, artifact.sha256);
assert.equal(result.extraction.source_sha256, artifact.sha256);
assert.equal(result.wiring.mode, 'safe_envelope_rejoin');
assert.equal(result.wiring.dry_run, true);
assert.equal(result.wiring.write_enabled, false);
assert.equal(result.wiring.auth_used, false);

console.log('✓ SAFE E2E FEMEBAL: manifest → GET-only PDF → SHA-256 → envelope → parser control 20–27');
