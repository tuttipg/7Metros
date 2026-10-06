# Validación humana independiente de reentrada — 2026-09-28

## Resultado

Se recibió y validó el segundo GT humano: 90/90 cuadros, 1.125 cajas y 13
identidades en fixture frames 2915–3004. El importador nuevo liga el archivo al
hash del manifiesto de la tarea, comprueba la tabla de cuadros, geometría,
identidades duplicadas, constancia completa y timestamp con zona horaria. El GT
validado tiene SHA256
`9bdca94b3b48d8410260e51e433fc64c4c07848828339d4d9e5911cb0b36b090`.
Se preservó la corrección QC ya documentada del cuadro 13 (`21 → 215`); el
importador permite declararla de forma explícita, exige una coincidencia única
y la deja en la constancia.

También se eliminó el nombre de secuencia fijo en el empaquetado/evaluación:
TrackEval usa ahora `ferro_lujan_hard_reentry` desde el manifiesto y rechaza
nombres inseguros.

## TrackEval 1.3.0, replay sin filtro de rol

| Tracker | HOTA | IDF1 | MOTA | TP | FN | FP | IDSW | Frag. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥.25 | 75,914 | 78,174 | 65,511 | 917 | 208 | 171 | 9 | 28 |
| dos etapas .10/.25 | **77,311** | **79,505** | **68,178** | **959** | **166** | 180 | 12 | **20** |
| ByteTrack estándar | 66,545 | 76,590 | 66,133 | 923 | 202 | **169** | 10 | 24 |

Dos etapas vuelve a liderar HOTA e IDF1 en un intervalo independiente y gana
42 TP / 42 FN frente al baseline. Esto refuerza la asociación de baja confianza,
pero no implica precisión general fuera de los 90 cuadros revisados.

En el GT ID 222 —la reentrada que motivó el recorte— el diagnóstico por IoU
encuentra 67/90 cuadros en dos etapas, 59/90 en baseline y 54/90 en ByteTrack.
Dos etapas todavía reparte esas coincidencias entre seis IDs, por lo que la
fragmentación de identidad sigue siendo la principal oportunidad de mejora.

## Guardrail del filtro uniforme de árbitros

El replay filtrado conserva exactamente TP, FN, IDSW y fragmentaciones. Elimina
126 FP de baseline, 126 de dos etapas y 116 de ByteTrack; ninguna observación
eliminada coincide o solapa una caja GT a IoU 0,5. HOTA/IDF1 quedan en
79,826/82,894; **81,246/84,191**; y 69,641/80,819 respectivamente.

La opción permanece desactivada por defecto: dos intervalos humanos respaldan
el filtro, pero 195 cuadros no cubren todos los uniformes, cámaras y canchas.

## Verificación y alcance

- 136/136 tests en el runtime de visión;
- entorno mínimo: 123 correctos y 13 omisiones opcionales;
- caché detectora persistida YOLO11n a confianza 0,10;
- replay de trackers, no inferencia neuronal nueva;
- no se usó Supabase ni secretos.

Siguiente prioridad: reducir la fragmentación del GT ID 222 sin perder la
ventaja global de dos etapas, con una regla de reidentificación verificable en
ambos GT humanos y manteniendo el filtro de roles como opt-in.
