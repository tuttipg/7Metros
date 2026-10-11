# Tarea reproducible de anotación MOT

Se agregó `prepare_mot_annotation.py` para convertir un intervalo del video y
una salida JSONL del tracker en una tarea revisable de estilo MOTChallenge. El
exportador valida continuidad de frames, timestamps, dimensiones, cajas e IDs;
rechaza sobrescribir una carpeta no vacía y registra hashes de entradas y
artefactos. Produce imágenes, `seqinfo.ini`, el mapeo al video fuente y
`seed/seed.txt`, pero deliberadamente no crea `gt/gt.txt`.

## Evidencia ejecutada

Se exportó el contacto de segundos 3,5–7,0 del recorte real Ferro–N. S. de
Luján usando las propuestas del tracker de dos etapas:

- 105 frames a 30 FPS, 936×524;
- 1.344 cajas propuestas, entre 11 y 15 por frame;
- 16 IDs propuestos;
- video SHA256
  `7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`;
- tracking fuente SHA256
  `3b937ea3d18b05d58ddddb4dd0a457b3d98cc2de1946d1cc1857cda5be0d833c`;
- seed SHA256
  `8159b3bf8502a09f4cf6214a8dcc40aea3e670fa6dc188a5c02f8f1c965e8151`;
- mapeo de frames SHA256
  `7eba3f734a293ed427edb1e8454468c20f29ed79dc73b8e51d4fa91bb1c847d0`;
- imágenes SHA256
  `a36c590b56650810c438d14562a9c4c1c8e8b904844f0025b140d044d7e22525`.

Se inspeccionaron visualmente los frames de tarea 1, 53 y 105: corresponden al
intervalo correcto y el frame 53 contiene el contacto atacante/defensor. El
paquete completo ocupa 17 MiB y no se sube porque contiene imágenes derivadas
del partido; el generador, los tests y la evidencia reproducible sí.

```bash
python prepare_mot_annotation.py --video /ruta/fixture120.mp4 \
  --tracks /ruta/two_stage.jsonl --output /ruta/contact_task \
  --start 3.5 --seconds 3.5
```

## Límite de la evidencia

Las 1.344 cajas y los 16 IDs son propuestas automáticas sin verificar, no
ground truth. No permiten afirmar precisión ni calcular IDF1, HOTA, MOTA o
recall. La siguiente prioridad es revisar de forma independiente todos los
frames, corregir cajas, ausencias e identidades y recién entonces guardar un
`gt/gt.txt` separado para evaluar los tres trackers sobre la misma secuencia.
