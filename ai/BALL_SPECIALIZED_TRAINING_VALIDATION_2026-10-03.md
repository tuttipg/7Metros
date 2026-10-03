# Entrenamiento y rechazo de detector especializado de pelota — 03/10/2026

## Resultado

Se recuperó el ciclo completo de visión: admisión de datos, entrenamiento CPU,
admisión del peso, inferencia neuronal nueva a confianza `.10`, persistencia de
caché y replay estricto sobre los mismos 113 cuadros del partido reservado.

El peso especializado **no se promueve**. Aunque obtuvo `mAP50=0,91744` y
`mAP50-95=0,55549` en la validación del dataset externo, rindió peor que el
YOLO11n genérico en el muestreo revisado del partido. Esas métricas externas no
son precisión del partido ni precisión general.

## Datos y controles

Se utilizó `handball-detection` v2, alojado en el commit
`ebd05c73e8bffa3a537aed13ecb8174c4de4eeeb` de
`jacobattard/Thesis`. El export declara 1.029 imágenes, una clase `handball` y
licencia CC BY 4.0. El manifiesto de fuentes cubre tanto medios originales como
anotaciones y pasó el control de derechos; esto no sustituye revisión jurídica.

El validador aceptó 1.029 imágenes, 1.029 etiquetas y 3.144 cajas. No encontró
colisiones exactas ni perceptuales contra los 113 cuadros reservados. Para
admitir el export se hizo una corrección acotada: tolerancia `1e-5` para cuatro
desbordes de borde producidos por serialización decimal; un desborde geométrico
real sigue rechazándose. Los rechazos de dataset ahora producen JSON portable,
hasheado y marcado `NOT_EVALUATED`.

## Entrenamiento reproducible

- Base: YOLO11n, SHA-256
  `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`.
- Configuración: 5 épocas, `imgsz=640`, batch 8, seed 0, determinista, CPU,
  Ultralytics 8.4.163 y Torch 2.14.0+cpu.
- Duración local: 436,59 segundos.
- Peso resultante: 5.442.650 bytes, SHA-256
  `0bf57b3a22505be98767b473f0c22cf16fc05534ce1d794a0c85474e181eb9b5`.
- Validación externa: precisión `0,87729`, recall `0,86795`, mAP50 `0,91744`,
  mAP50-95 `0,55549` sobre 205 imágenes y 626 instancias.

El peso pasó el contrato técnico de admisión para evaluación reservada. El
checkpoint binario no se versiona en el repositorio; quedan su hash, tamaño,
configuración, procedencia y resultados para reproducirlo y verificarlo.

## Comparación alineada en el partido

Ambos modelos ejecutaron inferencia neuronal nueva sobre exactamente los mismos
53 cuadros visibles y 60 negativos, con confianza baja `.10`, fuerte `.25` e
`imgsz=960`. Luego se repitió la evaluación desde cada caché. Quitando solamente
los metadatos que identifican el modo de ejecución, cada replay fue idéntico a
su respectiva inferencia fresca.

| Modelo / selección | Matches | FP evaluables | Precisión muestra | Recall muestra | Mayor hueco |
|---|---:|---:|---:|---:|---:|
| Genérico, fuerte `.25` | 24/53 | 3 | 0,8889 | 0,4528 | 9 |
| Genérico, cancha + dos etapas | 33/53 | 1 | 0,9706 | 0,6226 | 9 |
| Especializado, fuerte `.25` | 15/53 | 76 | 0,1648 | 0,2830 | 15 |
| Especializado, cancha + dos etapas | 16/53 | 29 | 0,3556 | 0,3019 | 16 |

La caché genérica contiene 53 detecciones y la especializada 256. La asociación
de dos etapas mejora el agregado genérico, pero falla la no-regresión en cada
secuencia visible; por eso tampoco se cambia el default. El especializado falla
también la no-regresión agregada y queda rechazado.

## Límites y siguiente prioridad

Esta evidencia cubre secuencias seleccionadas de un único partido, no el partido
completo. Replay no es inferencia y no se generaron posiciones sintéticas.

La próxima mejora con mejor relación evidencia/costo es auditar visualmente los
falsos positivos del especializado y ampliar el dataset externo con negativos
de cancha, arcos, luces y camisetas; recién después conviene reentrenar y repetir
la misma evaluación reservada. La comparación de asociación de jugadores con
baseline, dos etapas y ByteTrack estándar permanece separada y no se altera en
esta corrida.
