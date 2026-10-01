# Candidatos detector-backed de pelota en vuelo — Ferro–Luján — 01/10/2026

## Objetivo

Antes de llamar a algo `shot` o `pass`, se agregó una señal más segura: `BALL FLIGHT?`. Representa un tramo donde la pelota está **observada por el detector**, no queda asignada a ningún jugador por la capa `POS?`, aparece en varios frames consecutivos y se desplaza con velocidad/dirección consistentes.

No se interpolan frames faltantes. No se usa todavía ubicación del arco ni geometría de cancha. Por eso esta capa no clasifica pase, tiro, pérdida o rebote.

## Regla

`detect_free_ball_flights()` exige:
- estado de posesión `observed_unassigned`;
- mismo segmento detector-backed de pelota;
- al menos 3 observaciones consecutivas;
- velocidad media ≥8 px/frame;
- linealidad `desplazamiento neto / longitud de trayectoria` ≥0.70.

## Ejecución real — GT1

Sobre Ferro–N. S. de Luján, fixture frames 105–209, aparecen **2 candidatos**:

1. frames 108–112, 5 observaciones:
   - velocidad media: 30.88 px/frame;
   - máxima: 42.83 px/frame;
   - desplazamiento neto: 122.87 px;
   - linealidad: 0.995.

2. frames 156–160, 5 observaciones:
   - velocidad media: 11.46 px/frame;
   - máxima: 12.84 px/frame;
   - desplazamiento neto: 45.82 px;
   - linealidad: 1.000.

Ambas secuencias fueron inspeccionadas visualmente como sanity check y muestran desplazamiento de la pelota compatible con el concepto genérico de vuelo libre. Esto **no** prueba que sean pases o lanzamientos.

Artefactos locales:
- MP4 SHA256 `9750e55efedcc7dcc4bcbd8fa8a7d1469477e2b4fb41a08dc83a4a43efe86657`;
- JSON SHA256 `5e1393b47d0c2b49d5e57f5a56624eadd6b9ad990a6dd1d3beb67f8a1566aa22`.

## Tests

Suite local: **216/216 OK**.

## Decisión

**KEEP como señal experimental previa a eventos semánticos.**

El siguiente paso para llegar a `SHOT?` es añadir geometría de cancha/arco al fixture real y exigir que una trayectoria libre sea compatible con una dirección de portería. Hasta entonces no se reportan lanzamientos.
