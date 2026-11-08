# Pre-Supabase planilla URL boundary audit

Date: 2026-10-29

## Finding

The independent pre-Supabase gate revalidated that the source was an official PDF, but used the generic official-PDF canonicalizer. That policy intentionally accepts both WordPress PDFs under `/wp-content/uploads/` (which may be schedules) and match-sheet PDFs under the official planilla host's `/pdf_planillas/` tree.

Consequently, a schedule PDF could be mislabeled as `document_type=planilla_partido_pdf` and reach later identity checks if all other fixture data were synthetic or supplied independently. This was a contract gap in the gate, not evidence that production data was imported incorrectly.

## Change

- The gate now uses `canonicalizeOfficialFemebalPlanillaUrl()` independently for both `source_url` and `source.pdf_url`.
- It still requires both canonical URLs to be identical.
- Added a regression using the known WordPress schedule path `/wp-content/uploads/2026/03/Sabado-21-3.pdf`; the gate must reject it as a planilla.
- The existing positive control remains the public planilla-host fixture for Argentinos Juniors 20–27 Ferro, 2026-03-21 at 20:15.

## Public-source cross-check and limits

The official FEMEBAL TournamentTracker route indexed publicly as
`https://www.femebal.com/tournament-tracker/RUdVX3VheVA=`
shows Argentinos Juniors 20–27 Ferro on 2026-03-21 at 20:15. Direct static HTML returns only the JavaScript-app shell, so this confirms the indexed match result but does not expose or prove a direct link to the final match sheet.

No guessed endpoint, identifier enumeration, remote JavaScript execution, credentials, or authenticated request was used. The known PDF path remains a test fixture, not proof of public discovery of the actual final match sheet.

## Safety and validation

- Supabase writes remain disabled; no production data was changed.
- No secrets, cookies, tokens, or Authorization headers were used.
- GitHub Actions must be checked on the resulting branch HEAD before this change is treated as CI-verified.
