import assert from 'node:assert/strict';
import { buildPlanillaPreproductionPreview } from './preproduction-pipeline-core.mjs';

const sourceUrl = 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/5/c/e/5ce377051ea0acb1.pdf';
const workItem = {
  kind: 'femebal_official_pdf', method: 'GET', url: sourceUrl,
  allow_redirects: false, auth_used: false, write_enabled: false,
  source: {
    page_url: 'https://femebal.com/programacion-fecha-1-torneo-metropolitano-apertura-2026/',
    pdf_url: sourceUrl,
    document_type: 'planilla_partido_pdf',
    provenance: 'public_explicit_link',
    source_type: 'fecha_normal',
  },
};
const players = `Nº Local G TAm 2 TR TAz
1 Uno, Local 20 - - - -
Nº Visitante G TAm 2 TR TAz
1 Uno, Visitante 27 - - - -
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
const expected = { fecha: '2026-03-21', local: 'Argentinos Juniors', visitante: 'Ferro Carril Oeste', goles_local: 20, goles_visitante: 27 };
const mapping = { local_equipo_id: 3, visitante_equipo_id: 1 };

const result = buildPlanillaPreproductionPreview({ workItem, extractedText, expected, mapping });
assert.equal(result.safe, true);
assert.equal(result.dry_run, true);
assert.equal(result.write_enabled, false);
assert.equal(result.production_write_allowed, false);
assert.deepEqual(result.stages, { planilla_parsed: true, expected_match_validated: true, pre_supabase_gate_passed: true, preview_built: true });
assert.equal(result.preview.executable_request, false);
assert.equal(result.preview.target, null);
assert.equal(result.preview.operation, 'preview_only');
assert.equal(result.preview.payload.fecha, '2026-03-21');
assert.equal(result.preview.payload.local_equipo_id, 3);
assert.equal(result.preview.payload.visitante_equipo_id, 1);
assert.equal(result.preview.payload.goles_local, 20);
assert.equal(result.preview.payload.goles_visitante, 27);
assert.equal(result.preview.payload.fuente_planilla, sourceUrl);

assert.throws(() => buildPlanillaPreproductionPreview({ workItem, extractedText, mapping }), /identidad esperada/);
assert.throws(() => buildPlanillaPreproductionPreview({ workItem, extractedText, expected: { ...expected, goles_visitante: 26 }, mapping }), /Marcador visitante inesperado/);
assert.throws(() => buildPlanillaPreproductionPreview({ workItem, extractedText, expected, mapping: { local_equipo_id: 3, visitante_equipo_id: 3 } }), /no pueden compartir equipo_id/);
assert.throws(() => buildPlanillaPreproductionPreview({ workItem: { ...workItem, auth_used: true }, extractedText, expected, mapping }), /autenticación/);
assert.throws(() => buildPlanillaPreproductionPreview({ workItem: { ...workItem, write_enabled: true }, extractedText, expected, mapping }), /escritura/);

console.log('✓ pipeline FEMEBAL -> validación -> preview pre-Supabase SAFE/DRY RUN validado');
