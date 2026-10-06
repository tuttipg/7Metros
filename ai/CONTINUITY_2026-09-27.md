# Continuidad real frente a duración del ID

Se recalcularon métricas sobre los tres JSONL existentes, sin ejecutar de nuevo
el detector ni modificar detecciones.3600 frames,34925 observaciones por versión.

| Métrica | Greedy memoria8 | Greedy memoria30 | Global memoria30 |
|---|---:|---:|---:|
| IDs |400|273|271|
| Span medio frames |91.660|142.590|143.642|
| Tramo continuo medio frames |32.855|32.308|32.338|
| Tramo continuo medio segundos (30FPS) |1.095|1.077|1.078|
| Mediana tramo continuo frames |4|4|4|
| Reapariciones con mismo ID |663|808|809|
| Ausencias internas acumuladas |1739|4002|4002|

Una reaparición es una asociación del tracker, no identidad verificada.
La media continua se calcula por tramo, no por persona real ni por track completo.
Termina un tramo ante frames sin ese ID; si reaparece comienza otro. No cuenta
el tiempo ausente como observación. Ausencia al final sin retorno no es
reaparición. Cajas erróneas/ID swaps dentro de un tramo no son detectables por
esta métrica. Las ausencias pueden provenir del detector, filtro de cancha o
asociación; esta medición no separa esas causas.

Corrección de interpretación: el span medio de4.75s comunicado anteriormente
es el intervalo primera–última observación, incluyendo huecos. NO significa
4.75s de seguimiento ininterrumpido. La memoria larga recupera más IDs y ayudó
en un cruce auditado; no mejora aquí la duración de los tramos continuos.

## Desarrollo

TrackingMetrics incorpora tramos continuos, huecos y reapariciones. Rechaza
frames desordenados/duplicados e IDs repetidos en el mismo frame para evitar
métricas silenciosamente infladas. Summary es idempotente y no cierra estado.
Pipeline exporta las duraciones en segundos usando FPS de video.

```bash
python measure_continuity.py /ruta/recovered-kits/tracks.jsonl /ruta/memory30/tracks.jsonl /ruta/global30/tracks.jsonl
python -m unittest discover -s tests
```

La comparación del segundo cruce y asociación global quedó publicada en
27e114c30dcbcb503ab8c3e768dad1aa020f57f2; no se fusionó. Artefactos anteriores
confirmados guardados, no se duplicaron. Durante restauración del entorno,
OpenCV5.0.0.93 terminó con bus error al importar; no se atribuye al tracker.
Se probó reinstalar OpenCV4.11.0.86, pero la suite en ese entorno también
terminó con bus error. No se da por reparado el entorno nativo. En el runtime
principal:57 tests descubiertos,55 aprobados y2 de visión omitidos por falta
de OpenCV. Los4 nuevos tests de continuidad pasan. Cálculo de estas métricas
es Python puro y fue ejecutado sobre los3 archivos completos.

Próxima prioridad: registrar por frame detecciones descartadas y cortes de
asociación para distinguir pérdidas del detector, filtro y tracker antes de
seguir aumentando memoria. No se afirma precisión general, HOTA o IDF1.
