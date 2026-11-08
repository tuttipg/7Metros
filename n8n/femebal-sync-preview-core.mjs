function positiveId(value, label) {
  const text = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`${label} inválido`);
  const n = Number(text);
  if (!Number.isSafeInteger(n)) throw new Error(`${label} fuera de rango seguro`);
  return text;
}

function optionalPositiveId(value, label) {
  if (value === null || value === undefined || value === '') return null;
  return positiveId(value, label);
}

function nonNegativeInt(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} inválido`);
  return value;
}

function httpsUrl(value, label) {
  let url;
  try { url = new URL(String(value ?? '')); }
  catch { throw new Error(`${label} inválida`); }
  if (url.protocol !== 'https:') throw new Error(`${label} debe usar HTTPS`);
  if (url.username || url.password) throw new Error(`${label} no puede incluir credenciales`);
  return url.href;
}

function optionalUrl(value, label) {
  if (value === null || value === undefined || value === '') return null;
  return httpsUrl(value, label);
}

function sha256(value, label) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} inválido`);
  return text;
}

function stableKey(parts) {
  return parts.map((x) => String(x ?? '')).join('|');
}

function completeScore(home, away) {
  return Number.isSafeInteger(home) && home >= 0 && Number.isSafeInteger(away) && away >= 0;
}

function verifiedResultState(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'finalizado' || s === 'final';
}

function validateSource(source, label) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`${label} requerida`);
  if (typeof source.type !== 'string' || !source.type.trim()) throw new Error(`${label}.type requerido`);
  const url = httpsUrl(source.url, `${label}.url`);
  if (typeof source.observedAt !== 'string' || !source.observedAt.trim()) throw new Error(`${label}.observedAt requerido`);
  const bodySha256 = source.bodySha256 ? sha256(source.bodySha256, `${label}.bodySha256`) : null;
  return { type: source.type.trim(), url, observedAt: source.observedAt.trim(), bodySha256 };
}

export function summarizeFemebalCoverage({
  matchesTotal,
  matchesWithCompleteScore,
  clubsTotal,
  clubsMissingLogo,
  clubsBrokenLogo = null,
}) {
  nonNegativeInt(matchesTotal, 'matchesTotal');
  nonNegativeInt(matchesWithCompleteScore, 'matchesWithCompleteScore');
  nonNegativeInt(clubsTotal, 'clubsTotal');
  nonNegativeInt(clubsMissingLogo, 'clubsMissingLogo');
  if (matchesWithCompleteScore > matchesTotal) throw new Error('matchesWithCompleteScore excede matchesTotal');
  if (clubsMissingLogo > clubsTotal) throw new Error('clubsMissingLogo excede clubsTotal');
  if (clubsBrokenLogo !== null) {
    nonNegativeInt(clubsBrokenLogo, 'clubsBrokenLogo');
    if (clubsBrokenLogo > clubsTotal - clubsMissingLogo) throw new Error('clubsBrokenLogo excede clubes con URL');
  }

  const pct = (a, b) => b === 0 ? null : Number(((a / b) * 100).toFixed(2));
  return {
    matches: {
      total: matchesTotal,
      complete_score: matchesWithCompleteScore,
      without_complete_score: matchesTotal - matchesWithCompleteScore,
      complete_score_pct: pct(matchesWithCompleteScore, matchesTotal),
    },
    clubs: {
      total: clubsTotal,
      with_logo_url: clubsTotal - clubsMissingLogo,
      missing_logo_url: clubsMissingLogo,
      broken_logo_url: clubsBrokenLogo,
      logo_url_coverage_pct: pct(clubsTotal - clubsMissingLogo, clubsTotal),
      render_health_complete: clubsBrokenLogo !== null,
    },
  };
}

