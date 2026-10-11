# Demo integrada de análisis real — Ferro–Luján — 01/10/2026

## Objetivo

Se integraron en un único runner visible las capas funcionales ya verificadas estructuralmente sobre GT1:

- tracking + ID persistente de jugadores;
- equipo Ferro/Luján;
- observación detector-backed de pelota;
- candidatos `POS?`;
- candidatos `BALL FLIGHT?`;
- candidatos `CONTROL CHANGE?`.

El runner **no agrega nuevas inferencias semánticas**: consume los streams ya retenidos y vuelve a ejecutar sólo las reglas deterministas de vuelo/evento. Todos los conceptos sin ground truth específico conservan `?` en pantalla.

## Ejecución real

Ferro–N. S. de Luján, fixture frames 105–209 (105 frames):

- pelota observada: 38/105 frames;
- estados de posesión: 67 `ball_unobserved`, 17 `observed_unassigned`, 2 `observed_ambiguous`, 19 `candidate`;
- 4 runs estables de candidato de posesión;
- 1 `CONTROL CHANGE?` conservador;
- 2 `BALL FLIGHT?` detector-backed;
- eventos confirmados: 0.

La demo dibuja una estela de pelota **únicamente dentro de frames con observaciones reales consecutivas**; no rellena huecos.

Artefactos locales:
- MP4 SHA256 `3e7996c78a611cb44b47b1d8cb3b4ce08e0ac8d03693a9295a3767dc569fc4a0`;
- JSON resumen SHA256 `8ad17a8f7f37b777eed2a80ced52a16d70c5c0536bf0e5bdb0b60f3c1a02b074`.

## Estado

Esto ya constituye una **demo funcional integrada**, pero no un sistema de estadísticas automáticas validado. Faltan GT específico de pelota/posesión/eventos y geometría de cancha/arco antes de etiquetar pases, tiros o goles.

Próximo hito: calibrar geometría de cancha/portería para convertir un `BALL FLIGHT?` en `SHOT?` sólo cuando la trayectoria sea compatible con una portería real.
