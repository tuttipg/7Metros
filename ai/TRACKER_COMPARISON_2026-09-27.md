# Comparación real: baseline, dos etapas y ByteTrack

## Alcance verificado

Se recuperó un runtime CPU limpio y se ejecutó inferencia neuronal nueva sobre
el mismo recorte Ferro–N. S. de Luján de 120 s/3600 frames. El hash del recorte
es `7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`,
igual al documentado. YOLO11n COCO/person, confianza mínima 0.10, produjo 53.786
cajas crudas. El filtro de fixture conservó 40.242. La inferencia completa con
la asociación de dos etapas tardó 146,34 s (24,60 FPS) en CPU. Eso sí es
inferencia; la comparación posterior es replay de esa única caché.

Proveniencia: pesos SHA256
`0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`;
caché SHA256
`b825b6a8bf1312b1a43d636ae2c50be197bdd49a72ae321889d40e0cd1d57403`.

Los tres trackers usaron el mismo video, caché y filtro. El baseline recibió
sólo cajas >=0.25. Dos etapas y ByteTrack recibieron también cajas (0.10,0.25).
ByteTrack es el adaptador estándar de Ultralytics 8.4.163 con los defaults
publicados por esa versión: high .25, low .10, new .25, buffer 30, match .80 y
fusión de score. No se copió ni reimplementó el algoritmo.

## Resultado

| Medida de salud (no accuracy) | Baseline >=.25 | Dos etapas | ByteTrack estándar |
|---|---:|---:|---:|
| Observaciones de tracks | 34.925 | 36.733 | 34.751 |
| Observaciones débiles retenidas | 0 | 1.808 | 1.152 |
| IDs únicos | 273 | 279 | 322 |
| Tramos continuos | 1.081 | 634 | 594 |
| Tramo continuo medio | 32,31 fr / 1,077 s | 57,94 fr / 1,931 s | 58,50 fr / 1,950 s |
| Mediana de tramo continuo | 4 fr | 10,5 fr | 14 fr |
| IDs de un frame | 29 | 18 | 23 |
| IDs nuevos cada 100 frames | 7,583 | 7,750 | 8,944 |

Dos etapas retuvo 1.808 observaciones débiles y casi duplicó el tramo continuo
medio frente al baseline, pero creó seis IDs más. ByteTrack logró continuidad
media similar, aunque generó 43 IDs más que dos etapas y menos observaciones
totales. Estas métricas pueden ocultar asociaciones incorrectas: no eligen un
ganador sin identidad anotada.

## Auditoría dispersa existente

En el contacto atacante/defensor, baseline y dos etapas tuvieron cero cambios
de ID entre puntos asignables. ByteTrack tuvo dos. En el segundo cruce, los tres
tuvieron cero. En ambos episodios persiste una caja compartida por las dos
personas; ningún tracker puede recuperar dos identidades desde una caja única.
Son 30 puntos dispersos, anotados por el asistente y no revisados de forma
independiente: no son IDF1/HOTA ni ground truth completo.

## Implementación y reproducción

`benchmark_trackers.py` valida hash y metadatos de la caché, aplica una vez el
filtro del fixture y exporta un JSONL por tracker más `comparison.json`. Rechaza
cachés creadas por encima de confianza .10 y detecta diferencias de cantidad de
frames. La dependencia `lap` quedó aislada en el extra `benchmark`.

```bash
cd ai
pip install -e '.[benchmark]'
python benchmark_trackers.py --video /ruta/fixture120.mp4 \
  --cache /ruta/detections_010.jsonl --out /ruta/comparison
python -m unittest discover -s tests -v
```

Evidencia resumida: `evidence/trackers/comparison.json`. Los JSONL, caché y MP4
son artefactos locales grandes y no se suben al repositorio. No se tocó
Supabase ni se fusionó `main`.

## Próxima prioridad

Anotar de forma completa un segmento corto con contactos para calcular métricas
MOT válidas y revisar visualmente los 43 IDs adicionales de ByteTrack. Después,
comparar un detector específico de handball o mayor resolución en las cajas
fusionadas; ajustar memoria o asociación no puede separar personas que el
detector entrega como una sola caja.