export function buildMatchResultPreviewDryRun({ internalMatch, idMap, finding }) {
  if (!internalMatch || typeof internalMatch !== 'object') throw new Error('internalMatch requerido');
  if (!idMap || typeof idMap !== 'object') throw new Error('idMap requerido');
  if (!finding || typeof finding !== 'object') throw new Error('finding requerido');

  const partidoId = positiveId(internalMatch.partidoId, 'partidoId');
  const temporadaId = positiveId(internalMatch.temporadaId, 'temporadaId');
  const localEquipoId = positiveId(internalMatch.localEquipoId, 'localEquipoId');
  const visitanteEquipoId = positiveId(internalMatch.visitanteEquipoId, 'visitanteEquipoId');

  const tournamentId = positiveId(idMap.tournamentId, 'tournamentId');
  const mappedTemporadaId = positiveId(idMap.temporadaId, 'mapped temporadaId');
  const homeTeamId = positiveId(idMap.homeTeamId, 'homeTeamId');
  const mappedLocalEquipoId = positiveId(idMap.localEquipoId, 'mapped localEquipoId');
  const awayTeamId = positiveId(idMap.awayTeamId, 'awayTeamId');
  const mappedVisitanteEquipoId = positiveId(idMap.visitanteEquipoId, 'mapped visitanteEquipoId');

  if (temporadaId !== mappedTemporadaId) throw new Error('tournamentId→temporadaId inconsistente');
  if (localEquipoId !== mappedLocalEquipoId) throw new Error('homeTeamId→localEquipoId inconsistente');
  if (visitanteEquipoId !== mappedVisitanteEquipoId) throw new Error('awayTeamId→visitanteEquipoId inconsistente');

  const matchId = optionalPositiveId(finding.matchId, 'matchId');
  if (matchId === null) {
    return {
      dry_run: true,
      write_enabled: false,
      action: 'blocked_missing_official_match_id',
      partidoId,
      tournamentId,
      requires_human_approval: false,
      blockers: ['matchId oficial faltante'],
    };
  }

  if (finding.tournamentId !== undefined && positiveId(finding.tournamentId, 'finding tournamentId') !== tournamentId) {
    throw new Error('finding.tournamentId no coincide con idMap');
  }
  if (finding.homeTeamId !== undefined && positiveId(finding.homeTeamId, 'finding homeTeamId') !== homeTeamId) {
    throw new Error('finding.homeTeamId no coincide con idMap');
  }
  if (finding.awayTeamId !== undefined && positiveId(finding.awayTeamId, 'finding awayTeamId') !== awayTeamId) {
    throw new Error('finding.awayTeamId no coincide con idMap');
  }

  if (!verifiedResultState(finding.status)) throw new Error('Resultado oficial no está finalizado');
  const homeScore = nonNegativeInt(finding.homeScore, 'homeScore');
  const awayScore = nonNegativeInt(finding.awayScore, 'awayScore');
  const source = validateSource(finding.source, 'result source');

  const matchSheetId = optionalPositiveId(finding.matchSheetId, 'matchSheetId');
  const planillaUrl = optionalUrl(finding.planillaUrl, 'planillaUrl');
  if ((matchSheetId || planillaUrl) && !finding.planillaSource) {
    throw new Error('planillaSource requerida cuando hay evidencia de planilla');
  }
  const planillaSource = finding.planillaSource ? validateSource(finding.planillaSource, 'planillaSource') : null;

  if (finding.participantSummary) {
    const s = finding.participantSummary;
    nonNegativeInt(s.homeGoals, 'participantSummary.homeGoals');
    nonNegativeInt(s.awayGoals, 'participantSummary.awayGoals');
    if (s.homeGoals !== homeScore || s.awayGoals !== awayScore) {
      throw new Error('La suma de goles de participantes no coincide con el marcador');
    }
  }

  const currentHome = internalMatch.golesLocal;
  const currentAway = internalMatch.golesVisitante;
  const currentComplete = completeScore(currentHome, currentAway);
  const currentFinal = verifiedResultState(internalMatch.estado);

  let action = 'would_update_result';
  let conflict = null;
  if (currentComplete) {
    if (currentHome === homeScore && currentAway === awayScore && currentFinal) action = 'noop_already_matches';
    else {
      action = 'review_required_result_conflict';
      conflict = {
        current: { estado: internalMatch.estado ?? null, homeScore: currentHome, awayScore: currentAway },
        official: { status: finding.status, homeScore, awayScore },
      };
    }
  }

  return {
    dry_run: true,
    write_enabled: false,
    action,
    idempotency_key: stableKey(['result', tournamentId, matchId, homeTeamId, awayTeamId, homeScore, awayScore]),
    official_ids: { tournamentId, matchId, homeTeamId, awayTeamId, matchSheetId },
    internal_ids: { temporadaId, partidoId, localEquipoId, visitanteEquipoId },
    proposed: {
      estado: 'finalizado',
      goles_local: homeScore,
      goles_visitante: awayScore,
      planilla_url: planillaUrl,
    },
    provenance: { result: source, planilla: planillaSource },
    conflict,
    requires_human_approval: action === 'would_update_result' || action === 'review_required_result_conflict',
  };
}

