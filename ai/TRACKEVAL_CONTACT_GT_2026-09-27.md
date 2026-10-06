# TrackEval sobre GT revisado: contacto Ferro–Luján

Se validó el paquete `7Metros_GT_Ferro_Lujan_FINAL.zip` y se evaluaron los tres
trackers sobre exactamente los mismos 105 frames (fixture 105–209). El GT tiene
1.359 anotaciones y 13 identidades; no contiene cajas inválidas ni IDs repetidos
dentro de un frame. El hash del GT es
`6cbee6046118d3f25cc3ae028b1aaa24b75e42859f0bc2541eaab9cfdcd1b615`.

La evaluación usa TrackEval 1.3.0 oficial, IoU 0,5, sin preprocesamiento MOT de
distractores, con HOTA, CLEAR e Identity. Las salidas son replay de la caché de
inferencia ya persistida, no una nueva inferencia neuronal.

| Tracker | HOTA | DetA | AssA | MOTA | Recall | Precisión | IDF1 | IDSW | Fragmentos |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline ≥.25 | 82,844 | 76,850 | 89,306 | 76,012 | 84,915 | 91,081 | 87,053 | 8 | 19 |
| dos etapas .10/.25 | **84,341** | **78,822** | **90,263** | **80,648** | **90,066** | 91,071 | **89,752** | 8 | **12** |
| ByteTrack estándar | 72,102 | 70,609 | 73,807 | 80,280 | 88,742 | **91,641** | 83,290 | **5** | 16 |

Frente al baseline, dos etapas gana +1,496 puntos HOTA, +2,700 IDF1, +4,636
MOTA y +5,151 de recall, manteniendo 8 cambios de ID y reduciendo fragmentos de
19 a 12. ByteTrack reduce cambios de ID a 5 y mejora MOTA, pero pierde 10,743
puntos HOTA y 3,763 IDF1; su asociación y localización son claramente peores en
este recorte. La mejora seleccionada es, por lo tanto, la asociación en dos
etapas.

## Reproducción

`prepare_trackeval_bundle.py` valida la constancia de revisión, geometría,
frames, hashes y genera el layout MOTChallenge común. El nuevo
`evaluate_trackeval_bundle.py` vuelve a verificar los hashes, ejecuta TrackEval
y genera un JSON compacto que distingue replay de inferencia fresca.

```bash
python -m pip install -e 'ai[evaluation]'
PYTHONPATH=ai python ai/evaluate_trackeval_bundle.py \
  --bundle /ruta/al/bundle \
  --output /ruta/a/trackeval_contact.json
```

## Alcance y siguiente prioridad

Estas son métricas reales contra anotación humana para un único contacto de
105 frames, no precisión general del partido ni de una temporada. La revisión
partió de una propuesta automática, por lo que aún puede existir sesgo de
anclaje. El siguiente paso es revisar un segundo intervalo difícil e
independiente —idealmente cortes, reapariciones y cruces— y repetir el protocolo
antes de fijar dos etapas como default. ByteTrack merece diagnóstico visual de
sus cajas predichas, pero no desplaza al candidato actual con esta evidencia.
