# Control match public-source cross-check — 2026-10-28

## Purpose

Record public evidence for the 7Metros control match without promoting secondary score/video sources to official FEMEBAL planilla evidence. This note is discovery metadata only; it does not authorize endpoint probing, authentication, or writes.

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

## Independent public match/video reference (verified 2026-10-28)

A publicly accessible Ferro Carril Oeste handball news page identifies the exact control match:

- URL: https://ferrocarriloeste.com.ar/m_index1.php?noti=26295
- Page heading: **“HANDBALL Masculino: Partido completo Argentinos Juniors 20 - Ferro 27”**
- Displayed date: **21-03-2026**
- Competition line: **Metro Apertura - Liga de Honor Oro Caballeros - 1º Fecha**
- Attribution: **“Gentileza Handball AAAJ.”**
- Embedded video target observed in the page metadata: https://www.youtube.com/embed/_wv8A5bapSM

The page labels itself **“Sitio NO oficial de publicación independiente”**. It is therefore secondary evidence, not an official FEMEBAL record. Its displayed match title, date and competition independently corroborate the identity and 20–27 score used by the control fixture. The embedded full-match video is a useful public source for later computer-vision evaluation, subject to separately recording the exact video asset and creating human-verified ground truth.

The video embed link was observed in the public page metadata; this pass did not download the video, run vision inference, inspect every frame, or validate individual player statistics. The page/video must not be treated as an official planilla or as a source of official event-level statistics without manual validation.

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
| Final score 20–27 | Corroborated by independent public secondary score/video pages; not established by the programming PDF |
| Public full-match video reference | Public Ferro page exposes an embedded YouTube video for the exact match; video content and event labels not revalidated in this pass |
| Sofascore timestamp agrees with official local fixture date | **No** — its stated UTC timestamp maps to 20 March 20:15 Argentina time |
| Public TournamentTracker route for this Apertura fixture | Not found in this cross-check |
| Individual official FEMEBAL planilla URL publicly discovered and linked to this match | Not established |
| Known PDF filename `5ce377051ea0acb1.pdf` fetched or re-verified in this run | No |

The synthetic regression fixture that contains this filename remains test data, not discovery evidence. A matching filename, score, SHA-256, offline artifact, or public video alone cannot establish public origin of the official planilla.

## Safe next step

Use the public video as a separately sourced candidate for vision testing only after verifying the asset and preparing human-labeled ground truth. Continue searching public FEMEBAL pages and publicly indexed TournamentTracker results for an explicit link to this exact scheduled fixture and its planilla. Preserve the official local schedule timestamp and each secondary source's raw timestamp as separate fields. Do not probe candidate application endpoints automatically, infer opaque route IDs, download an unlinked PDF, or write to Supabase/production.

## Safety

Only public pages and their visible metadata were inspected. No application endpoint was called. No credentials, cookies, tokens, Authorization headers, or secrets were used. No Supabase or production writes were performed.
