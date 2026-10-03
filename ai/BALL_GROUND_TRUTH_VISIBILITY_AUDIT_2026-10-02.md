# Auditoría de visibilidad de pelota — acción 326–340

## Resultado

Se revisaron manualmente los 15 cuadros de la primera acción de gol del fixture
Ferro–N. S. de Luján, primero a resolución nativa (936×524) y después con un
recorte ampliado 3× por vecino más próximo. La pelota no tiene un contorno
separable y localizable con certeza en ninguno de los cuadros.

| Estado humano | Cuadros |
|---|---:|
| visible y localizable | **0** |
| ambiguo/no localizable | **15** |

La reacción del arquero alrededor de 331–335 confirma que la acción ocurre en
esta ventana, pero no permite inferir una caja de pelota. Los pequeños píxeles
oscuros observados coinciden también con bordes de jugadores, compresión y marcas
de la cancha. Marcarlos como pelota fabricaría ground truth a partir de la misma
señal que se quiere evaluar.

## Mejora implementada

Se agregó el contrato `sevenmetros.ball-gt/v1` y un validador reproducible. Cada
cuadro debe clasificarse como `visible`, `occluded`, `out_of_frame` o
`ambiguous`. Sólo `visible` acepta `bbox_xyxy`; los demás estados requieren una
nota y nunca se convierten automáticamente en negativos.

El comando `validate_ball_ground_truth.py --require-visible` falla de forma
explícita cuando una secuencia no permite medir localización. Esto evita reportar
precision/recall sobre 15 cuadros ambiguos o ajustar un detector contra cajas
inventadas.

## Evidencia y límites

- video x264 local SHA256
  `7bfad9a6887a97bd210fb317cc30beb76c5e27f5886c928f48adb08225a4032d`;
- ventana: `[326,341)`;
- 15/15 cuadros revisados y cubiertos por el manifiesto;
- 0 cajas humanas localizables; `evaluable_localisation=false`;
- esta auditoría no mide detector, tracking, precision ni recall;
- el video local no es la copia FFV1 canónica usada en el A/B de tracking.

## Decisión

No se compara otro detector sobre esta acción como si existiera GT de pelota. El
siguiente ensayo útil necesita una fuente donde el balón sea humanamente
identificable o una acción distinta con cuadros visibles. Mientras tanto, el
contrato permite etiquetar vuelos parciales sin convertir oclusiones en falsos
negativos.
