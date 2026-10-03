# Ampliación del GT de pelota con vuelo independiente — 03/10/2026

## Descubrimiento y revisión humana

Se ejecutó un screening neuronal nuevo a 5 FPS sobre los 3.600 cuadros del fixture
únicamente para localizar acciones candidatas. Ese screening no se usó como GT ni
como métrica. Permitió encontrar una transición independiente alrededor de los
cuadros 2841–2852, muy posterior a los vuelos originales 108–112 y 156–160.

Los doce cuadros se revisaron individualmente a resolución nativa y mediante
recortes 6× por vecino más próximo. La pelota presenta un límite oscuro continuo,
sin oclusiones y separable de jugadores y marcas de cancha en los 12/12 cuadros.
Se anotaron cajas humanas enteras siguiendo ese límite visible.

| Secuencia humana | Cuadros visibles/localizables |
|---|---:|
| vuelo 108–112 | 5/5 |
| vuelo 156–160 | 5/5 |
| vuelo independiente 2841–2852 | 12/12 |
| **GT positivo ampliado** | **22/22** |

Los controles negativos permanecen sin cambios: 60 cuadros `out_of_frame` de tres
primeros planos revisados.

## Inferencia nueva sobre el conjunto ampliado

Se ejecutó inferencia neuronal nueva de YOLO11n COCO `sports ball` en los 82
cuadros evaluables, con `imgsz=960` y confianza `.05`.

En el vuelo nuevo:

- coincidencias IoU ≥ .50: **12/12**;
- IoU medio: **0,8728**;
- IoU mínimo: **0,8200**;
- IoU máximo: **0,9553**.

En el conjunto completo:

| Medida local | Resultado |
|---|---:|
| positivos humanos | 22 |
| negativos humanos `out_of_frame` | 60 |
| coincidencias IoU ≥ .50 | 21/22 |
| recall sobre positivos revisados | 0,9545 |
| falsos positivos evaluables | 21 |
| precisión sobre la muestra evaluable | 0,5000 |
| IoU medio positivo | 0,8060 |
| error medio de centro positivo | 0,82 px |

El único fallo positivo continúa siendo el frame 111 del GT original; la acción
nueva no agrega fallos.

## Revalidación del guard de cancha

Se reprodujeron las nuevas cajas neuronales mediante el guard opt-in de cancha
azul. Esta etapa es replay de inferencia persistida más una máscara de escena
nueva, no inferencia neuronal nueva.

| Conjunto ampliado | Control | Guardia |
|---|---:|---:|
| coincidencias | 21/22 | 21/22 |
| candidatas visibles eliminadas | — | 0 |
| falsos positivos evaluables | 21 | 1 |
| precisión de la muestra | 0,5000 | 0,9545 |
| recall positivo | 0,9545 | 0,9545 |

El guard supera por primera vez una acción positiva independiente de las usadas
para plantearlo. Aun así permanece desactivado por defecto: los tres vuelos y los
negativos provienen de un solo partido y una sola cancha azul.

## Alcance y siguiente prioridad

Estas son métricas locales sobre 82 cuadros deliberadamente seleccionados, no
precisión del partido ni generalización a otras sedes. Las cajas 2841–2852 son
referencia humana; el screening sólo eligió qué acción revisar.

Siguiente prioridad: agregar una segunda acción independiente con oclusión o pase
rasante, donde el detector no sea necesariamente continuo, y luego comparar un
detector específico de pelota contra YOLO11n usando exactamente este GT ampliado.