export function buildClubLogoPreviewDryRun({ internalClub, idMap, finding }) {
  if (!internalClub || typeof internalClub !== 'object') throw new Error('internalClub requerido');
  if (!idMap || typeof idMap !== 'object') throw new Error('idMap requerido');
  if (!finding || typeof finding !== 'object') throw new Error('finding requerido');

  const internalClubId = positiveId(internalClub.clubId, 'internal clubId');
  const mappedInternalClubId = positiveId(idMap.internalClubId, 'mapped internalClubId');
  const femebalClubId = positiveId(idMap.femebalClubId, 'femebalClubId');
  if (internalClubId !== mappedInternalClubId) throw new Error('clubId FEMEBAL→7Metros inconsistente');
  if (finding.clubId !== undefined && positiveId(finding.clubId, 'finding clubId') !== femebalClubId) {
    throw new Error('finding.clubId no coincide con idMap');
  }

  const logoUrl = httpsUrl(finding.logoUrl, 'logoUrl');
  const source = validateSource(finding.source, 'logo source');
  const asset = finding.assetValidation;
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error('assetValidation requerida');
  if (asset.httpStatus !== 200) throw new Error('Escudo no validado con HTTP 200');
  if (typeof asset.contentType !== 'string' || !asset.contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Content-Type del escudo no es imagen');
  }
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1) throw new Error('Tamaño del escudo inválido');
  const assetSha256 = sha256(asset.sha256, 'assetValidation.sha256');
  if (asset.browserRenderable !== true) {
    return {
      dry_run: true,
      write_enabled: false,
      action: 'blocked_logo_not_renderable',
      femebalClubId,
      internalClubId,
      logoUrl,
      source,
      requires_human_approval: false,
      blockers: ['asset no confirmado como renderizable en navegador'],
    };
  }

  const current = internalClub.logoUrl ? String(internalClub.logoUrl).trim() : null;
  let action;
  if (current === logoUrl) action = 'noop_already_matches';
  else if (!current) action = 'would_fill_missing_logo';
  else action = 'would_replace_logo';

  return {
    dry_run: true,
    write_enabled: false,
    action,
    idempotency_key: stableKey(['club-logo', femebalClubId, logoUrl, assetSha256]),
    femebalClubId,
    internalClubId,
    current_logo_url: current,
    proposed_logo_url: logoUrl,
    provenance: {
      source,
      asset: {
        httpStatus: 200,
        contentType: asset.contentType,
        bytes: asset.bytes,
        sha256: assetSha256,
        browserRenderable: true,
        checkedAt: String(asset.checkedAt ?? source.observedAt),
      },
    },
    current_mixed_content_risk: current?.toLowerCase().startsWith('http:') || false,
    requires_human_approval: action !== 'noop_already_matches',
  };
}

export function buildIntegrationBatchPreview({ resultPreviews = [], logoPreviews = [] }) {
  if (!Array.isArray(resultPreviews) || !Array.isArray(logoPreviews)) throw new Error('Previews deben ser arrays');

  const keys = new Set();
  for (const item of [...resultPreviews, ...logoPreviews]) {
    if (!item || typeof item !== 'object') throw new Error('Preview inválido');
    if (item.idempotency_key) {
      if (keys.has(item.idempotency_key)) throw new Error(`Preview duplicado: ${item.idempotency_key}`);
      keys.add(item.idempotency_key);
    }
  }

  const resultActions = resultPreviews.reduce((acc, x) => {
    acc[x.action] = (acc[x.action] || 0) + 1;
    return acc;
  }, {});
  const logoActions = logoPreviews.reduce((acc, x) => {
    acc[x.action] = (acc[x.action] || 0) + 1;
    return acc;
  }, {});

  const approvalItems = [...resultPreviews, ...logoPreviews].filter((x) => x.requires_human_approval);
  const blocked = [...resultPreviews, ...logoPreviews].filter((x) => String(x.action).startsWith('blocked_'));

  return {
    dry_run: true,
    write_enabled: false,
    result_actions: resultActions,
    logo_actions: logoActions,
    blocked_count: blocked.length,
    approval_required_count: approvalItems.length,
    can_write_automatically: false,
    approval_gate: approvalItems.length
      ? 'human_approval_required_before_any_database_write'
      : 'no_write_actions_pending',
  };
}
