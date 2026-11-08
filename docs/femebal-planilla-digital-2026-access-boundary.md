# FEMEBAL 2026 digital score-sheet access boundary

Verified 2026-09-22 from public, official FEMEBAL material.

## Official evidence

FEMEBAL's **Boletín Informativo N.º 12 – Planilla Digital 2026** (dated 2025-12-23) states that in 2026 digital match sheets must be completed **online for all categories and divisions**. It also states that the home club must provide a computer and Internet connection and that the digital sheet is accessed with the scorer's assigned **username and password**.

Official publication page:
https://femebal.com/boletin-informativo-no-12/

Official PDF linked by that page:
https://femebal.com/wp-content/uploads/2026/01/Boletin-Informativo-N%C2%B0-12.-Planilla-Digital.-Ano-2026.pdf

## SAFE interpretation for 7Metros

This evidence changes the discovery boundary but does **not** prove that public read-only result or published-sheet views do not exist.

- Treat the **authoring/loading interface** for 2026 digital sheets as authenticated and out of scope for anonymous discovery.
- Do not request, capture, reuse or automate scorer usernames/passwords, cookies, tokens or Authorization material.
- Do not attempt login flows or authenticated endpoints.
- Continue discovery only through explicitly public/indexed FEMEBAL pages, official public PDFs, and anonymous GET resources that satisfy the existing fail-closed policy.
- Historical public pages that display `Ver Planilla` remain evidence that public published views existed historically, but they do not authorize inference or probing of 2026 sheet URLs.
- A future 2026 sheet/result URL may be accepted only when independently observed as an explicit public link/indexed resource and after the normal SAFE URL/evidence validation; observation alone must not enable automatic probing.

## Control match

The bulletin is system-level evidence only. It does not establish the score or player statistics for the control match **Argentinos Juniors 20–27 Ferro Carril Oeste, 2026-03-21**. The control remains useful for validating any future explicit public result/sheet source, but no result claim is promoted from this bulletin.

## Consequence

Discovery should prioritize public publication surfaces and static/index evidence rather than attempting to discover the 2026 planilla authoring system. This keeps the workflow legitimate, anonymous, GET-only and fail-closed while avoiding a dead-end that the official bulletin identifies as credentialed.