# Auditoría visual sincronizada de tres trackers

Se agregó `compare_trackers_video.py` para renderizar entre dos y cuatro JSONL
sobre exactamente los mismos frames del video fuente. El script valida frame,
timestamp y dimensiones de cada salida antes de dibujar; rechaza faltantes,
etiquetas repetidas y colisiones de rutas. Los títulos se normalizan a ASCII
porque la fuente integrada de OpenCV no representa Unicode de forma fiable.

## Evidencia ejecutada

Se renderizó el contacto atacante/defensor de segundos 3,5–7,0 del recorte, 105
frames fuente a 30 FPS y salida ralentizada a 15 FPS. Paneles: baseline >=.25,
dos etapas y ByteTrack estándar. Resultado: H264, 2808×568, 105 frames, 7 s,
SHA256 `1cec1e1e4eee825b22457984f8701a6ccc12d99d6497095addd23373839e29ad`.

La inspección de fotogramas a tiempos fuente 4,0 s y 5,5 s confirma que los tres
paneles corresponden al mismo instante y que cajas/IDs son legibles. La
conclusión cuantitativa sigue viniendo de la auditoría de puntos: ByteTrack tuvo
dos cambios muestreados en este contacto; baseline y dos etapas, cero. Los IDs
numéricos entre trackers no son comparables entre sí.

También se generó una segunda comparación para el cruce de compañeros en
segundos 35,5–38,5, donde los tres trackers conservaron los IDs en los puntos
asignables. Su SHA256 es
`1550b7e0fea1647d57d8a6190d95a68f1ddb31173dab0e5369e3190013f57eb5`.
Los videos no se suben al repositorio porque derivan del partido
aportado; el código y los comandos reproducibles sí.

```bash
python compare_trackers_video.py --video /ruta/fixture120.mp4 \
  --tracks 'Baseline=/ruta/baseline_high_only.jsonl' \
  --tracks 'Dos etapas=/ruta/two_stage.jsonl' \
  --tracks 'ByteTrack estandar=/ruta/bytetrack_standard.jsonl' \
  --output /ruta/contacto.mp4 --start 3.5 --seconds 3.5 --slowdown 2
```

Esto mejora la auditabilidad, no la precisión del tracker. No es ground truth ni
reemplaza IDF1/HOTA. Próximo paso: usar el mismo visor mientras se anota un
segmento completo y separar cambios de ID reales de discontinuidades del
detector.
