# Guardia geométrica de pelota — replay del 03/10/2026

## Mejora

Se agregó una guardia opcional `--max-detection-side-fraction`. Descarta cajas
cuya anchura o altura excede una fracción del lado corto del cuadro. El límite
es relativo a resolución, se valida en `(0,1]`, queda desactivado por defecto y
registra cuántas detecciones recibió, conservó y descartó.

El replay también puede verificar una caché con `--expected-model-sha256` cuando
el checkpoint ya no está disponible localmente. Si el archivo existe debe
coincidir con el hash; si no existe, el hash fijado debe coincidir exactamente
con la fuente persistida en la caché. Esto no ejecuta ni sustituye el modelo.

## Medición alineada

Se barrieron límites entre `0,025` y `0,050` sobre las mismas cachés `.10`, 53
cuadros positivos y 60 negativos. Todo fue replay estricto: no hubo inferencia
nueva ni posiciones sintéticas.

El candidato `0,028` equivale a 14,672 px para el lado corto de 524 px:

| Modelo + dos etapas | Antes: match / FP | Con guardia: match / FP | Precisión muestra | Recall muestra |
|---|---:|---:|---:|---:|
| YOLO11n genérico | 33 / 1 | 33 / 0 | 1,0000 | 0,6226 |
| YOLO11n especializado e5 | 16 / 29 | 17 / 2 | 0,8947 | 0,3208 |

En ambos casos pasaron la no-regresión agregada y por cada secuencia visible. La
guardia retuvo 41/53 detecciones genéricas y 45/256 especializadas. En el modelo
especializado también cambió qué caja consume la asociación temporal, por eso
recuperó un match además de retirar cajas grandes.

El barrido muestra una meseta genérica entre `0,028` y `0,032`; para el modelo
especializado, sólo `0,025` y `0,028` pasan la no-regresión por secuencia. Esto
es evidencia exploratoria del mecanismo, no una estimación de precisión.

## Decisión y límites

No se modifica el default ni se promueve el detector especializado. El umbral
fue elegido mirando este mismo muestreo y podría eliminar pelotas válidas en
primeros planos, otra resolución o una sede con cámara distinta. La precisión
`1,0` es únicamente la del conjunto revisado y no precisión real del partido.

La siguiente prioridad es congelar `0,028` como candidato y evaluarlo sin ajuste
en otro partido o en nuevas secuencias independientes. Si conserva matches y
reduce falsas candidatas, recién entonces podrá considerarse como guardia de
plano de cancha; no debe aplicarse a primeros planos sin otra política.
