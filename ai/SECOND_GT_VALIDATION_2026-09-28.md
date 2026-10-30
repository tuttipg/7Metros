# Segundo GT humano: reentrada difícil Ferro–Luján — 28/09/2026

## Revisión humana completada

Tomás completó los 90/90 frames de la tarea `ferro_lujan_hard_reentry_gt_review`, correspondiente a fixture frames 2915–3004. El archivo exportado declaró `HUMAN_REVIEW_COMPLETE` y conserva el manifest preparado antes de la revisión.

Validación estructural del archivo recibido:

- 90 frames revisados;
- 1.125 cajas;
- 0 IDs duplicados dentro del mismo frame;
- 0 cajas inválidas o fuera de 936×524;
- fuente: video original `20260926-1444-24.0816290.mp4`;
- SHA256 JSON recibido: `52eea93bc9e0356f1e4c9d54b2e99e0f6201e7383e056015ce971a2f1eb4e8c9`.

### Corrección QC explícita

Se detectó una única identidad `21` presente sólo en el frame de tarea 13. En los frames 12 y 14 la misma persona está anotada como `215`; la caja del frame 13 tiene IoU 0,787 con la caja anterior y 0,551 con la siguiente, y la inspección visual confirma continuidad. Se corrigió `21 → 215` antes de exportar el MOT final. No se realizó ninguna otra modificación humana/asistida.

Resultado validado:

- 13 identidades;
- SHA256 JSON validado: `44e75a8f873c26396b0a6237de191892a9eb52b9b83db5ddf98a7c69251f72de`;
- SHA256 `gt.txt`: `9bdca94b3b48d8410260e51e433fc64c4c07848828339d4d9e5911cb0b36b090`.

## Baseline ≥.25 sobre el segundo GT

Se recuperó el output histórico exacto `memory30`, que ya había sido demostrado equivalente al `baseline_high_only`. El evaluador local reproduce cifra por cifra el TrackEval oficial del primer GT antes de aplicarse al segundo intervalo.

Sobre el segundo GT, antes del filtro de roles:

| Métrica | Baseline |
|---|---:|
| HOTA | 75,914 |
| IDF1 | 78,174 |
| MOTA | 65,511 |
| Recall | 81,511 |
| Precisión | 84,283 |
| IDSW | 9 |
| Fragmentos | 28 |
| TP / FN / FP | 917 / 208 / 171 |

El deterioro respecto del primer contacto no es sólo falta de detección: las identidades difíciles 217 y 222 presentan huecos y asociaciones cruzadas, mientras varias identidades alejadas permanecen estables los 90 frames.

## Validación independiente del filtro temporal de árbitros

El HEAD anterior ya había registrado que el filtro uniforme actual elimina 126 observaciones del baseline en este intervalo: 90 del track 202 y 36 del track 224. En ese momento no existía GT humano y no podía saberse si eran falsos positivos.

Contra el GT recién revisado:

- track 202: 0 cajas con IoU ≥0,5 contra cualquier GT; máximo IoU observado 0,095;
- track 224: 0 cajas con IoU ≥0,5 contra cualquier GT; máximo IoU observado 0,076;
- por lo tanto las 126 eliminaciones registradas no quitan ningún TP CLEAR/Identity del baseline en este intervalo.

Con esas 126 exclusiones, los conteos a IoU 0,5 quedan:

- TP 917;
- FN 208;
- FP 45;
- IDSW 9;
- MOTA 76,711%;
- recall 81,511%;
- precisión 95,322%;
- IDF1 82,894%.

Esto aporta una segunda validación humana independiente de que el filtro temporal de árbitros mejora la precisión del baseline sin borrar jugadores en el intervalo evaluado. No se generaliza todavía a todo el partido ni a los otros trackers porque sus JSONL de esta corrida no quedaron persistidos.

## Experimento: rellenar sólo gaps internos ≤5 frames

Como diagnóstico adicional se interpolaron linealmente únicamente gaps internos del mismo `track_id` de hasta 5 frames (0,167 s), sin extrapolar en los extremos ni crear IDs nuevos. Es un experimento offline; no se promueve todavía al pipeline.

Sobre el baseline actual con filtro de roles:

| Métrica | Primer GT actual | + gap≤5 | Segundo GT actual | + gap≤5 |
|---|---:|---:|---:|---:|
| HOTA | 85,939 | 86,537 | ~79,826 | ~81,214 |
| IDF1 | 90,678 | 91,520 | 82,894 | 84,284 |
| MOTA | 83,738 | 85,283 | 76,711 | 79,644 |
| Recall | 84,915 | 87,049 | 81,511 | 85,244 |
| Precisión | 99,312 | 98,583 | 95,322 | 94,669 |
| IDSW | 8 | 7 | 9 | 9 |
| Fragmentos | 19 | 8 | 28 | 15 |

El límite de 5 frames mejora ambos GT y no aumenta ID switches. Al permitir gaps más largos el segundo intervalo empieza a generar más ID switches; por eso no se conserva esa variante. El HOTA del segundo intervalo se marca aproximado porque el artefacto exacto posterior al filtro temporal no quedó persistido y una observación de rol está en el límite cromático entre el clip original y el fixture derivado. CLEAR/Identity a IoU 0,5 sí quedan determinados por los conteos y el guardrail de solapamiento.

## Decisión

- Mantener `two_stage` como candidato principal por el primer TrackEval oficial; no declarar ganador general todavía.
- Conservar el filtro temporal de árbitros como opt-in: ahora tiene evidencia humana favorable en dos intervalos para el baseline, pero falta repetir este segundo GT con los tres outputs actuales.
- Conservar `gap≤5` sólo como candidato experimental hasta poder aplicarlo al output actual de `two_stage` y ByteTrack y repetir TrackEval.
- Próximo bloqueo reproducible: recuperar/regenerar los JSONL actuales de `two_stage` y `bytetrack_standard` para frames 2915–3004 y ejecutar la segunda tabla completa.
