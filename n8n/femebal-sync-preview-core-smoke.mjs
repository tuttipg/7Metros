import assert from 'node:assert/strict';
import {
  summarizeFemebalCoverage,
  buildMatchResultPreviewDryRun,
  buildClubLogoPreviewDryRun,
  buildIntegrationBatchPreview,
} from './femebal-sync-preview-core.mjs';

const current = summarizeFemebalCoverage({
  matchesTotal: 2689,
  matchesWithCompleteScore: 0,
  clubsTotal: 107,
  clubsMissingLogo: 19,
  clubsBrokenLogo: null,
});
assert.equal(current.matches.without_complete_score, 2689);
assert.equal(current.matches.complete_score_pct, 0);
assert.equal(current.clubs.with_logo_url, 88);
assert.equal(current.clubs.logo_url_coverage_pct, 82.24);
assert.equal(current.clubs.render_health_complete, false);

const internalMatch = {
  partidoId: 501,
  temporadaId: 9,
  localEquipoId: 7001,
  visitanteEquipoId: 7002,
  estado: 'programado',
  golesLocal: null,
  golesVisitante: null,
};
const idMap = {
  tournamentId: 1204,
  temporadaId: 9,
  homeTeamId: 4101,
  localEquipoId: 7001,
  awayTeamId: 4102,
  visitanteEquipoId: 7002,
};
const source = {
  type: 'femebal_official_result',
  url: 'https://femebal.com/tournament-tracker/example',
  observedAt: '2026-11-08T20:00:00-03:00',
};
const planillaSource = {
  type: 'femebal_official_match_sheet',
  url: 'https://femebal.com/documentos/example',
  observedAt: '2026-11-08T20:01:00-03:00',
};

const blocked = buildMatchResultPreviewDryRun({
  internalMatch,
  idMap,
  finding: {
    matchId: null,
    status: 'finalizado',
    homeScore: 31,
    awayScore: 29,
    source,
  },
});
assert.equal(blocked.action, 'blocked_missing_official_match_id');
assert.equal(blocked.write_enabled, false);
assert.equal(blocked.requires_human_approval, false);

const finding = {
  matchId: 88001,
  tournamentId: 1204,
  homeTeamId: 4101,
  awayTeamId: 4102,
  matchSheetId: 99001,
  status: 'finalizado',
  homeScore: 31,
  awayScore: 29,
  source,
  planillaUrl: 'https://djfhz848yeeat.cloudfront.net/pdf_planillas/a/b/c/example.pdf',
  planillaSource,
  participantSummary: { homeGoals: 31, awayGoals: 29 },
};
const update = buildMatchResultPreviewDryRun({ internalMatch, idMap, finding });
assert.equal(update.action, 'would_update_result');
assert.equal(update.write_enabled, false);
assert.equal(update.official_ids.matchId, '88001');
assert.equal(update.internal_ids.partidoId, '501');
assert.equal(update.proposed.estado, 'finalizado');
assert.equal(update.proposed.goles_local, 31);
assert.equal(update.proposed.goles_visitante, 29);
assert.equal(update.requires_human_approval, true);

const updateAgain = buildMatchResultPreviewDryRun({ internalMatch, idMap, finding });
assert.equal(updateAgain.idempotency_key, update.idempotency_key);

const noop = buildMatchResultPreviewDryRun({
  internalMatch: {...internalMatch, estado:'finalizado', golesLocal:31, golesVisitante:29},
  idMap,
  finding,
});
assert.equal(noop.action, 'noop_already_matches');
assert.equal(noop.requires_human_approval, false);

const conflict = buildMatchResultPreviewDryRun({
  internalMatch: {...internalMatch, estado:'finalizado', golesLocal:30, golesVisitante:29},
  idMap,
  finding,
});
assert.equal(conflict.action, 'review_required_result_conflict');
assert.equal(conflict.conflict.current.homeScore, 30);

assert.throws(
  () => buildMatchResultPreviewDryRun({
    internalMatch,
    idMap,
    finding: {...finding, participantSummary:{homeGoals:30,awayGoals:29}},
  }),
  /no coincide con el marcador/,
);
assert.throws(
  () => buildMatchResultPreviewDryRun({
    internalMatch,
    idMap: {...idMap, localEquipoId:7999},
    finding,
  }),
  /inconsistente/,
);

const logoSource = {
  type: 'larrysport_official_club_asset',
  url: 'https://api.femebal.cam.larrysport.tecdata.net/clubs/335',
  observedAt: '2026-11-08T20:05:00-03:00',
};
const assetValidation = {
  httpStatus: 200,
  contentType: 'image/png',
  bytes: 12345,
  sha256: 'a'.repeat(64),
  browserRenderable: true,
  checkedAt: '2026-11-08T20:06:00-03:00',
};
const logoFinding = {
  clubId: 335,
  logoUrl: 'https://djfhz848yeeat.cloudfront.net/images/federacion/b/3/c/example.png',
  source: logoSource,
  assetValidation,
};
const logoMap = { femebalClubId:335, internalClubId:12 };

const fill = buildClubLogoPreviewDryRun({
  internalClub:{clubId:12,logoUrl:null},
  idMap:logoMap,
  finding:logoFinding,
});
assert.equal(fill.action, 'would_fill_missing_logo');
assert.equal(fill.write_enabled, false);
assert.equal(fill.requires_human_approval, true);

const logoNoop = buildClubLogoPreviewDryRun({
  internalClub:{clubId:12,logoUrl:logoFinding.logoUrl},
  idMap:logoMap,
  finding:logoFinding,
});
assert.equal(logoNoop.action, 'noop_already_matches');

const replace = buildClubLogoPreviewDryRun({
  internalClub:{clubId:12,logoUrl:'http://legacy.example/crest.png'},
  idMap:logoMap,
  finding:logoFinding,
});
assert.equal(replace.action, 'would_replace_logo');
assert.equal(replace.current_mixed_content_risk, true);

const notRenderable = buildClubLogoPreviewDryRun({
  internalClub:{clubId:12,logoUrl:null},
  idMap:logoMap,
  finding:{...logoFinding,assetValidation:{...assetValidation,browserRenderable:false}},
});
assert.equal(notRenderable.action, 'blocked_logo_not_renderable');

assert.throws(
  () => buildClubLogoPreviewDryRun({
    internalClub:{clubId:12,logoUrl:null},
    idMap:logoMap,
    finding:{...logoFinding,logoUrl:'http://unsafe.example/crest.png'},
  }),
  /HTTPS/,
);
assert.throws(
  () => buildClubLogoPreviewDryRun({
    internalClub:{clubId:13,logoUrl:null},
    idMap:logoMap,
    finding:logoFinding,
  }),
  /inconsistente/,
);

const batch = buildIntegrationBatchPreview({
  resultPreviews:[update,blocked],
  logoPreviews:[fill,notRenderable],
});
assert.equal(batch.write_enabled,false);
assert.equal(batch.can_write_automatically,false);
assert.equal(batch.result_actions.would_update_result,1);
assert.equal(batch.result_actions.blocked_missing_official_match_id,1);
assert.equal(batch.logo_actions.would_fill_missing_logo,1);
assert.equal(batch.blocked_count,2);
assert.equal(batch.approval_required_count,2);
assert.equal(batch.approval_gate,'human_approval_required_before_any_database_write');

assert.throws(
  () => buildIntegrationBatchPreview({resultPreviews:[update,updateAgain]}),
  /Preview duplicado/,
);

console.log('✓ femebal-sync-preview: resultados y escudos coordinados por IDs oficiales, provenance, idempotencia y aprobación humana; DRY RUN sin escrituras');
