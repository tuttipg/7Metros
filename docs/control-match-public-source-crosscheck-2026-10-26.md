# Control match public-source cross-check — 2026-10-26

## Purpose

Record fresh public evidence for the 7Metros control match without promoting secondary score sources to official FEMEBAL planilla evidence. This note is discovery metadata only; it does not authorize endpoint probing, authentication, or writes.

## Official fixture reference

FEMEBAL's official programming PDF for **Saturday 21 March 2026** lists the control fixture on page 1 as:

- Category: Mayores
- Division: LHC Hipotecario Seguros
- Local start time: 20:15
- Branch: M
- Home: Argentinos Juniors
- Away: Ferro Carril Oeste

Source: https://femebal.com/wp-content/uploads/2026/03/Sabado-21-3.pdf

This proves the scheduled fixture and its local date/time, not the final score and not the existence or public accessibility of the individual match-sheet PDF.

## Fresh secondary score cross-check

A public Sofascore event page identifies Argentinos Juniors 20–27 Ferro Carril Oeste in FeMeBal Liga de Honor Oro / Apertura, Round 1:

https://www.sofascore.com/handball/match/argentinos-juniors-ferro-carril-oeste/iRocsyZRj

However, the page displays **20 March 2026, 23:15** and its description explicitly says **23:15 UTC**. Interpreted literally, 20 March 23:15 UTC is 20 March 20:15 in Argentina (UTC−03:00), which conflicts by one calendar day with FEMEBAL's official local fixture time of 21 March 20:15. Do not silently “correct” this source by timezone conversion or use its displayed date as the exact join key. The score/team/category are useful corroboration; its timestamp is conflicting evidence that needs resolution.

A public 365Scores H2H result also lists Argentinos Juniors 20–27 Ferro Carril Oeste on 21 March 2026:

https://www.365scores.com/de/handball/match/liga-de-honor-oro-8181/argentinos-juniors-ferro-carril-oeste-81167-81170-8181

This is secondary corroboration only; it is not a FEMEBAL match sheet.

## TournamentTracker scope

The publicly indexed TournamentTracker route previously observed for the **Súper 8 Hipotecario Seguros Liga Honor Caballeros** is not evidence for Apertura 2026's Round 1 match. Its public search snippet shows a different competition and must remain a negative control, not a route to reuse or a basis for guessing opaque identifiers.

No new TournamentTracker route was found in this cross-check that explicitly links the control match to its individual PDF.

## Provenance status

| Claim | Status |
| --- | --- |
| Official scheduled fixture: 21 March 2026, 20:15 local, LHC male, Argentinos Juniors–Ferro | Confirmed by FEMEBAL programming PDF |
| Final score 20–27 | Corroborated by secondary public score pages; not established by the programming PDF |
| Sofascore timestamp agrees with official local fixture date | **No** — its stated UTC timestamp maps to 20 March 20:15 Argentina time |
| Public TournamentTracker route for this Apertura fixture | Not found in this cross-check |
| Individual official FEMEBAL planilla URL publicly discovered and linked to this match | Not established |
| Known PDF filename `5ce377051ea0acb1.pdf` fetched or re-verified in this run | No |

The synthetic regression fixture that contains this filename remains test data, not discovery evidence. A matching filename, score, SHA-256, or offline artifact alone cannot establish public origin.

## Safe next step

Continue searching public FEMEBAL pages and publicly indexed TournamentTracker results for an explicit link to this exact scheduled fixture. Preserve both the official local schedule timestamp and each secondary source's raw timestamp as separate fields. Do not probe candidate application endpoints automatically, infer opaque route IDs, download an unlinked PDF, or write to Supabase/production.

## Safety

No application endpoint was called. No credentials, cookies, tokens, Authorization headers, or secrets were used. No Supabase or production writes were performed.
