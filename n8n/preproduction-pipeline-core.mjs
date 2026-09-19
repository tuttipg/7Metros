import { parsePlanillaDryRun } from './planilla-dry-run-core.mjs';
import { validatePreSupabaseCandidate } from './pre-supabase-gate-core.mjs';
import { buildPreproductionPayload } from './preproduction-payload-core.mjs';

/**
 * Pure SAFE/DRY RUN composition for FEMEBAL -> validation -> preproduction preview.
 * No network, Supabase client, RPC/table target or write primitive is accepted here.
 */
export function buildPlanillaPreproductionPreview({ workItem, extractedText, expected, mapping }) {
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    throw new Error('Se requiere identidad esperada del partido');
  }

  const dryRunResult = parsePlanillaDryRun({ workItem, extractedText, expected });
  const candidate = validatePreSupabaseCandidate({ dryRunResult, mapping });
  const preview = buildPreproductionPayload(candidate);

  if (preview.executable_request !== false || preview.target !== null || preview.operation !== 'preview_only') {
    throw new Error('El pipeline produjo una salida ejecutable inesperada');
  }

  return {
    safe: true,
    dry_run: true,
    write_enabled: false,
    production_write_allowed: false,
    stages: {
      planilla_parsed: true,
      expected_match_validated: true,
      pre_supabase_gate_passed: true,
      preview_built: true,
    },
    preview,
  };
}
