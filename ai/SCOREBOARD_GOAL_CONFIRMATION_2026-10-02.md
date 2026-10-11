# Confirmación de gol por marcador — Ferro–Luján — 02/10/2026

## Motivo

La acción del primer gol (fixture frames ~326–340) no contiene una pelota humanamente localizable de forma fiable. Los detectores COCO grandes, dos modelos externos de fútbol y el probe temporal tampoco resolvieron ese vacío. Para seguir avanzando funcionalmente sin inventar una trayectoria, se separa `SHOT?` de una señal que sí existe en el video: el **cambio persistente del marcador de TV**.

Esta capa no hace OCR y no intenta inferir el instante exacto del lanzamiento. Sólo observa una pequeña ROI fija de cada dígito de score, la binariza y detecta un cambio de glifo que persiste varios frames.

## Guardia contra entrada del overlay

Un primer replay ingenuo detectó cambios espurios durante la entrada/estabilización inicial del gráfico. Se agregó una fase de armado: cada glifo debe permanecer estable durante 30 frames antes de que el detector acepte cambios. Después, un cambio requiere:

- diferencia binaria respecto del glifo estable ≥5%;
- consistencia interna de estado ≤2%;
- persistencia durante 5 frames consecutivos.

No se ignora manualmente un prefijo fijo; el detector se arma por estabilidad observada.

## Replay real

Fuente: MP4 original SHA256 `84a94f6e5526d94afc67dc8ee99cc9b390265482d6f0250f2d8a12080e437ed2`.

Intervalo: los 3.600 frames del fixture (offset de fuente +900), 936×524 @30 FPS.

ROI superior `Ferro`: `[176,36,191,58]`.
ROI inferior `Lujan`: `[176,71,191,90]`.

Resultado:

- **1 cambio persistente total**;
- equipo: **Ferro**;
- inicio del nuevo glifo: fixture frame **431**;
- confirmado después de 5 cuadros: frame **435**;
- fracción de píxeles binarios modificados: **0,1424**;
- Luján: **0 cambios** en el intervalo.

La inspección visual muestra 0–0 antes del cambio y 1–0 después. La acción de gol revisada anteriormente está alrededor de 326–340; por lo tanto el frame 431 es la actualización tardía del marcador y **no** se usa como frame de tiro.

## Semántica

La salida se llama `GOAL CONFIRMED?` / `scoreboard_change`, no `SHOT`.

Sirve para:
- confirmar que un equipo sumó un gol en el video;
- aportar supervisión débil para enlazar una acción anterior;
- mantener separadas evidencia visual de marcador y trayectoria de pelota.

No sirve todavía para:
- determinar goleador;
- fijar el frame exacto del lanzamiento;
- distinguir por sí sola gol normal/7m;
- medir accuracy de goles en un partido completo (este recorte contiene una sola transición conocida).

## Artefactos locales

- JSON replay SHA256: `18398f048178ef5af30a81f70b07adf5106cf87d754849957a8a389b4078f5ca`;
- demo MP4 SHA256: `3780b67cfe5b998b299dc804405489b5bc99a894795542e1d3ecb63c6863276c`.

## Decisión

**KEEP como señal funcional fixture-specific y opt-in.** No reemplaza la detección de pelota ni la geometría de tiro. Permite avanzar eventos mientras el lanzamiento rápido siga por debajo de la visibilidad del video disponible.
